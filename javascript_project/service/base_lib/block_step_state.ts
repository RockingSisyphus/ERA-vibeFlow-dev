/**
 * 块步进状态的共享形状与事实提取。
 *
 * prepare、advance、finalize 三个节点必须对「块步进状态」与「处理楼层身份」给出完全
 * 一致的解释；把形状与提取逻辑放在这里，避免三处各自解释而漂移。
 */

import {
  parseMessageBlocks,
  unwrapAppliedRecords,
  wrapBlockAsAppliedRecord,
  type EraFunctionCallSite,
} from "./domain/message_function_calls.ts";
import type { MessageFunctionFlow } from "./domain/message_function_flow.ts";
import type { EraMessageLayerStartV1 } from "./domain/sync_engine.ts";
import { syncFailure } from "./sync_contracts.ts";
import type {
  SyncContextV1,
  EraMessageFunctionHandoffV1,
  SyncConsecutiveFacts,
  SyncFailureV1,
} from "./sync_contracts.ts";
import type { SyncWorkV1 } from "./sync_contracts.ts";

/** 块步进承载状态；与 `era.sync.block.step.state`/`.next` 两个 schema 同形。 */
export interface EraBlockStepStateV1 {
  readonly messageId: number;
  readonly mk: string;
  readonly blockIndex: number;
  readonly done: boolean;
  /**
   * 本块为止的累计状态（从已提交世界出发逐块推进）。
   *
   * 交接与收口用的是 `baseStat`/`baseStatFunc`（已提交世界），不是这里的累计值：
   * 见 `finalize_block_step` 的「只提交记录」说明。
   */
  readonly stat: Readonly<Record<string, unknown>>;
  readonly statFunc: Readonly<Record<string, unknown>>;
  /** 本批次开始时的已提交世界；交接时的记录提交必须回到它，才能保证重放恰好一次。 */
  readonly baseStat: Readonly<Record<string, unknown>>;
  readonly baseStatFunc: Readonly<Record<string, unknown>>;
  /** 本批次开始时的连续处理事实；交接不算「这条楼层已处理完」，因此不得推进它。 */
  readonly consecutive: SyncConsecutiveFacts;
  readonly route: "none" | "invoke";
  /**
   * 本次迭代真正执行（推进）的块下标；没有推进任何块时为 null。
   *
   * 逐块提交只提交「这一块」：调用块交接的那次迭代不执行任何块（handoff），因此这里必须是
   * 显式事实，而不是让写者去猜 `blockIndex` 为什么变了。
   */
  readonly executedBlockIndex: number | null;
  /**
   * 这条楼层到当前位置为止已消耗的随机抽取次数（含）。
   *
   * 续做只执行剩下的指令，抽取序列必须接着已提交块继续；记录里的 `draws` 就是这个值，
   * 恢复时再用 `appliedRecordDrawOffset` 读回来，否则续做与整楼重放会抽到不同的值。
   */
  readonly drawOffset: number;
  /**
   * 这条楼层是否已经由循环体**逐块提交**过状态与消息记录。
   *
   * 收口节点据此决定还要不要写楼层文本：循环已经写过就必须跳过文本更新，否则同一条楼层会被写
   * 两次、请求里的 source basis 过期（真机实测 `ERA_SYNC_SOURCE_CHANGED`）。用显式事实而不是
   * 靠 `blockIndex > 0` 猜——交接迭代不推进块，那个推断并不成立。
   */
  readonly committedPerBlock: boolean;
  /**
   * 这条楼层的来源在提交期间被改掉了（换 swipe / 重新生成 / 编辑），本批次的工作整体作废。
   *
   * 为什么不报错：这个失败是**正常竞态**而不是缺陷——用户比服务快，新事件会从楼层起点重算。
   * 为什么不当成功：按 `committedPerBlock` 一路推进会写出过期文本、并把侧车状态停在旧分支，
   * 真机 UI-SWIPE-001 就是这样把 swipe B/C 提交成了 A。收口节点见到它会走「什么都不写」的尾链。
   */
  readonly superseded?: boolean;
  /**
   * 这一块提交**真的失败了**（区别于「来源被改掉」的 `superseded`）。
   *
   * 为什么要带回状态而不是在折回节点抛错：抛错是内核级 fatal，会把整条 ERA 永久工作流停掉
   * （真机 SIDECAR-BIND-014：注入一次侧车写入故障后宿主直接 `ERA 服务宿主已停止`，
   * 恢复 UI 永远等不到，后续动作全部 skipped）。侧车写入失败是**可修复**的失败，必须作为
   * 任务级失败结算，让宿主保留恢复入口。
   */
  readonly commitFailure?: SyncFailureV1;
  readonly handoff: EraMessageFunctionHandoffV1 | null;
  /**
   * 楼层原文与元数据随状态携带。
   *
   * 循环 body 拿不到父作用域的能力输入（实测报 required workflow input 'sync_context' is missing），
   * 因此 body 需要的一切都必须由携带状态本身提供：否则只能放弃循环体只吃状态的约束。
   */
  readonly content: string;
  readonly meta: Readonly<Record<string, unknown>>;
  /**
   * 预规划的同步工作项随状态携带。
   *
   * 收口节点不能再消费一次同步上下文，也不能「消费并再次提供」同一类型（线性消费会让它永不被调度），
   * 因此工作项必须随块步进状态一起走，收口节点只依赖状态这一个输入。
   */
  readonly work: Readonly<Record<string, unknown>>;
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 从派发上下文取出当前处理楼层的消息身份与文本；不可用时返回 null。 */
export function processingFloor(
  context: SyncContextV1,
): {
  readonly messageId: number;
  readonly mk: string;
  readonly text: string;
} | null {
  const step = context.step;
  const dispatch = record(step) ? step.dispatchContext : null;
  if (!record(dispatch)) return null;
  const message = record(dispatch.processingMessage)
    ? dispatch.processingMessage
    : null;
  if (!record(message)) return null;
  const messageId = message.messageId;
  const text = message.activeText;
  const mk = dispatch.processingMk;
  if (!Number.isSafeInteger(messageId) || typeof text !== "string") return null;
  return {
    messageId: Number(messageId),
    mk: typeof mk === "string" && mk.length > 0 ? mk : "",
    text,
  };
}

/** 已提交侧车状态中的变量、函数库与元数据；位置状态必须从这里出发。 */
export function committedWorld(context: SyncContextV1): {
  readonly stat: Readonly<Record<string, unknown>>;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly meta: Readonly<Record<string, unknown>>;
} {
  const raw = record(context.variablesRaw) ? context.variablesRaw : {};
  const stat = record(raw.stat_data)
    ? raw.stat_data
    : record(raw.stat)
      ? raw.stat
      : {};
  const statFunc = record(raw.statFunc) ? raw.statFunc : {};
  const meta = record(raw.ERAMetaData)
    ? raw.ERAMetaData
    : record(raw.meta)
      ? raw.meta
      : {};
  return { stat, statFunc, meta };
}

/**
 * 取出这条处理楼层的**起步世界**：引擎已经回退掉这条楼层旧版本效果之后的 stat/statFunc。
 *
 * 为什么不能直接用已提交侧车状态：换 swipe / 重新生成 / 编辑会让同一条楼层换一个 MK，
 * 而侧车里已提交的状态仍含**旧版本**的效果（非幂等的 `insert` 尤其明显：键已存在时插入被挡掉，
 * 于是新分支永远替换不掉旧分支，真机 UI-SWIPE-001 就是这条）。引擎在重算前已经把旧版本的
 * EditLog 回退掉，把那份世界交给块步进，才能让逐块累计与整楼重放得到同一个终值。
 */
export function layerStartForFloor(
  plan: unknown,
  floor: { readonly messageId: number; readonly mk: string } | null,
): { readonly stat: Readonly<Record<string, unknown>>; readonly statFunc: Readonly<Record<string, unknown>> } | null {
  if (!record(plan) || floor === null) return null;
  const starts = Array.isArray(plan.messageLayerStarts)
    ? (plan.messageLayerStarts as readonly EraMessageLayerStartV1[])
    : [];
  const messages = Array.isArray(plan.messages)
    ? (plan.messages as readonly { readonly messageId?: unknown }[])
    : [];
  // 先按 MK 对齐（同一个 MK 就是同一条楼层版本）；MK 缺失或没盖到时退回按 messageId 对齐。
  const match =
    starts.find(entry => entry.mk === floor.mk && floor.mk.length > 0) ??
    starts.find(entry => messages[entry.messageIndex]?.messageId === floor.messageId);
  if (match === undefined) return null;
  return { stat: match.stat, statFunc: match.statFunc };
}

/** 交接事实：函数读取位置状态与调用参数的全部依据。 */
export function handoffOf(input: {
  readonly floor: { readonly messageId: number; readonly mk: string };
  readonly call: EraFunctionCallSite;
  readonly blockIndex: number;
  readonly flow: MessageFunctionFlow;
}): EraMessageFunctionHandoffV1 {
  return {
    schemaVersion: 1,
    messageId: input.floor.messageId,
    mk: input.floor.mk,
    blockIndex: input.blockIndex,
    callId: input.call.callId ?? "",
    name: input.call.name ?? "",
    args: input.call.args ?? {},
    stat: record(input.flow.stat) ? input.flow.stat : {},
    statFunc: input.flow.statFunc ?? {},
  };
}

/**
 * 构造**逐块提交**的工作项：这一块之后的累计状态 + 把该块包成「已应用」记录。
 *
 * 为什么必须同时写这两样：状态写进 sidecar 后，`stat` 就停在「这条楼层算到一半」的位置；
 * 若消息里没有对应的记录，重载后的重放无法知道前几块已经算过，会把它们再算一遍。记录包住
 * 该块（`<era_block applied="1">`）并与游标一起提交，才让「续做」与「整楼重放」终值一致。
 *
 * 楼层算完的那一次提交（`done`）反过来要把记录**全部删掉**并把游标写 `null`：凭据只在
 * 计算期间存在，删掉后原文与「从楼层起点重算」完全一致，封存压缩永远不会遇到它。
 *
 * 没有真正执行块（交接迭代）时返回 null：那次迭代没有任何东西要提交。
 */
export function buildPerBlockCommitWork(input: {
  readonly work: SyncWorkV1;
  readonly state: EraBlockStepStateV1;
}): SyncWorkV1 | null {
  const { work, state } = input;
  const plan = work.plan;
  if (plan === null || typeof plan !== "object" || plan.status === "failed") return null;
  if (state.executedBlockIndex === null) return null;
  const blocks = parseMessageBlocks({ content: state.content });
  const executed = blocks[state.executedBlockIndex];
  if (executed === undefined) return null;
  const wrapped = wrapBlockAsAppliedRecord({
    content: state.content,
    start: executed.start,
    end: executed.end,
    mk: state.mk,
    draws: state.drawOffset,
  });
  // 楼层算完的那一次提交：文本里不再保留任何凭据（原文与「从楼层起点重算」一致），
  // 游标也写 null —— 续做点只在计算期间存在。
  const content = state.done ? unwrapAppliedRecords(wrapped) : wrapped;
  return {
    ...work,
    disposition: "commit",
    plan: {
      ...plan,
      stat: state.stat,
      statFunc: state.statFunc,
      // 楼层算完那一次才写整层记账：中途登记整层会让下一次同步不重算这条楼层。
      meta: state.done ? plan.meta : state.meta,
      sealedCompactionCandidates: [],
      recalculatedMessageIndexes: [],
      nextConsecutiveState: {
        mk: state.consecutive.mk,
        count: state.consecutive.count,
      },
      messageUpdates: [
        {
          kind: "update-message-content",
          messageId: state.messageId,
          messageIndex: 0,
          mk: state.mk,
          content: { kind: "text", text: content },
        },
      ],
    },
    syncCursor: state.done
      ? null
      : {
          messageId: state.messageId,
          mk: state.mk,
          blockIndex: state.executedBlockIndex,
          stat: state.stat,
          statFunc: state.statFunc,
        },
    failure: null,
  };
}

/**
 * 把一次逐块提交的结果折回块步进状态。
 *
 * 只有真正提交成功后状态里的 `content` 才能前进：后续块要在这份「已经写进消息的记录」之上
 * 继续包下一块，否则前一块的记录会在下一次提交时被丢掉。提交失败必须让整个任务失败
 * （抛出类型化错误由内核结算），不能悄悄继续推进——那会让 sidecar 与消息文本对不上。
 */
export function foldBlockCommitOutcome(input: {
  readonly state: EraBlockStepStateV1;
  readonly outcome:
    | { readonly mode: "non-commit" }
    | {
        readonly status: "committed" | "no-op" | "failed" | "fatal";
        readonly sourceChanged?: boolean;
        readonly failure?: SyncFailureV1 | null;
        readonly messageWrites?: readonly {
          readonly messageId: number;
          readonly content: string;
        }[];
      };
}): EraBlockStepStateV1 {
  const { state, outcome } = input;
  // 交接迭代不提交任何东西：循环体给它的是 `{mode: "non-commit"}` 信封（该路径不写任何宿主
  // 状态），因此这里是「原样放行」而不是失败。
  if ("mode" in outcome) return state;
  // 来源在提交期间被改掉：本批次作废。既不推进状态（那会把侧车停在旧分支），也不报错
  // （那会把整条永久工作流停掉）——新事件会从楼层起点重算这条楼层。
  if (outcome.sourceChanged === true) {
    return {
      ...state,
      superseded: true,
      done: true,
      route: "none",
      handoff: null,
      committedPerBlock: true,
    };
  }
  if (outcome.status !== "committed") {
    // 失败必须一路带回任务结果（宿主据此显示修复入口），不能在节点里抛错——那会停掉永久工作流。
    return {
      ...state,
      superseded: false,
      done: true,
      route: "none",
      handoff: null,
      committedPerBlock: false,
      commitFailure:
        outcome.failure ??
        syncFailure(
          `ERA_BLOCK_COMMIT_${String(outcome.status).toUpperCase()}`,
          `逐块提交未成功（status=${outcome.status}）。`,
          "tavern",
        ),
    };
  }
  const written = outcome.messageWrites?.find(
    write => write.messageId === state.messageId,
  );
  return {
    ...state,
    committedPerBlock: true,
    ...(written === undefined ? {} : { content: written.content }),
  };
}

/**
 * 楼层算完时的收尾文本与游标：删掉全部「已应用」记录，把续做点写 `null`。
 *
 * 只在 `state.done` 为真时调用；此时 sidecar 的状态已经是这条楼层的终值，凭据不再需要。
 */
export function buildCompletedFloorContent(state: EraBlockStepStateV1): string {
  return unwrapAppliedRecords(state.content);
}

/**
 * 把「遇到待交接调用、但本次已经产生的消息记录必须落盘」表达成可提交工作项。
 *
 * 为什么交接也必须提交记录：一条消息里可以有多处调用。交接把本批次打断后，下一次恢复
 * 只能从**消息文本**读到「哪些调用已经处理过」；如果交接批次什么都不写，先前调用块上的
 * `status="done"` 就会随批次一起丢掉，恢复后仍停在同一处调用上——两处调用会互相把对方
 * 的标记丢掉，形成永不前进的交接循环（实测 MSG-FCALL-004：41 次重复调用、零落盘）。
 *
 * 为什么只提交记录、不提交状态：`plan` 的 `stat` 是**整条消息**重放后的结果，而交接只
 * 执行到调用块为止。把它写进 sidecar 会让「后续块」在恢复时被算两次；而把「前段块的累计
 * 状态」写进去、又不在文本里留下「这些块已应用」的凭据，恢复后的整楼重放会**再次**应用
 * 它们（`$expr` 这类非幂等操作会算两遍）。因此交接提交把状态停在**已提交世界**
 * （`baseStat`/`baseStatFunc` 与 `meta`），只把消息文本写出去：恢复时该楼层从已提交世界
 * 重放一次，恰好得到与逐块提交相同的终值。
 *
 * 同理不推进连续处理事实、不提交封存压缩候选：这条楼层还没有处理完。
 */
export function buildHandoffRecordWork(input: {
  readonly work: SyncWorkV1;
  readonly state: EraBlockStepStateV1;
}): SyncWorkV1 {
  const plan = input.work.plan;
  if (plan === null || typeof plan !== "object" || plan.status === "failed") return input.work;
  return {
    ...input.work,
    disposition: "commit",
    plan: {
      ...plan,
      stat: input.state.baseStat,
      statFunc: input.state.baseStatFunc,
      meta: input.state.meta,
      sealedCompactionCandidates: [],
      recalculatedMessageIndexes: [],
      nextConsecutiveState: {
        mk: input.state.consecutive.mk,
        count: input.state.consecutive.count,
      },
    },
    failure: null,
  };
}

/**
 * 把「一个块之后的状态」收口成可提交工作项。
 *
 * 锁定语义要求每个操作块执行完就提交一次状态。既有提交链的 stat/statFunc/meta 全部取自
 * plan，因此单块提交不需要新的提交通道：为这一块构造一个只含该块的 plan，再交给既有的
 * `buildSyncCommitRequest` + `era.tavern.variables_commit` 写入即可。
 *
 * 为什么 messageUpdates 必须带锚定后的文本：记录要落在该块的位置（切片 1a 的
 * `anchoredTransactionContent` 负责锚定），否则重放顺序会变成「先后续块、后本块」，
 * 对非交换操作会算出与实时不同的终值。
 */
export function buildBlockCommitWork(input: {
  readonly work: SyncWorkV1;
  readonly state: EraBlockStepStateV1;
  readonly content: string;
  readonly messageIndex: number;
}): SyncWorkV1 {
  const count = input.state.blockIndex > 0 ? input.state.blockIndex : 1;
  const actionsTaken = {
    rollback: false,
    apply: true,
    resync: false,
    api: false,
    editedResync: false,
    swipedRollback: false,
  };
  const plan = {
    kind: "sync",
    status: "fast-sync",
    committed: true,
    divergence: null,
    stat: input.state.stat,
    statFunc: input.state.statFunc,
    meta: input.work.plan === null ? {} : input.work.plan.meta,
    messages: input.work.plan === null ? [] : input.work.plan.messages,
    messageUpdates: [
      {
        kind: "update-message-content",
        messageId: input.state.messageId,
        messageIndex: input.messageIndex,
        mk: input.state.mk,
        content: { kind: "text", text: input.content },
      },
    ],
    sealedCompactionCandidates: [],
    recalculatedMessageIndexes: [],
    rollback: { applied: false, fromMk: null, toMk: null },
    actionsTaken,
    consecutiveProcessingCount: count,
    nextConsecutiveState: { mk: input.state.mk, count },
    diagnostics: [],
  } as unknown as SyncWorkV1["plan"];
  return {
    ...input.work,
    disposition: "commit",
    plan,
    payload:
      input.work.payload === null
        ? null
        : {
            ...input.work.payload,
            mk: input.state.mk,
            message_id: input.state.messageId,
            actions: actionsTaken,
          },
  };
}
