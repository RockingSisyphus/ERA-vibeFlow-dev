/** Batch execution and settlement after collection has closed. */
import type {
  BatchExecutionStateV1, BatchFinalizationV1, BatchPlanV1, BatchResultFrameV1,
  EraServiceStateV1, PlannedStepV1, SettlementV1, TaskResultV1,
} from "./service_types.ts";

export function createExecutionState(plan: BatchPlanV1): {
  readonly route: "execute" | "invalid";
  readonly state: BatchExecutionStateV1;
} {
  const expected: Record<string, number> = {};
  const actual: Record<string, number> = {};
  const errors: string[] = [];
  for (const sequence of plan.sourceSequences) {
    const key = String(sequence);
    expected[key] = (expected[key] ?? 0) + 1;
  }
  if (Object.values(expected).some((count) => count !== 1)) {
    errors.push("duplicate-batch-source");
  }
  for (const [stepIndex, step] of plan.steps.entries()) {
    if (
      step.index !== stepIndex ||
      step.index < 0 ||
      step.index >= plan.steps.length
    ) {
      errors.push("step-index-out-of-range");
    }
    const eventSequences = step.events.map((event) => event.sequence);
    if (
      eventSequences.length !== step.sourceSequences.length ||
      eventSequences.some(
        (sequence, index) => sequence !== step.sourceSequences[index],
      )
    ) {
      errors.push("step-event-source-mismatch");
    }
    if (step.kind === "ignore") {
      if (step.taskRoute !== "ignore" || step.reason.length === 0) {
        errors.push("ignore-step-invalid");
      }
    } else {
      if (
        (step.taskRoute !== "agent-generation-session" && step.taskRoute !== step.task.kind) ||
        step.sources.length !== step.events.length ||
        step.task.sourceEvents.length !== step.events.length ||
        step.sources.some(
          (source, index) =>
            source.event.sequence !== step.events[index]?.sequence ||
            source.event.eventId !== step.events[index]?.eventId,
        ) ||
        step.task.sourceEvents.some(
          (event, index) =>
            event.sequence !== step.events[index]?.sequence ||
            event.eventId !== step.events[index]?.eventId,
        )
      ) {
        errors.push("execute-step-domain-mismatch");
      }
    }
    for (const sequence of step.sourceSequences) {
      const key = String(sequence);
      actual[key] = (actual[key] ?? 0) + 1;
      if (expected[key] === undefined) {
        errors.push("out-of-batch-source");
      }
    }
  }
  for (const key of Object.keys(expected)) {
    if (actual[key] === undefined) {
      errors.push("missing-source");
    } else if (actual[key] !== 1) {
      errors.push("duplicate-source");
    }
  }
  if (plan.steps.length > 128) {
    errors.push("too-many-steps");
  }
  const coverageError =
    errors.length === 0 ? null : [...new Set(errors)].join(",");
  const state: BatchExecutionStateV1 = {
    schemaVersion: 1,
    batchId: plan.batchId,
    throughSequence: plan.throughSequence,
    nextState: plan.nextState,
    sources: plan.events.map((event) => ({
      eventId: event.eventId,
      sequence: event.sequence,
    })),
    steps: plan.steps,
    index: 0,
    settlements: [],
    notifications: [],
    diagnostics: [],
    fatal: false,
    coverageError,
  };
  return { route: coverageError === null ? "execute" : "invalid", state };
}

export function failCoverage(
  state: BatchExecutionStateV1,
): BatchExecutionStateV1 {
  const reason = state.coverageError ?? "unknown-coverage-error";
  return {
    ...state,
    index: state.steps.length,
    settlements: state.sources.map((source) => ({
      ...source,
      status: "failed",
      error: {
        code: "ERA_BATCH_COVERAGE_INVALID",
        message: `批次来源覆盖无效：${reason}`,
        category: "input",
        retryable: false,
      },
    })),
    diagnostics: [
      ...state.diagnostics,
      {
        code: "ERA_BATCH_COVERAGE_INVALID",
        message: `批次来源覆盖无效：${reason}`,
        sequence: null,
      },
    ],
  };
}

export function selectCurrentStep(state: BatchExecutionStateV1): PlannedStepV1 {
  const step = state.steps[state.index];
  if (step === undefined) {
    throw new RangeError("批次步骤索引越界");
  }
  return step;
}

