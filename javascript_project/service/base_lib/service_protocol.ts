import { isJsonValue } from "@era/vibeflow-contracts";
import {
  getCollectionWindowMs,
  hasImmediateCombo,
  planEventBatch,
  shouldCloseCollectionWindow,
  validateEventPlanCoverage,
} from "./domain/event_planner.ts";
import type {
  BatchExecutionStateV1,
  BatchFinalizationV1,
  BatchPlanV1,
  BatchResultFrameV1,
  CollectionCommand,
  CollectionControlV1,
  CollectionReductionV1,
  EraServiceStateV1,
  EraTransportArg,
  EraTransportEventV1,
  PlannedStepV1,
  SettlementV1,
  TaskResultV1,
} from "./service_types.ts";

export type {
  BatchExecutionStateV1,
  BatchFinalizationV1,
  BatchPlanV1,
  BatchResultFrameV1,
  CollectionControlV1,
  CollectionReductionV1,
  DiagnosticV1,
  EraServiceStateV1,
  EraTransportArg,
  EraTransportEventV1,
  NotificationV1,
  PlannedStepV1,
  SettlementV1,
  TaskResultV1,
  TaskRoute,
} from "./service_types.ts";

type Limits = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === expected.length &&
    actual.every((key) => expected.includes(key))
  );
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isTransportArg(value: unknown): value is EraTransportArg {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }
  if (value.kind === "undefined") {
    return hasOnlyKeys(value, ["kind"]);
  }
  if (value.kind === "json") {
    return hasOnlyKeys(value, ["kind", "value"]) && isJsonValue(value.value);
  }
  return (
    value.kind === "host-ref" &&
    hasOnlyKeys(value, ["kind", "token", "refKind"]) &&
    typeof value.token === "string" &&
    value.token.length > 0 &&
    typeof value.refKind === "string" &&
    value.refKind.length > 0
  );
}

function readLimit(limits: Limits, key: string, fallback: number): number {
  const value = limits[key];
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : fallback;
}

export function createInitialServiceState(): EraServiceStateV1 {
  return {
    schemaVersion: 1,
    collection: [],
    collectionBytes: 0,
    iteration: 0,
    consecutiveProcessingCount: 0,
    consecutiveMk: null,
    timerToken: null,
  };
}

export function validateTransportEvent(
  value: unknown,
  limits: Limits,
): EraTransportEventV1 {
  if (!isRecord(value)) {
    throw new TypeError("传输事件必须是对象");
  }
  const keys = [
    "schemaVersion",
    "eventId",
    "sequence",
    "type",
    "occurredAt",
    "source",
    "args",
    "encodedBytes",
  ];
  if (!hasOnlyKeys(value, keys)) {
    throw new TypeError("传输事件包含未知字段或缺少必需字段");
  }
  if (
    value.schemaVersion !== 1 ||
    typeof value.eventId !== "string" ||
    value.eventId.length === 0 ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) < 1 ||
    typeof value.type !== "string" ||
    value.type.length === 0 ||
    typeof value.occurredAt !== "number" ||
    !Number.isFinite(value.occurredAt) ||
    !Array.isArray(value.args) ||
    !value.args.every(isTransportArg) ||
    !isSafeNonNegativeInteger(value.encodedBytes)
  ) {
    throw new TypeError("传输事件字段不符合 ERA 传输协议");
  }
  if (
    value.source !== "tavern" &&
    value.source !== "ui" &&
    value.source !== "era-api" &&
    value.source !== "timer"
  ) {
    throw new TypeError("传输事件来源无效");
  }
  if (
    (value.source === "timer") !==
    (value.type === "era.service.collection_timer")
  ) {
    throw new TypeError("内部定时事件必须使用固定类型与 timer 来源");
  }
  if (value.encodedBytes > readLimit(limits, "max_event_bytes", 262144)) {
    throw new RangeError("传输事件超过单事件字节限制");
  }
  const hostRefCount = value.args.filter(
    (arg) => arg.kind === "host-ref",
  ).length;
  if (hostRefCount > readLimit(limits, "max_host_refs_per_event", 32)) {
    throw new RangeError("传输事件超过宿主引用数量限制");
  }
  return value as unknown as EraTransportEventV1;
}

