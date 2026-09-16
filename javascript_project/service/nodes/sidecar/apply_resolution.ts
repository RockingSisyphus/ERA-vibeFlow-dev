import { overlayWorkingMessages } from "../../base_lib/working_state.ts";
import {
  sidecarSourceBasis,
  assertSidecarCurrent,
  sameSidecarValue,
  failedSidecarContext,
  durableFunctionRestoreInstruction,
  durableRestoreInstruction,
  enrich,
  factsWithRecord,
  inspectSidecar,
  recordFor,
  stateForIndependentCopy,
  stateFromRecord,
  type SidecarFactsV1,
  type SidecarRecordV1,
  type SidecarStateV2,
  type SidecarResolutionV1,
  type SyncContextV1,
} from "../../base_lib/sidecar_binding.ts";

interface Ctx {
  readonly capabilities: {
    readonly "era.tavern.sidecar": {
      read_current(input: Readonly<Record<string, unknown>>): Promise<unknown>;
      read_working(input: Readonly<Record<string, unknown>>): any;
      write_working(input: Readonly<Record<string, unknown>>): any;
      read_record(input: Readonly<Record<string, unknown>>): Promise<unknown>;
      write_record(input: Readonly<Record<string, unknown>>): Promise<unknown>;
      commit_metadata(
        input: Readonly<Record<string, unknown>>,
      ): Promise<unknown>;
      publish_snapshot(input: Readonly<Record<string, unknown>>): unknown;
      create_id(input: Readonly<Record<string, unknown>>): {
        sidecarId: string;
      };
      clear_prompt(input: Readonly<Record<string, unknown>>): unknown;
    };
    readonly "era.tavern.messages": {
      update_content(
        input: Readonly<Record<string, unknown>>,
      ): Promise<unknown>;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * `era.tavern.variables.read` 的正式返回值是 `{ scope, variables }`。Sidecar
 * 事务必须和同步引擎使用同一层实际聊天变量；同时保留对直接变量对象的兼容，便于
 * 纯节点单测而不把宿主包装泄漏为另一套业务模型。
 */
function variablesFromSync(sync: SyncContextV1): Record<string, unknown> {
  if (!isRecord(sync.variablesRaw))
    throw new TypeError("当前同步上下文缺少聊天变量。");
  if (isRecord(sync.variablesRaw.variables)) return sync.variablesRaw.variables;
  // Sidecar store 的入口故意只读宿主的 `{ identity, meta, stat }` 事实，
  // 而不是直接把整份 chat variables 交给同步路径。事务内部仍需要构造一次
  // 临时变量投影，以便给既有纯同步/恢复逻辑传递 SidecarId；这个投影不写回
  // Tavern，也不构成状态回退来源。
  if (
    Object.prototype.hasOwnProperty.call(sync.variablesRaw, "identity") &&
    (sync.variablesRaw.meta === null || isRecord(sync.variablesRaw.meta))
  ) {
    const variables: Record<string, unknown> = {};
    if (isRecord(sync.variablesRaw.meta))
      variables.ERAMetaData = sync.variablesRaw.meta;
    if (
      sync.variablesRaw.stat !== null &&
      Object.prototype.hasOwnProperty.call(sync.variablesRaw, "stat")
    ) {
      variables.stat_data = sync.variablesRaw.stat;
    }
    return variables;
  }
  return sync.variablesRaw;
}

function withVariables(
  sync: SyncContextV1,
  variables: Record<string, unknown>,
): SyncContextV1 {
  if (isRecord(sync.variablesRaw) && isRecord(sync.variablesRaw.variables)) {
    return { ...sync, variablesRaw: { ...sync.variablesRaw, variables } };
  }
  return { ...sync, variablesRaw: variables };
}

/** 将已经落盘的本次恢复纳入依据，并移除已经完成的暂存消息写入。 */
function withAppendedRestore(
  sync: SyncContextV1,
  messageId: number,
  content: string,
): SyncContextV1 {
  const raw = sync.messagesRaw as { messages: Array<Record<string, unknown>> };
  const update = (message: Record<string, unknown>) =>
    message.messageId === messageId
      ? { ...message, activeText: content }
      : message;
  const messages = raw.messages.map(update);
  const step = sync.step as Record<string, unknown>;
  const dispatch = step.dispatchContext as Record<string, unknown>;
  const basis = sidecarSourceBasis(sync);
  const sourceBasis = {
    ...basis,
    messages: basis.messages.map((message) =>
      message.messageId === messageId
        ? { ...message, activeText: content }
        : message,
    ),
  };
  return {
    ...sync,
    messagesRaw: { ...raw, messages },
    step: {
      ...step,
      dispatchContext: {
        ...dispatch,
        sourceBasis,
        messages,
        processingMessage: isRecord(dispatch.processingMessage)
          ? update(dispatch.processingMessage)
          : null,
        stagedMessageUpdates: Array.isArray(dispatch.stagedMessageUpdates)
          ? dispatch.stagedMessageUpdates.filter(
              (value) => !isRecord(value) || value.messageId !== messageId,
            )
          : [],
      },
    },
  };
}

function withSidecarId(sync: SyncContextV1, sidecarId: string): SyncContextV1 {
  const variables = variablesFromSync(sync);
  const meta = variables.ERAMetaData as Record<string, unknown>;
  return withVariables(sync, {
    ...variables,
    ERAMetaData: { ...meta, SidecarId: sidecarId },
  });
}

function stateFromSync(
  sync: SyncContextV1,
  facts: SidecarFactsV1,
): SidecarStateV2 {
  if (facts.legacyState !== null) return facts.legacyState;
  // V1 用户文件没有聊天内 legacy stat_data 时，文件本身就是升级的唯一旧
  // 状态来源。不得把它误降级为空对象，否则一次格式升级会丢失变量。
  if (facts.legacyRecord !== null) {
    return {
      statData: facts.legacyRecord.statData,
      eraMeta: facts.legacyRecord.eraMeta ?? {},
      statFunc: {},
    };
  }
  const value = variablesFromSync(sync);
  const eraMeta = isRecord(value.ERAMetaData) ? { ...value.ERAMetaData } : {};
  delete eraMeta.SidecarId;
  return {
    statData: value.stat_data ?? {},
    eraMeta,
    statFunc: isRecord(value.statFunc) ? { ...value.statFunc } : {},
  };
}

interface TransactionProgress {
  sync: SyncContextV1;
  messageWriteState: string;
  persistenceConfirmed: boolean;
  sourceChanged: boolean;
  fileWriteState: string;
}

async function recheckCurrent(
  context: Ctx,
  sync: SyncContextV1,
  expectedId: string | null,
): Promise<void> {
  const current = await context.capabilities["era.tavern.sidecar"].read_current(
    {},
  );
  assertSidecarCurrent(current, sidecarSourceBasis(sync), expectedId);
}

async function publish(
  context: Ctx,
  record: SidecarRecordV1,
  progress: TransactionProgress,
  expectedId: string | null,
): Promise<void> {
  await recheckCurrent(context, progress.sync, expectedId);
  const committed = await context.capabilities[
    "era.tavern.sidecar"
  ].commit_metadata({
    sidecarId: record.sidecarId,
    snapshot: record,
    expectedSidecarId: expectedId,
    sourceBasis: sidecarSourceBasis(progress.sync),
  });
  if (!isRecord(committed) || committed.status !== "committed")
    throw new Error("Sidecar 聊天指针提交失败。");
  context.capabilities["era.tavern.sidecar"].write_working({
    record,
    dirty: false,
  });
}

async function commitV3(
  context: Ctx,
  record: SidecarRecordV1,
  progress: TransactionProgress,
  expectedId: string | null,
): Promise<void> {
  await recheckCurrent(context, progress.sync, expectedId);
  progress.fileWriteState = "attempted";
  const written = await context.capabilities["era.tavern.sidecar"].write_record(
    {
      sidecarId: record.sidecarId,
      record,
      expectedSidecarId: expectedId,
      sourceBasis: sidecarSourceBasis(progress.sync),
    },
  );
  if (!isRecord(written) || written.status !== "committed")
    throw new Error("Sidecar 文件写入未确认。");
  progress.fileWriteState = "written";
  const reread = await context.capabilities["era.tavern.sidecar"].read_record({
    sidecarId: record.sidecarId,
  });
  const verified = inspectSidecar(
    {
      identity: record.owner,
      meta: { SidecarId: record.sidecarId },
      stat: null,
    },
    reread,
  );
  if (!sameSidecarValue(verified.record, record))
    throw new Error("Sidecar 文件回读的身份、版本或内容不一致。");
  progress.fileWriteState = "confirmed";
  await publish(context, record, progress, expectedId);
}

async function applyResolution(
  inputs: Readonly<{
    "era.sidecar.binding.input": { readonly value: unknown };
    "era.sidecar.binding.resolution": { readonly value: unknown };
  }>,
  context: Ctx,
  progress: TransactionProgress,
): Promise<any> {
  const sync = (
    inputs["era.sidecar.binding.input"].value as {
      readonly sync: SyncContextV1;
    }
  ).sync;
  const resolution = inputs["era.sidecar.binding.resolution"]
    .value as SidecarResolutionV1;
  const { facts, choice } = resolution;
  // 派发上下文若已在 Sidecar 之前失败，就没有安全的消息/变量快照可迁移。
  // 此时保持原失败上下文由后续同步结果结算，绝不为了“修复绑定”去读取或清空
  // 聊天状态；否则一个无关的 Tavern 事件错误会制造 Sidecar 半事务。
  const syncStatus = (sync as { readonly status?: unknown }).status;
  if (syncStatus !== undefined && syncStatus !== "ready") {
    // 严格消息投影尚未 ready 时，禁止任何迁移、修复或持久化事务；但 owner
    // 已匹配的 V3 文件已经是当前聊天唯一真相，可以安全恢复新页面实例的
    // 易失只读快照。该能力不触碰聊天指针或用户文件。
    if (
      resolution.route === "continue" &&
      facts.status === "matched" &&
      facts.record !== null
    ) {
      const published = context.capabilities[
        "era.tavern.sidecar"
      ].publish_snapshot({
        sidecarId: facts.record.sidecarId,
        snapshot: facts.record,
      });
      if (!isRecord(published) || published.status !== "published") {
        throw new TypeError("ERA 已匹配 Sidecar 运行时快照发布失败。");
      }
    }
    return {
      sidecar_applied_context: {
        ...sync,
        sidecarBinding: facts,
        sidecarBindingRoute: "continue",
        sidecarBindingChoice: null,
      },
      sidecar_binding_route: "continue",
    };
  }
  await recheckCurrent(context, sync, facts.sidecarId);
  if (facts.sidecarId !== null) {
    const cached = context.capabilities["era.tavern.sidecar"].read_working(
      {},
    ).working;
    const record =
      cached?.record?.sidecarId === facts.sidecarId
        ? { status: "found", sidecarId: facts.sidecarId, record: cached.record }
        : await context.capabilities["era.tavern.sidecar"].read_record({
            sidecarId: facts.sidecarId,
          });
    const current = await context.capabilities[
      "era.tavern.sidecar"
    ].read_current({});
    assertSidecarCurrent(current, sidecarSourceBasis(sync), facts.sidecarId);
    if (!sameSidecarValue(inspectSidecar(current, record), facts))
      throw new Error("Sidecar 决议对应的记录或来源已变化。");
  }
  if (resolution.route === "continue") {
    const cached = context.capabilities["era.tavern.sidecar"].read_working(
      {},
    ).working;
    if (facts.record !== null && !cached) {
      await publish(context, facts.record, progress, facts.sidecarId);
    }
    let withWorking = sync;
    if (cached?.dirty) {
      const currentStep = sync.step as Record<string, unknown>;
      const dispatch = currentStep.dispatchContext as any;
      const projected = overlayWorkingMessages(
        sync.messagesRaw,
        cached,
        dispatch.sourceBasis,
      );
      const staged = new Map<number, string>(
        dispatch.stagedMessageUpdates.map((update: any) => [
          update.messageId,
          update.content,
        ]),
      );
      for (const message of projected.messages) {
        const before = (sync.messagesRaw as any).messages.find(
          (candidate: any) => candidate.messageId === message.messageId,
        );
        if (before?.activeText !== message.activeText)
          staged.set(message.messageId, message.activeText);
      }
      withWorking = {
        ...sync,
        messagesRaw: projected,
        step: {
          ...currentStep,
          dispatchContext: {
            ...dispatch,
            messages: projected.messages,
            processingMessage:
              projected.messages.find(
                (message: any) =>
                  message.messageId === dispatch.processingMessage?.messageId,
              ) ?? dispatch.processingMessage,
            stagedMessageUpdates: [...staged].map(([messageId, content]) => ({
              messageId,
              content,
            })),
          },
        },
      };
    }
    return {
      sidecar_applied_context: enrich(withWorking, facts, "continue", choice),
      sidecar_binding_route: "continue",
    };
  }
  if (resolution.route === "blocked") {
    return {
      sidecar_applied_context: enrich(sync, facts, "blocked", choice),
      sidecar_binding_route: "blocked",
    };
  }
  if (facts.status === "create" && facts.current !== null) {
    const targetId = context.capabilities["era.tavern.sidecar"].create_id(
      {},
    ).sidecarId;
    const resolved = withSidecarId(sync, targetId);
    const record = recordFor(
      targetId,
      facts.current,
      stateFromSync(resolved, facts),
      null,
    );
    await commitV3(context, record, progress, facts.sidecarId);
    // `apply` 只属于本 Nodeset 内部的决议阶段；事务已经完成后，输出给
    // task_sync 的同步上下文必须是可继续的正式路由。把它泄露为 `apply`
    // 会在工作流数据合同校验处被拒绝，导致已经完成的宿主写入无法结算。
    return {
      sidecar_applied_context: enrich(
        resolved,
        factsWithRecord(facts, record),
        "continue",
        choice,
      ),
      sidecar_binding_route: "continue",
    };
  }
  if (facts.status === "migrate-legacy" && facts.current !== null) {
    const targetId =
      facts.sidecarId ??
      context.capabilities["era.tavern.sidecar"].create_id({}).sidecarId;
    const resolved = withSidecarId(sync, targetId);
    const record = recordFor(
      targetId,
      facts.current,
      stateFromSync(resolved, facts),
      facts.record ?? facts.legacyRecord,
    );
    await commitV3(context, record, progress, facts.sidecarId);
    return {
      sidecar_applied_context: enrich(
        resolved,
        factsWithRecord(facts, record),
        "continue",
        choice,
      ),
      sidecar_binding_route: "continue",
    };
  }
  if (
    (facts.status === "invalid" || facts.status === "matched") &&
    facts.current !== null &&
    choice === "repair"
  ) {
    // 修复不是静默降级：只有用户点击明确的修复动作后，才会保留可用 ID 或分配新 ID，
    // 并以当前聊天已提交/可重放的 stat_data 重建本地镜像。
    const targetId =
      facts.sidecarId ??
      context.capabilities["era.tavern.sidecar"].create_id({}).sidecarId;
    const resolved = withSidecarId(sync, targetId);
    // 使用刚刚核对的记录作为修复基线；缺失或损坏记录时使用原任务的可重放状态。
    const record = recordFor(
      targetId,
      facts.current,
      facts.record === null
        ? stateFromSync(resolved, facts)
        : stateFromRecord(facts.record),
      facts.record,
    );
    await commitV3(context, record, progress, facts.sidecarId);
    await recheckCurrent(context, progress.sync, record.sidecarId);
    context.capabilities["era.tavern.sidecar"].clear_prompt({
      sourceBasis: sidecarSourceBasis(progress.sync),
      expectedSidecarId: record.sidecarId,
    });
    // 文件失败前已经确认写入的 Variable 指令是唯一可重放事实。repair 先恢复
    // 一个经过回读验证的 V3 基线，再强制完整同步，使该指令重新得出状态；绝不
    // 读取聊天变量作为后备状态，也不把旧 Sidecar 快照当作最终恢复结果。
    return {
      sidecar_applied_context: enrich(
        resolved,
        factsWithRecord(facts, record),
        "continue",
        choice,
      ),
      sidecar_binding_route: "continue",
    };
  }
  if (
    facts.status !== "conflict" ||
    facts.current === null ||
    facts.record === null ||
    choice === null
  ) {
    throw new TypeError("Sidecar 绑定决议无效；请重新检查当前聊天。");
  }

  const targetId =
    choice === "migrate"
      ? facts.record.sidecarId
      : context.capabilities["era.tavern.sidecar"].create_id({}).sidecarId;
  let resolved = sync;
  if (choice === "migrate" || choice === "copy") {
    const messages =
      (
        sync.messagesRaw as {
          readonly messages?: readonly {
            readonly messageId: number;
            readonly role: string;
            readonly activeText: string;
          }[];
        }
      )?.messages ?? [];
    const lastAi = [...messages]
      .reverse()
      .find((item) => item.role === "assistant");
    if (lastAi === undefined || typeof lastAi.activeText !== "string")
      throw new TypeError("当前聊天没有可追加恢复指令的 AI 消息。");
    const restoreVariables = durableRestoreInstruction(
      stateFromSync(sync, facts).statData,
      facts.record.state.statData,
    );
    const restoreFunctions = durableFunctionRestoreInstruction(
      stateFromSync(sync, facts).statFunc,
      facts.record.state.statFunc,
    );
    if (restoreVariables === null || restoreFunctions === null) {
      throw new TypeError(
        "当前聊天含有无法安全替换的受保护变量或函数库；请先修复当前聊天。",
      );
    }
    const restore = `${restoreVariables}${restoreFunctions}`;
    progress.messageWriteState = "attempted";
    const saved = await context.capabilities[
      "era.tavern.messages"
    ].update_content({
      messageId: lastAi.messageId,
      content: `${lastAi.activeText}${restore}`,
      sourceBasis: sidecarSourceBasis(sync),
      expectedSidecarId: facts.sidecarId,
      purpose: "era-sidecar-restore",
    });
    if (!isRecord(saved) || saved.status !== "committed") {
      if (isRecord(saved)) {
        progress.messageWriteState =
          typeof saved.writeState === "string" ? saved.writeState : "attempted";
        progress.persistenceConfirmed = saved.persistenceConfirmed === true;
        progress.sourceChanged = saved.sourceChanged === true;
      }
      throw new Error(
        isRecord(saved) && typeof saved.message === "string"
          ? saved.message
          : "恢复消息持久化未确认。",
      );
    }
    progress.messageWriteState = "committed";
    progress.persistenceConfirmed = true;
    resolved = withAppendedRestore(
      sync,
      lastAi.messageId,
      `${lastAi.activeText}${restore}`,
    );
    progress.sync = resolved;
  }

  resolved = withSidecarId(resolved, targetId);
  const state =
    choice === "independent"
      ? stateFromSync(resolved, facts)
      : choice === "copy"
        ? stateForIndependentCopy(facts.record)
        : stateFromRecord(facts.record);
  const record = recordFor(
    targetId,
    facts.current,
    state,
    choice === "migrate" ? facts.record : null,
  );
  await commitV3(context, record, progress, facts.sidecarId);
  await recheckCurrent(context, progress.sync, record.sidecarId);
  context.capabilities["era.tavern.sidecar"].clear_prompt({
    sourceBasis: sidecarSourceBasis(progress.sync),
    expectedSidecarId: record.sidecarId,
  });
  // 同上：选择已经被事务消费，后续完整同步只接收规范的 continue 路由。
  return {
    sidecar_applied_context: enrich(
      resolved,
      factsWithRecord(facts, record),
      "continue",
      choice,
    ),
    sidecar_binding_route: "continue",
  };
}

/** 普通事务失败进入既有同步错误终态；保留已完成副作用，不自动补偿或重试。 */
export async function run(
  inputs: Readonly<{
    "era.sidecar.binding.input": { readonly value: unknown };
    "era.sidecar.binding.resolution": { readonly value: unknown };
  }>,
  _params: Readonly<Record<string, unknown>>,
  context: Ctx,
): Promise<any> {
  const progress: TransactionProgress = {
    sync: (inputs["era.sidecar.binding.input"].value as { sync: SyncContextV1 })
      .sync,
    messageWriteState: "not-written",
    persistenceConfirmed: false,
    sourceChanged: false,
    fileWriteState: "not-written",
  };
  try {
    return await applyResolution(inputs, context, progress);
  } catch (error) {
    return {
      sidecar_applied_context: failedSidecarContext(progress.sync, error, {
        messageWriteState: progress.messageWriteState,
        persistenceConfirmed: progress.persistenceConfirmed,
        fileWriteState: progress.fileWriteState,
        sourceChanged:
          progress.sourceChanged ||
          (isRecord(error) &&
            error.code === "ERA_MESSAGE_WRITE_TARGET_CHANGED"),
      }),
      sidecar_binding_route: "continue",
    };
  }
}
