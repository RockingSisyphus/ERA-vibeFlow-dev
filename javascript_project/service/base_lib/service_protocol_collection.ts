import { isJsonValue } from "@era/vibeflow-contracts";
import {
getCollectionWindowMs,
hasImmediateCombo,
planEventBatch,
shouldCloseCollectionWindow,
validateEventPlanCoverage,
} from "./domain/event_planner.ts";
import type {
BatchPlanV1,
CollectionCommand,
CollectionControlV1,
CollectionReductionV1,
EraServiceStateV1,
EraTransportArg,
EraTransportEventV1,
PlannedStepV1
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
TaskRoute
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
    syncCursor: null,
    scopeWindow: {
      token: null,
      messageId: null,
      messageAdmission: null,
      branchAdmission: null,
    },
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
