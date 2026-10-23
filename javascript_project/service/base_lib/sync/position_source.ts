import { ensureMessageKey, readMkMessageText } from "../domain/mk_engine.ts";
import {
  parseMessageBlocks,
  unwrapAppliedRecords,
  wrapBlockAsAppliedRecord,
} from "../domain/commands/message_function_calls.ts";
import {
  cloneSnapshotValue,
  parseEditLog,
} from "../snapshot/snapshot_history.ts";
import {
  cloneMessages,
  defineOwn,
  editLogsOf,
  functionEditLogsOf,
  selectedMksOf,
  metaWith,
} from "../domain/sync/sync_divergence.ts";
import {
  commandCompactionMarkerIsCurrent,
  commandCompactionMarkersOf,
} from "../domain/commands/command_compaction_marker.ts";
import {
  seedCommandOperations as seedCommands,
  operationResult,
  type OperationState,
} from "../domain/commands/operation_state.ts";
import {
  syncFailure,
  type PositionState,
  type EraBlockStepStateV1,
} from "./sync_contracts.ts";

export function prepareFloorOrigin(input: PositionState): {
  state: PositionState;
  route: string;
} {
  let state = forkPosition(input);
  const plan: any = state.state.work.plan,
    before = plan.execution,
    index = before.messageIndex;
  const messages = cloneMessages(plan.messages),
    ensured = ensureMessageKey(
      messages[index],
      before.mkSeedsByIndex[index] ?? undefined,
    );
  state.position = {
    index,
    messages,
    ensured,
    beforeExecution: before,
    originalFrame: state.state.functionFrame,
    sourceMessageId: messages[index]?.messageId,
    editLogs: editLogsOf(plan.meta),
    functionEditLogs: functionEditLogsOf(plan.meta),
    selected: selectedMksOf(plan.meta).slice(),
  };
  if ("reason" in ensured) return { state, route: "invalid" };
  let execution = before,
    text = readMkMessageText(ensured.message);
  if (!execution.floorStarted) {
    text = unwrapAppliedRecords(text);
    execution = {
      ...execution,
      floorStarted: true,
      blockIndex: 0,
      randomDrawOffset: 0,
      layerStartStat: cloneSnapshotValue(plan.stat),
      layerStartStatFunc: cloneSnapshotValue(plan.statFunc),
    };
    defineOwn(state.position.editLogs, ensured.mk, []);
    defineOwn(state.position.functionEditLogs, ensured.mk, []);
  }
  messages[index] = { ...ensured.message, content: { kind: "text", text } };
  state.position.text = text;
  state = withPlan(state, {
    ...plan,
    messages,
    execution,
    meta: metaWith(
      plan.meta,
      state.position.selected,
      state.position.editLogs,
      state.position.functionEditLogs,
    ),
  });
  return { state, route: "ready" };
}
export function advanceInvalidFloor(input: PositionState): PositionState {
  const state = forkPosition(input),
    p = state.position,
    plan: any = state.state.work.plan;
  p.selected[p.index] = null;
  const execution = {
    ...plan.execution,
    messageIndex: p.index + 1,
    blockIndex: 0,
    floorStarted: false,
  };
  const done = execution.messageIndex >= execution.endIndex;
  state.consumedSource = true;
  const changed = withPlan(state, {
    ...plan,
    meta: metaWith(plan.meta, p.selected, p.editLogs, p.functionEditLogs),
    sealedCompactionCandidates: [],
    diagnostics: [
      ...plan.diagnostics,
      {
        code:
          p.ensured.status === "seed-required"
            ? "ERA_SYNC_MK_SEED_REQUIRED"
            : "ERA_SYNC_MESSAGE_INVALID",
        message: p.ensured.reason,
        messageIndex: p.index,
      },
    ],
    execution: done ? null : execution,
  });
  changed.state = { ...changed.state, done };
  return changed;
}
export function routeStagePosition(input: PositionState): {
  state: PositionState;
  route: string;
} {
  const stage: any = input.state.stageOutcome,
    work = stage?.stageWorkInput,
    program = work?.program;
  return {
    state: input,
    route:
      !input.state.functionFrame &&
      program &&
      !program.completed &&
      program.remaining === 0 &&
      input.position.ensured.message.messageId === work.stageFloor.messageId
        ? "calls"
        : "source",
  };
}
export function classifySourceBlock(input: PositionState): {
  state: PositionState;
  route: string;
} {
  const state = forkPosition(input),
    plan: any = state.state.work.plan,
    p = state.position;
  const blocks = parseMessageBlocks({
    content: p.text,
    traditionalToSimplified: plan.execution.traditionalToSimplified,
  });
  const block = blocks[plan.execution.blockIndex];
  p.block = block;
  p.blocks = blocks;
  return {
    state,
    route: !block
      ? "floor-end"
      : block.kind === "command"
        ? "command"
        : p.formal !== false && !block.call.nested && !block.call.processed
          ? "author-call"
          : "skip",
  };
}
export function seedCommandOperations(input: PositionState): {
  state: PositionState;
  operations: OperationState;
} {
  const state = forkPosition(input),
    p = state.position,
    plan: any = state.state.work.plan;
  p.operationOrigin = "command";
  const ordinal = p.blocks
    .slice(0, plan.execution.blockIndex)
    .filter((b: any) => b.kind === "command").length;
  return {
    state,
    operations: seedCommands({
      content: p.text,
      messageId: p.ensured.message.messageId,
      initialStat: plan.stat,
      initialStatFunc: plan.statFunc,
      messageStartStat: plan.execution.layerStartStat,
      messageStartStatFunc: plan.execution.layerStartStatFunc,
      meta: metaWith(
        plan.meta,
        p.selected.slice(0, p.index),
        p.editLogs,
        p.functionEditLogs,
      ),
      randomSourceKey: p.ensured.mk,
      randomDrawOffset: plan.execution.randomDrawOffset,
      commandRange: { fromIndex: ordinal, toIndex: ordinal + 1 },
      traditionalToSimplified: plan.execution.traditionalToSimplified,
    }),
  };
}
export function acceptOperationResult(
  input: PositionState,
  operations: OperationState,
): { state: PositionState; route: string } {
  const state = forkPosition(input);
  state.position.operationResult = operations;
  return { state, route: state.position.operationOrigin };
}
export function markCompletedCommand(input: PositionState): PositionState {
  let state = forkPosition(input),
    p = state.position,
    plan: any = state.state.work.plan;
  const applied = operationResult(p.operationResult);
  defineOwn(p.editLogs, p.ensured.mk, [
    ...parseEditLog(p.editLogs[p.ensured.mk]),
    ...applied.editLog,
  ]);
  defineOwn(p.functionEditLogs, p.ensured.mk, [
    ...parseEditLog(p.functionEditLogs[p.ensured.mk]),
    ...(applied.functionEditLog ?? []),
  ]);
  const execution = {
    ...plan.execution,
    randomDrawOffset:
      applied.nextRandomDrawOffset ?? plan.execution.randomDrawOffset,
  };
  if (p.formal !== false)
    p.text = wrapBlockAsAppliedRecord({
      content: p.text,
      start: p.block.start,
      end: p.block.end,
      mk: p.ensured.mk,
      draws: execution.randomDrawOffset,
    });
  state = withPlan(state, {
    ...plan,
    stat: applied.finalStat,
    statFunc: applied.finalStatFunc ?? plan.statFunc,
    diagnostics: [
      ...plan.diagnostics,
      ...applied.diagnostics.map((d: any) => ({ ...d, messageIndex: p.index })),
    ],
    execution,
  });
  return state;
}
export function acceptStageCallTable(input: PositionState): PositionState {
  const state = forkPosition(input),
    operations: OperationState = state.position.operationResult;
  const stage: any = state.state.stageOutcome,
    work = stage.stageWorkInput,
    program = work.program;
  const changed = operations.failure
    ? {
        ...program,
        ...(operations.stageCallTable!.errorResults
          ? { errorResults: operations.stageCallTable!.errorResults }
          : {}),
      }
    : {
        ...program,
        completed: true,
        results: operations.stageCallTable!.results,
        nextDrawOffset: operations.randomCursor!.drawOffset,
      };
  state.state = {
    ...state.state,
    stageOutcome: { ...stage, stageWorkInput: { ...work, program: changed } },
    ...(operations.failure
      ? {
          done: true,
          work: {
            ...state.state.work,
            disposition: "failed",
            failure: syncFailure(
              "ERA_AGENT_CALLS_FAILED",
              operations.failure.message,
              "domain",
            ),
          },
        }
      : {}),
  };
  return state;
}
export function markSkippedCall(input: PositionState): PositionState {
  const state = forkPosition(input),
    p = state.position,
    plan: any = state.state.work.plan;
  if (p.formal !== false && !p.block.call.nested)
    p.text = wrapBlockAsAppliedRecord({
      content: p.text,
      start: p.block.start,
      end: p.block.end,
      mk: p.ensured.mk,
      draws: plan.execution.randomDrawOffset,
    });
  return state;
}
export function finalizeFloor(input: PositionState): PositionState {
  const state = forkPosition(input);
  state.position.floorDone = true;
  state.position.text = unwrapAppliedRecords(state.position.text);
  return state;
}
export function prepareSealedCandidate(input: PositionState): PositionState {
  const state = forkPosition(input),
    p = state.position,
    plan: any = state.state.work.plan;
  p.selected[p.index] = p.ensured.mk;
  const meta = metaWith(plan.meta, p.selected, p.editLogs, p.functionEditLogs);
  p.candidates = [];
  if (
    p.messages.slice(p.index + 1).some((m: any) => m.role === "assistant") &&
    !plan.diagnostics.some(
      (d: any) =>
        d.messageIndex === p.index &&
        !/^ERA_(?:FCALL|FUNCTION_CALL)_/u.test(d.code),
    ) &&
    !commandCompactionMarkerIsCurrent(
      commandCompactionMarkersOf(meta)[p.ensured.mk],
      p.ensured.mk,
      p.text,
      p.selected.slice(0, p.index),
    )
  ) {
    p.candidates.push({
      messageId: p.ensured.message.messageId,
      messageIndex: p.index,
      mk: p.ensured.mk,
      layerStartStat: plan.execution.layerStartStat,
      layerStartStatFunc: plan.execution.layerStartStatFunc,
      layerEndStat: plan.stat,
      layerEndStatFunc: plan.statFunc,
      eraMeta: metaWith(
        meta,
        p.selected.slice(0, p.index),
        p.editLogs,
        p.functionEditLogs,
      ),
      traditionalToSimplified: plan.execution.traditionalToSimplified,
    });
  }
  return state;
}
export function advanceSourcePosition(input: PositionState): PositionState {
  const state = forkPosition(input),
    p = state.position,
    plan: any = state.state.work.plan;
  const messages = [...plan.messages],
    content = { kind: "text", text: p.text };
  messages[p.index] = { ...p.ensured.message, content };
  p.selected[p.index] = p.ensured.mk;
  const execution = p.floorDone
    ? {
        ...plan.execution,
        messageIndex: p.index + 1,
        blockIndex: 0,
        randomDrawOffset: 0,
        floorStarted: false,
      }
    : { ...plan.execution, blockIndex: plan.execution.blockIndex + 1 };
  const done = execution.messageIndex >= execution.endIndex;
  const changed = withPlan(state, {
    ...plan,
    messages,
    meta: metaWith(plan.meta, p.selected, p.editLogs, p.functionEditLogs),
    messageUpdates: [
      ...plan.messageUpdates.filter(
        (u: any) => u.messageId !== p.ensured.message.messageId,
      ),
      {
        kind: "update-message-content",
        messageId: p.ensured.message.messageId,
        messageIndex: p.index,
        mk: p.ensured.mk,
        content,
      },
    ],
    sealedCompactionCandidates: p.candidates ?? [],
    recalculatedMessageIndexes: p.floorDone
      ? [...plan.recalculatedMessageIndexes, p.index]
      : plan.recalculatedMessageIndexes,
    execution: done ? null : execution,
  });
  changed.state = { ...changed.state, done };
  changed.consumedSource = true;
  return changed;
}

