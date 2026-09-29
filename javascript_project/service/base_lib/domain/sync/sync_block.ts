/** Advance one Service message block using an already prepared sync plan. */
import { commandCompactionMarkerIsCurrent,commandCompactionMarkersOf } from "../commands/command_compaction_marker.ts";
import { applyMessageCommands } from "../commands/crud_engine.ts";
import { parseMessageBlocks,unwrapAppliedRecords,wrapBlockAsAppliedRecord,type EraFunctionCallSite } from "../commands/message_function_calls.ts";
import { ensureMessageKey,readMkMessageText } from "../mk_engine.ts";
import { cloneSnapshotValue,parseEditLog } from "../snapshot_history.ts";
import { cloneMessages,defineOwn,editLogsOf,functionEditLogsOf,metaWith,selectedMksOf } from "./sync_divergence.ts";
import type { EraSealedCompactionCandidateV1,EraSyncPlanV1 } from "./sync_types.ts";

export interface EraSyncBlockResultV1 {
  readonly pendingCall?: EraFunctionCallSite;
  readonly plan: EraSyncPlanV1;
  readonly done: boolean;
  readonly failure: { readonly code: string; readonly message: string } | null;
  readonly messageIndex: number | null;
}

/** 正式推进和纯历史计算共用的单块语义；正式入口只多记录文本进度。 */
export function advanceEraSyncBlock(
  plan: EraSyncPlanV1,
  formal = true,
  suspendCalls = false,
  pauseBeforeBlock = false,
): EraSyncBlockResultV1 {
  if (plan.status === "failed" || !plan.execution)
    return { plan, done: true, failure: null, messageIndex: null };
  let execution = plan.execution;
  const index = execution.messageIndex;
  if (index >= execution.endIndex)
    return {
      plan: { ...plan, execution: null },
      done: true,
      failure: null,
      messageIndex: null,
    };
  const messages = cloneMessages(plan.messages);
  const ensured = ensureMessageKey(
    messages[index],
    execution.mkSeedsByIndex[index] ?? undefined,
  );
  if ("reason" in ensured) {
    const selected = selectedMksOf(plan.meta).slice();
    selected[index] = null;
    execution = {
      ...execution,
      messageIndex: index + 1,
      blockIndex: 0,
      floorStarted: false,
    };
    const done = execution.messageIndex >= execution.endIndex;
    return {
      plan: {
        ...plan,
        meta: metaWith(
          plan.meta,
          selected,
          editLogsOf(plan.meta),
          functionEditLogsOf(plan.meta),
        ),
        messageUpdates: plan.messageUpdates,
        sealedCompactionCandidates: [],
        diagnostics: [
          ...plan.diagnostics,
          {
            code:
              ensured.status === "seed-required"
                ? "ERA_SYNC_MK_SEED_REQUIRED"
                : "ERA_SYNC_MESSAGE_INVALID",
            message: ensured.reason,
            messageIndex: index,
          },
        ],
        execution: done ? null : execution,
      },
      done,
      failure: null,
      messageIndex: index,
    };
  }
  let text = readMkMessageText(ensured.message);
  const editLogs = editLogsOf(plan.meta);
  const functionEditLogs = functionEditLogsOf(plan.meta);
  const selected = selectedMksOf(plan.meta).slice();
  if (!execution.floorStarted) {
    // 已撤销旧效果后从原文重算；临时标记不能代替回退日志。
    text = unwrapAppliedRecords(text);
    execution = {
      ...execution,
      floorStarted: true,
      blockIndex: 0,
      randomDrawOffset: 0,
      layerStartStat: cloneSnapshotValue(plan.stat),
      layerStartStatFunc: cloneSnapshotValue(plan.statFunc),
    };
    defineOwn(editLogs, ensured.mk, []);
    defineOwn(functionEditLogs, ensured.mk, []);
  }
  // A stage may perform its JSON calls at this exact position. Establish the
  // same floor origin and random cursor without consuming the next text block.
  if (pauseBeforeBlock) {
    messages[index] = { ...ensured.message, content: { kind: "text", text } };
    return {
      plan: {
        ...plan,
        messages,
        execution,
        meta: metaWith(plan.meta, selected, editLogs, functionEditLogs),
      },
      done: false,
      failure: null,
      messageIndex: index,
    };
  }
  const blocks = parseMessageBlocks({
    content: text,
    traditionalToSimplified: execution.traditionalToSimplified,
  });
  const block = blocks[execution.blockIndex];
  if (
    block?.kind === "call" &&
    !block.call.nested &&
    !block.call.processed &&
    formal
  ) {
    if (suspendCalls) {
      messages[index] = { ...ensured.message, content: { kind: "text", text } };
      selected[index] = ensured.mk;
      return {
        plan: {
          ...plan,
          messages,
          execution,
          meta: metaWith(plan.meta, selected, editLogs, functionEditLogs),
        },
        done: false,
        messageIndex: index,
        failure: null,
        pendingCall: block.call,
      };
    }
    return {
      plan,
      done: true,
      messageIndex: index,
      failure: {
        code: "ERA_FCALL_NOT_IMPLEMENTED",
        message: `消息 #${ensured.message.messageId} 位置 ${block.start} 的 EraFCall ${block.call.name ?? "?"} 尚未实现。${block.call.diagnostics.map((d) => d.message).join(" ")}`,
      },
    };
  }
  let stat = plan.stat;
  let statFunc = plan.statFunc;
  const diagnostics = [...plan.diagnostics];
  if (block?.kind === "command") {
    const ordinal = blocks
      .slice(0, execution.blockIndex)
      .filter((b) => b.kind === "command").length;
    const applied = applyMessageCommands({
      content: text,
      messageId: ensured.message.messageId,
      initialStat: stat,
      initialStatFunc: statFunc,
      messageStartStat: execution.layerStartStat,
      messageStartStatFunc: execution.layerStartStatFunc,
      meta: metaWith(
        plan.meta,
        selected.slice(0, index),
        editLogs,
        functionEditLogs,
      ),
      randomSourceKey: ensured.mk,
      randomDrawOffset: execution.randomDrawOffset,
      commandRange: { fromIndex: ordinal, toIndex: ordinal + 1 },
      traditionalToSimplified: execution.traditionalToSimplified,
    });
    stat = applied.finalStat;
    statFunc = applied.finalStatFunc ?? statFunc;
    defineOwn(editLogs, ensured.mk, [
      ...parseEditLog(editLogs[ensured.mk]),
      ...applied.editLog,
    ]);
    defineOwn(functionEditLogs, ensured.mk, [
      ...parseEditLog(functionEditLogs[ensured.mk]),
      ...(applied.functionEditLog ?? []),
    ]);
    diagnostics.push(
      ...applied.diagnostics.map((d) => ({ ...d, messageIndex: index })),
    );
    execution = {
      ...execution,
      randomDrawOffset:
        applied.nextRandomDrawOffset ?? execution.randomDrawOffset,
    };
    if (formal)
      text = wrapBlockAsAppliedRecord({
        content: text,
        start: block.start,
        end: block.end,
        mk: ensured.mk,
        draws: execution.randomDrawOffset,
      });
  }
  if (formal && block?.kind === "call" && !block.call.nested) {
    text = wrapBlockAsAppliedRecord({
      content: text,
      start: block.start,
      end: block.end,
      mk: ensured.mk,
      draws: execution.randomDrawOffset,
    });
  }
  const floorDone = block === undefined;
  if (floorDone) text = unwrapAppliedRecords(text);
  messages[index] = { ...ensured.message, content: { kind: "text", text } };
  selected[index] = ensured.mk;
  const meta = metaWith(plan.meta, selected, editLogs, functionEditLogs);
  const candidates: EraSealedCompactionCandidateV1[] = [];
  if (
    floorDone &&
    messages.slice(index + 1).some((m) => m.role === "assistant") &&
    !diagnostics.some(
      (d) =>
        d.messageIndex === index &&
        !/^ERA_(?:FCALL|FUNCTION_CALL)_/u.test(d.code),
    ) &&
    !commandCompactionMarkerIsCurrent(
      commandCompactionMarkersOf(meta)[ensured.mk],
      ensured.mk,
      text,
      selected.slice(0, index),
    )
  ) {
    candidates.push({
      messageId: ensured.message.messageId,
      messageIndex: index,
      mk: ensured.mk,
      layerStartStat: execution.layerStartStat,
      layerStartStatFunc: execution.layerStartStatFunc,
      layerEndStat: stat,
      layerEndStatFunc: statFunc,
      eraMeta: metaWith(
        meta,
        selected.slice(0, index),
        editLogs,
        functionEditLogs,
      ),
      traditionalToSimplified: execution.traditionalToSimplified,
    });
  }
  execution = floorDone
    ? {
        ...execution,
        messageIndex: index + 1,
        blockIndex: 0,
        randomDrawOffset: 0,
        floorStarted: false,
      }
    : { ...execution, blockIndex: execution.blockIndex + 1 };
  const done = execution.messageIndex >= execution.endIndex;
  return {
    plan: {
      ...plan,
      stat,
      statFunc,
      meta,
      messages,
      diagnostics,
      messageUpdates: [
        ...plan.messageUpdates.filter(
          (update) => update.messageId !== ensured.message.messageId,
        ),
        {
          kind: "update-message-content",
          messageId: ensured.message.messageId,
          messageIndex: index,
          mk: ensured.mk,
          content: { kind: "text", text },
        },
      ],
      sealedCompactionCandidates: candidates,
      recalculatedMessageIndexes: floorDone
        ? [...plan.recalculatedMessageIndexes, index]
        : plan.recalculatedMessageIndexes,
      execution: done ? null : execution,
    },
    done,
    failure: null,
    messageIndex: index,
  };
}