function collectionState(
  state: EraServiceStateV1,
  collection: readonly EraTransportEventV1[],
  collectionBytes: number,
  timerToken: string | null,
): EraServiceStateV1 {
  return { ...state, collection, collectionBytes, timerToken };
}

function emptyCollectionState(state: EraServiceStateV1): EraServiceStateV1 {
  return collectionState(state, [], 0, null);
}

function cancelCommand(token: string | null): readonly CollectionCommand[] {
  return token === null ? [] : [{ kind: "cancel", token }];
}

function collectionTimerToken(
  anchor: EraTransportEventV1,
  dueAt: number,
): string {
  return `era.collection:${anchor.sequence}:${anchor.eventId}:${dueAt}`;
}

function receivedTimerToken(event: EraTransportEventV1): string | null {
  const argument = event.args[0];
  return argument?.kind === "json" && typeof argument.value === "string"
    ? argument.value
    : null;
}

function collectionResult(
  state: EraServiceStateV1,
  triggeringEvent: EraTransportEventV1,
  route: "wait" | "execute",
  nextState: EraServiceStateV1,
  batchEvents: readonly EraTransportEventV1[],
  commands: readonly CollectionCommand[],
): {
  readonly reduction: CollectionReductionV1;
  readonly control: CollectionControlV1;
} {
  const throughSequence =
    route === "execute"
      ? (batchEvents[batchEvents.length - 1]?.sequence ?? null)
      : null;
  if (route === "execute" && throughSequence === null) {
    throw new Error("execute 事件集不能为空");
  }
  return {
    reduction: {
      schemaVersion: 1,
      route,
      nextState,
      batchEvents,
      throughSequence,
    },
    control: {
      schemaVersion: 1,
      frameId: `collection-control:${state.iteration}:${triggeringEvent.eventId}`,
      kind: "collection-control",
      commands,
    },
  };
}

function rollCollectionWindow(
  state: EraServiceStateV1,
  event: EraTransportEventV1,
  previous: readonly EraTransportEventV1[],
): {
  readonly reduction: CollectionReductionV1;
  readonly control: CollectionControlV1;
} {
  const immediate =
    event.source === "timer" ||
    shouldCloseCollectionWindow(event.type, event.args) ||
    getCollectionWindowMs(event.type) <= 0;
  const dueAt =
    event.occurredAt + (immediate ? 0 : getCollectionWindowMs(event.type));
  const token = collectionTimerToken(event, dueAt);
  const commands: CollectionCommand[] = [...cancelCommand(state.timerToken)];
  commands.push({ kind: "schedule", token, dueAt });
  return collectionResult(
    state,
    event,
    "execute",
    collectionState(state, [event], event.encodedBytes, token),
    previous,
    commands,
  );
}

function reduceTimerEvent(
  state: EraServiceStateV1,
  event: EraTransportEventV1,
  combined: readonly EraTransportEventV1[],
  combinedBytes: number,
): {
  readonly reduction: CollectionReductionV1;
  readonly control: CollectionControlV1;
} {
  const token = receivedTimerToken(event);
  if (token !== null && token === state.timerToken) {
    return collectionResult(
      state,
      event,
      "execute",
      emptyCollectionState(state),
      combined,
      cancelCommand(state.timerToken),
    );
  }
  if (state.collection.length === 0) {
    return collectionResult(state, event, "execute", state, [event], []);
  }
  return collectionResult(
    state,
    event,
    "wait",
    collectionState(state, combined, combinedBytes, state.timerToken),
    [],
    [],
  );
}

function mergeProtocolSteps(
  domainSteps: readonly PlannedStepV1[],
  allEvents: readonly EraTransportEventV1[],
): readonly PlannedStepV1[] {
  const timerSteps: PlannedStepV1[] = allEvents
    .filter((event) => event.source === "timer")
    .map((event) => ({
      kind: "ignore",
      stepId: `step:timer:${event.sequence}:${event.eventId}`,
      index: 0,
      taskRoute: "ignore",
      sourceSequences: [event.sequence],
      events: [event],
      reason: "内部事件集定时器只负责关闭收集窗口，不执行领域任务",
    }));
  const combined = [...domainSteps, ...timerSteps];
  if (combined.length === 0 || combined.length > 128) {
    throw new RangeError("严格批次步骤数量必须位于 1..128");
  }
  return combined
    .sort(
      (left, right) =>
        (left.sourceSequences[0] ?? Number.MAX_SAFE_INTEGER) -
        (right.sourceSequences[0] ?? Number.MAX_SAFE_INTEGER),
    )
    .map<PlannedStepV1>((step, index) => ({
      ...step,
      index,
    }));
}