export function createProtocolNoopResult(step: PlannedStepV1): TaskResultV1 {
  if (step.kind !== "execute") {
    throw new TypeError("领域占位结果只能用于 execute 步骤");
  }
  return {
    status: "no-op",
    settlements: step.events.map((event) => ({
      eventId: event.eventId,
      sequence: event.sequence,
      status: "ignored",
      reason: "g3-protocol-placeholder",
    })),
    notifications: [],
    diagnostics: step.events.map((event) => ({
      code: "ERA_G3_PROTOCOL_PLACEHOLDER",
      message: "G3 仅验证协议与生命周期，本事件未执行领域语义。",
      sequence: event.sequence,
    })),
  };
}

export function createProtocolIgnoreResult(
  step: Extract<PlannedStepV1, { readonly kind: "ignore" }>,
): TaskResultV1 {
  return {
    status: "no-op",
    settlements: step.events.map((event) => ({
      eventId: event.eventId,
      sequence: event.sequence,
      status: "ignored",
      reason: step.reason,
    })),
    notifications: [],
    diagnostics: [],
  };
}

export function mergeTaskResult(
  state: BatchExecutionStateV1,
  result: TaskResultV1,
): { readonly state: BatchExecutionStateV1; readonly done: boolean } {
  const nextIndex = state.index + 1;
  return {
    state: {
      ...state,
      nextState:
        result.stateUpdate === undefined
          ? state.nextState
          : {
              ...state.nextState,
              consecutiveMk: result.stateUpdate.consecutiveMk,
              consecutiveProcessingCount:
                result.stateUpdate.consecutiveProcessingCount,
              scopeWindow:
                result.stateUpdate.scopeWindow ?? state.nextState.scopeWindow,
              // 游标只在该更新显式携带时才动它：显式 null 表示「这条楼层算完、清空」，
              // 缺键表示「本次不涉及游标」，不能混为一谈。
              ...(Object.prototype.hasOwnProperty.call(
                result.stateUpdate,
                "syncCursor",
              )
                ? { syncCursor: result.stateUpdate.syncCursor ?? null }
                : {}),
            },
      index: nextIndex,
      settlements: [...state.settlements, ...result.settlements],
      notifications: [...state.notifications, ...result.notifications],
      diagnostics: [...state.diagnostics, ...result.diagnostics],
      fatal: state.fatal || result.status === "fatal",
    },
    done: nextIndex >= state.steps.length,
  };
}

export function finalizeBatch(
  state: BatchExecutionStateV1,
): BatchFinalizationV1 {
  const bySequence: Record<string, SettlementV1[]> = {};
  for (const settlement of state.settlements) {
    const key = String(settlement.sequence);
    bySequence[key] = [...(bySequence[key] ?? []), settlement];
  }
  const diagnostics = [...state.diagnostics];
  let fatal = state.fatal;
  const settlements = [...state.sources]
    .sort((left, right) => left.sequence - right.sequence)
    .map<SettlementV1>((source) => {
      const matches = bySequence[String(source.sequence)] ?? [];
      const exact = matches.filter((item) => item.eventId === source.eventId);
      if (exact.length === 1 && matches.length === 1) {
        return exact[0] as SettlementV1;
      }
      fatal = true;
      diagnostics.push({
        code: "ERA_SETTLEMENT_COVERAGE_CORRUPT",
        message: "任务结果没有为来源生成恰好一次匹配结算。",
        sequence: source.sequence,
      });
      return {
        eventId: source.eventId,
        sequence: source.sequence,
        status: "failed",
        error: {
          code: "ERA_SETTLEMENT_COVERAGE_CORRUPT",
          message: "任务结果没有为来源生成恰好一次匹配结算。",
          category: "domain",
          retryable: false,
        },
      };
    });
  return {
    schemaVersion: 1,
    batchId: state.batchId,
    throughSequence: state.throughSequence,
    nextState: {
      ...state.nextState,
      iteration: state.nextState.iteration + 1,
    },
    settlements,
    notifications: state.notifications,
    diagnostics,
    fatal,
  };
}

export function buildBatchResult(finalization: BatchFinalizationV1): {
  readonly frame: BatchResultFrameV1;
  readonly state: EraServiceStateV1;
} {
  return {
    frame: {
      schemaVersion: 1,
      frameId: `batch-result:${finalization.batchId}`,
      kind: "batch-result",
      throughSequence: finalization.throughSequence,
      settlements: finalization.settlements,
      notifications: finalization.notifications,
      diagnostics: finalization.diagnostics,
      fatal: finalization.fatal,
    },
    state: finalization.nextState,
  };
}