export function forkPosition(input: PositionState): PositionState {
  return { ...input, position: input.position ? { ...input.position } : null };
}
export function withPlan(position: PositionState, plan: any): PositionState {
  return {
    ...position,
    state: { ...position.state, work: { ...position.state.work, plan } },
  };
}
/** 外层块路由和作者函数收尾共享同一结束边界，范围为空也不再等待函数。 */
export function blockExecutionIsTerminal(state: EraBlockStepStateV1): boolean {
  const plan: any = state.work.plan;
  return Boolean(
    state.done ||
    !plan ||
    plan.status === "failed" ||
    !plan.execution ||
    state.work.disposition === "failed" ||
    plan.execution.messageIndex >= plan.execution.endIndex,
  );
}
export function routeBlockLifecycle(state: EraBlockStepStateV1): {
  state: PositionState;
  route: string;
} {
  const plan: any = state.work.plan,
    frame = state.functionFrame;
  return {
    state: {
      state,
      position: null,
      consumedSource: false,
      diagnosticsBefore: plan?.diagnostics.length ?? 0,
    },
    route: blockExecutionIsTerminal(state)
      ? "terminal"
      : frame?.phase === "start"
        ? "function-start"
        : frame && (frame.phase === "waiting" || frame.remaining === 0)
          ? "function-wait"
          : "source",
  };
}

export type { PositionState } from "./sync_contracts.ts";