export function reduceForProtocolSlice(
  state: EraServiceStateV1,
  event: EraTransportEventV1,
  limits: Limits,
): {
  readonly reduction: CollectionReductionV1;
  readonly control: CollectionControlV1;
} {
  const previous = state.collection;
  const last = previous[previous.length - 1];
  if (last !== undefined && event.sequence <= last.sequence) {
    throw new Error("事件序号没有严格递增，服务携带状态可能损坏");
  }
  const maxEvents = readLimit(limits, "max_collection_events", 128);
  const maxBytes = readLimit(limits, "max_collection_bytes", 2097152);
  const recordedBytes = previous.reduce(
    (total, item) => total + item.encodedBytes,
    0,
  );
  if (
    previous.length > maxEvents ||
    state.collectionBytes > maxBytes ||
    recordedBytes !== state.collectionBytes
  ) {
    throw new Error("服务携带的事件集计数或字节数已经损坏");
  }
  if (event.encodedBytes > maxBytes || maxEvents < 1) {
    throw new RangeError("单事件无法放入 ERA 有界事件集");
  }

  const combinedBytes = state.collectionBytes + event.encodedBytes;
  if (
    previous.length > 0 &&
    (previous.length + 1 > maxEvents || combinedBytes > maxBytes)
  ) {
    return rollCollectionWindow(state, event, previous);
  }

  const combined = [...previous, event];
  if (event.source === "timer") {
    return reduceTimerEvent(state, event, combined, combinedBytes);
  }

  const domainBefore = previous.filter((item) => item.source !== "timer");
  const domainCombined = combined.filter((item) => item.source !== "timer");
  const closesImmediately =
    shouldCloseCollectionWindow(event.type, event.args) ||
    (domainBefore.length === 0 && getCollectionWindowMs(event.type) <= 0) ||
    hasImmediateCombo(domainCombined);
  if (closesImmediately) {
    const commands = cancelCommand(state.timerToken);
    return collectionResult(
      state,
      event,
      "execute",
      emptyCollectionState(state),
      combined,
      commands,
    );
  }

  if (state.timerToken !== null) {
    return collectionResult(
      state,
      event,
      "wait",
      collectionState(state, combined, combinedBytes, state.timerToken),
      [],
      [],
    );
  }

  const anchor = domainBefore[0] ?? event;
  const dueAt = anchor.occurredAt + getCollectionWindowMs(anchor.type);
  const token = collectionTimerToken(anchor, dueAt);
  return collectionResult(
    state,
    event,
    "wait",
    collectionState(state, combined, combinedBytes, token),
    [],
    [{ kind: "schedule", token, dueAt }],
  );
}

export function planProtocolBatch(
  reduction: CollectionReductionV1,
): BatchPlanV1 {
  if (
    reduction.route !== "execute" ||
    reduction.throughSequence === null ||
    reduction.batchEvents.length === 0
  ) {
    throw new Error("只有非空的 execute 归约结果可以规划批次");
  }
  const events = [...reduction.batchEvents];
  const sourceSequences = events.map((event) => event.sequence);
  const first = events[0] as EraTransportEventV1;
  const last = events[events.length - 1] as EraTransportEventV1;
  const domainEvents = events.filter((event) => event.source !== "timer");
  const domainSteps = planEventBatch(domainEvents);
  const domainCoverage = validateEventPlanCoverage(domainEvents, domainSteps);
  if (!domainCoverage.valid) {
    throw new Error(
      `纯事件规划器产生无效来源覆盖：${JSON.stringify(domainCoverage)}`,
    );
  }
  const steps = mergeProtocolSteps(
    domainSteps as readonly PlannedStepV1[],
    events,
  );
  return {
    schemaVersion: 1,
    batchId: `batch:${first.sequence}-${last.sequence}:${reduction.nextState.iteration}`,
    throughSequence: reduction.throughSequence,
    nextState: reduction.nextState,
    events,
    sourceSequences,
    steps,
  };
}

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
        step.taskRoute !== step.task.kind ||
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
