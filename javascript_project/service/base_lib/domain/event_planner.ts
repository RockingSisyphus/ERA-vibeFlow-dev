import type {
  EraDomainTaskV1,
  EraEventRelationV1,
  EraPlannedStepV1,
  EraPlannedSourceV1,
  EraSyncReasonV1,
  EraSyncTargetV1,
  EraTaskContextRequirementV1,
  EraTransportArg,
  EraTransportEventV1,
  JsonValue,
} from "@era/vibeflow-contracts";

const API_FACADE_COMMIT = "era.facade.commit";
const API_FACADE_SYNC = "era.facade.sync";

const EVENT_APP_READY = "app_ready";
const EVENT_MESSAGE_SWIPED = "message_swiped";
const EVENT_MESSAGE_SENT = "message_sent";
const EVENT_MESSAGE_RECEIVED = "message_received";
const EVENT_MESSAGE_EDITED = "message_edited";
const EVENT_MESSAGE_DELETED = "message_deleted";
const EVENT_MESSAGE_UPDATED = "message_updated";
const EVENT_CHAT_CHANGED = "chat_id_changed";
const EVENT_GENERATION_STARTED = "generation_started";
const EVENT_GENERATION_STOPPED = "generation_stopped";
const EVENT_MANUAL_WRITE = "manual_write";
const EVENT_MANUAL_SYNC = "manual_sync";
const EVENT_MANUAL_FULL_SYNC = "manual_full_sync";
const EVENT_UI_INITIALIZE_RESOURCES = "era.ui.initialize_resources";
const EVENT_UI_UPDATE_SETTINGS = "era.ui.update_settings";
const EVENT_UI_SIDECAR_BINDING_CHOICE = "era.ui.sidecar_binding_choice";
const EVENT_UI_AGENT_CONFIGURATION = "era.ui.agent_configuration";
const EVENT_UI_AGENT_RETRY = "era.ui.agent_retry";
/** Host 在步骤之外执行完函数后，用该内部事件让 Service 恢复同一条消息。 */
const EVENT_MESSAGE_INVOKE_CONTINUE = "era.message.invoke_continue";

export type EventGroup =
  | "INIT"
  | "SYNC"
  | "API"
  | "UPDATE_MK_ONLY"
  | "COLLISION_DETECTORS"
  | "COMBO_STARTERS"
  | "DIRECTED_SYNC"
  | "UNKNOWN";

export type ListenerOrder = "first" | "normal" | "last";
export type AwaitMode = "detached" | "generation-barrier";

export interface EventDefinitionV1 {
  readonly type: string;
  readonly group: Exclude<EventGroup, "UNKNOWN">;
  readonly listenerOrder: ListenerOrder;
  readonly awaitMode: AwaitMode;
  readonly collectionWindowMs?: number;
  readonly closesCollectionWindow?: boolean;
}

interface EventComboRuleV1 {
  readonly first: string;
  readonly next: string;
  readonly result: ComboSemantic;
  readonly maxIntervalMs: number;
  readonly immediate: boolean;
}

export const DEFAULT_COLLECTION_WINDOW_MS = 100;

type ComboSemantic = "edit-and-continue" | "swipe-and-regenerate";

export type EventRelationV1 = EraEventRelationV1;
export type TaskContextRequirementV1 = EraTaskContextRequirementV1;
export type SyncReasonV1 = EraSyncReasonV1;
export type SyncTargetV1 = EraSyncTargetV1;
export type DomainTaskV1 = EraDomainTaskV1;
export type PlannedSourceV1 = EraPlannedSourceV1;
export type ExecuteStepV1 = Extract<
  EraPlannedStepV1,
  { readonly kind: "execute" }
>;
export type IgnoreStepV1 = Extract<
  EraPlannedStepV1,
  { readonly kind: "ignore" }
>;
export type EventPlanStepV1 = EraPlannedStepV1;

type TaskBaseV1 = Pick<
  EraDomainTaskV1,
  "id" | "sourceEvents" | "primaryEvent" | "context"
>;
type InitializeTaskV1 = Extract<
  EraDomainTaskV1,
  { readonly kind: "initialize" }
>;
type SyncTaskV1 = Extract<EraDomainTaskV1, { readonly kind: "sync" }>;
type ApiTaskV1 = Extract<EraDomainTaskV1, { readonly kind: "api" }>;

interface WorkUnitV1 {
  readonly effectiveType: string;
  readonly primaryEvent: EraTransportEventV1;
  readonly sources: readonly EraPlannedSourceV1[];
  readonly combo?: ComboSemantic;
}

type DraftExecuteStepV1 = Pick<ExecuteStepV1, "kind" | "task" | "sources"> & {
  readonly taskRoute?: ExecuteStepV1["taskRoute"];
};
type DraftIgnoreStepV1 = Pick<IgnoreStepV1, "kind" | "events" | "reason">;
type DraftPlanStepV1 = DraftExecuteStepV1 | DraftIgnoreStepV1;

interface OrderedStepV1 {
  readonly firstSequence: number;
  readonly step: DraftPlanStepV1;
}

type TimedEventV1 = Pick<EraTransportEventV1, "type" | "occurredAt" | "args">;

export interface EventPlanCoverageV1 {
  readonly valid: boolean;
  readonly duplicateBatchSequences: readonly number[];
  readonly duplicatePlannedSequences: readonly number[];
  readonly missingSequences: readonly number[];
  readonly outOfBatchSequences: readonly number[];
  readonly mismatchedEventIds: readonly number[];
}

/** 只返回公共 Facade 在 Service 内部使用的两个命令；它们不是 Tavern 事件 ABI。 */
export function getApiEventTypes(): readonly string[] {
  return [API_FACADE_COMMIT, API_FACADE_SYNC];
}

/** 返回酒馆与 ERA 内部入口的稳定事件名。 */
export function getInputEvents() {
  return {
    APP_READY: EVENT_APP_READY,
    MESSAGE_SWIPED: EVENT_MESSAGE_SWIPED,
    MESSAGE_SENT: EVENT_MESSAGE_SENT,
    MESSAGE_RECEIVED: EVENT_MESSAGE_RECEIVED,
    MESSAGE_EDITED: EVENT_MESSAGE_EDITED,
    MESSAGE_DELETED: EVENT_MESSAGE_DELETED,
    MESSAGE_UPDATED: EVENT_MESSAGE_UPDATED,
    CHAT_CHANGED: EVENT_CHAT_CHANGED,
    GENERATION_STARTED: EVENT_GENERATION_STARTED,
    GENERATION_STOPPED: EVENT_GENERATION_STOPPED,
    MANUAL_WRITE: EVENT_MANUAL_WRITE,
    MANUAL_SYNC: EVENT_MANUAL_SYNC,
    MANUAL_FULL_SYNC: EVENT_MANUAL_FULL_SYNC,
    UI_INITIALIZE_RESOURCES: EVENT_UI_INITIALIZE_RESOURCES,
    UI_UPDATE_SETTINGS: EVENT_UI_UPDATE_SETTINGS,
    UI_SIDECAR_BINDING_CHOICE: EVENT_UI_SIDECAR_BINDING_CHOICE,
    UI_AGENT_CONFIGURATION: EVENT_UI_AGENT_CONFIGURATION,
    UI_AGENT_RETRY: EVENT_UI_AGENT_RETRY,
    MESSAGE_INVOKE_CONTINUE: EVENT_MESSAGE_INVOKE_CONTINUE,
  } as const;
}

/** 候选基线的事件分组；combo 是规划结果，不属于可监听输入事件。 */
export function getEventGroups() {
  return {
    INIT: [
      EVENT_APP_READY,
      EVENT_UI_INITIALIZE_RESOURCES,
      EVENT_UI_UPDATE_SETTINGS,
    ],
    SYNC: [
      EVENT_MANUAL_WRITE,
      EVENT_MESSAGE_RECEIVED,
      EVENT_MESSAGE_DELETED,
      EVENT_MESSAGE_SWIPED,
      EVENT_CHAT_CHANGED,
      EVENT_MANUAL_SYNC,
      EVENT_MANUAL_FULL_SYNC,
      EVENT_UI_SIDECAR_BINDING_CHOICE,
      EVENT_MESSAGE_INVOKE_CONTINUE,
    ],
    API: getApiEventTypes(),
    UPDATE_MK_ONLY: [EVENT_MESSAGE_SENT],
    COLLISION_DETECTORS: [EVENT_GENERATION_STARTED],
    COMBO_STARTERS: [EVENT_MESSAGE_UPDATED],
    DIRECTED_SYNC: [EVENT_MESSAGE_EDITED],
  } as const;
}

/** 返回 Host 应注册的完整输入事件列表。 */
export function getListenedEventTypes(): readonly string[] {
  return [
    EVENT_APP_READY,
    EVENT_UI_INITIALIZE_RESOURCES,
    EVENT_UI_UPDATE_SETTINGS,
    EVENT_UI_SIDECAR_BINDING_CHOICE,
    EVENT_UI_AGENT_CONFIGURATION,
    EVENT_UI_AGENT_RETRY,
    "era.agent.stage_continue",
    EVENT_MESSAGE_INVOKE_CONTINUE,
    EVENT_MANUAL_WRITE,
    EVENT_MESSAGE_RECEIVED,
    EVENT_MESSAGE_DELETED,
    EVENT_MESSAGE_SWIPED,
    EVENT_CHAT_CHANGED,
    EVENT_MANUAL_SYNC,
    EVENT_MANUAL_FULL_SYNC,
    ...getApiEventTypes(),
    EVENT_MESSAGE_SENT,
    EVENT_GENERATION_STARTED,
    EVENT_GENERATION_STOPPED,
    EVENT_MESSAGE_UPDATED,
    EVENT_MESSAGE_EDITED,
  ];
}

function isApiEventType(eventType: string): boolean {
  return eventType === API_FACADE_COMMIT || eventType === API_FACADE_SYNC;
}

export function getEventDefinition(
  eventType: string,
): EventDefinitionV1 | undefined {
  if (
    eventType === EVENT_UI_INITIALIZE_RESOURCES ||
    eventType === EVENT_UI_UPDATE_SETTINGS
  ) {
    return {
      type: eventType,
      group: "INIT",
      listenerOrder: "normal",
      awaitMode: "detached",
      collectionWindowMs: 0,
    };
  }
  if (
    eventType === EVENT_UI_SIDECAR_BINDING_CHOICE ||
    eventType === EVENT_MESSAGE_INVOKE_CONTINUE
  ) {
    return {
      type: eventType,
      group: "SYNC",
      listenerOrder: "normal",
      awaitMode: "detached",
      // 恢复事件是 Host 在函数结束后发出的定向恢复：不得再被收集窗口合并或延迟。
      collectionWindowMs: 0,
    };
  }
  if (
    eventType === EVENT_UI_AGENT_CONFIGURATION ||
    eventType === EVENT_UI_AGENT_RETRY
  ) {
    return {
      type: eventType,
      group: "UPDATE_MK_ONLY",
      listenerOrder: "normal",
      awaitMode: "detached",
      collectionWindowMs: 0,
    };
  }
  if (isApiEventType(eventType)) {
    return {
      type: eventType,
      group: "API",
      listenerOrder: "normal",
      awaitMode: "detached",
      collectionWindowMs: 0,
    };
  }
  switch (eventType) {
    case EVENT_APP_READY:
      return {
        type: eventType,
        group: "INIT",
        listenerOrder: "normal",
        awaitMode: "detached",
      };
    case EVENT_MANUAL_WRITE:
    case EVENT_MESSAGE_RECEIVED:
    case EVENT_MESSAGE_DELETED:
    case EVENT_CHAT_CHANGED:
    case EVENT_MANUAL_SYNC:
    case EVENT_MANUAL_FULL_SYNC:
      return {
        type: eventType,
        group: "SYNC",
        listenerOrder: "normal",
        awaitMode: "detached",
      };
    case EVENT_MESSAGE_SWIPED:
      return {
        type: eventType,
        group: "SYNC",
        listenerOrder: "normal",
        awaitMode: "detached",
        collectionWindowMs: 500,
      };
    case EVENT_MESSAGE_SENT:
      return {
        type: eventType,
        group: "UPDATE_MK_ONLY",
        listenerOrder: "first",
        awaitMode: "generation-barrier",
        collectionWindowMs: 0,
        closesCollectionWindow: true,
      };
    case EVENT_GENERATION_STARTED:
      return {
        type: eventType,
        group: "COLLISION_DETECTORS",
        listenerOrder: "first",
        awaitMode: "generation-barrier",
        collectionWindowMs: 0,
        closesCollectionWindow: true,
      };
    case EVENT_GENERATION_STOPPED:
      return {
        type: eventType,
        group: "UPDATE_MK_ONLY",
        listenerOrder: "normal",
        awaitMode: "detached",
        collectionWindowMs: 0,
      };
    case EVENT_MESSAGE_UPDATED:
      return {
        type: eventType,
        group: "COMBO_STARTERS",
        listenerOrder: "normal",
        awaitMode: "detached",
        collectionWindowMs: 1500,
      };
    case "era.agent.stage_continue":
    case EVENT_MESSAGE_EDITED:
      return {
        type: eventType,
        group: "DIRECTED_SYNC",
        listenerOrder: "normal",
        awaitMode: "detached",
      };
    default:
      return undefined;
  }
}

export function getEventGroup(eventType: string): EventGroup {
  return getEventDefinition(eventType)?.group ?? "UNKNOWN";
}

export function getCollectionWindowMs(eventType: string): number {
  return (
    getEventDefinition(eventType)?.collectionWindowMs ??
    DEFAULT_COLLECTION_WINDOW_MS
  );
}

/** 把无损传输参数还原为仅供领域判断使用的值；宿主引用仍保持标签。 */
export function readTransportArgument(
  argument: EraTransportArg | undefined,
): JsonValue | undefined | EraTransportArg {
  if (argument === undefined || argument.kind === "undefined") {
    return undefined;
  }
  return argument.kind === "json" ? argument.value : argument;
}

function isDryRunGeneration(event: TimedEventV1): boolean {
  return (
    event.type === EVENT_GENERATION_STARTED &&
    readTransportArgument(event.args[2]) === true
  );
}

/** 酒馆明确请求重新生成当前回复；普通生成、续写和静默生成不得触发回退。 */
function isRegenerateGeneration(event: TimedEventV1): boolean {
  return (
    event.type === EVENT_GENERATION_STARTED &&
    readTransportArgument(event.args[0]) === "regenerate" &&
    !isDryRunGeneration(event)
  );
}

/** swipe 组合与酒馆显式 regenerate 都要求在放行生成前恢复上一楼状态。 */
function needsPreviousMessageRollback(unit: WorkUnitV1): boolean {
  return (
    unit.combo === "swipe-and-regenerate" ||
    isRegenerateGeneration(unit.primaryEvent)
  );
}

export function shouldCloseCollectionWindow(
  eventType: string,
  args: readonly EraTransportArg[] = [],
): boolean {
  const definition = getEventDefinition(eventType);
  if (!definition?.closesCollectionWindow) {
    return false;
  }
  return !isDryRunGeneration({ type: eventType, args, occurredAt: 0 });
}

function sourceEvents(unit: WorkUnitV1): readonly EraTransportEventV1[] {
  return unit.sources.map((source) => source.event);
}

function taskBase(
  unit: WorkUnitV1,
  context: TaskContextRequirementV1,
): TaskBaseV1 {
  const sources = sourceEvents(unit);
  return {
    id: `task:${unit.combo ?? unit.effectiveType}:${sources
      .map((event) => event.eventId)
      .join("+")}`,
    sourceEvents: sources,
    primaryEvent: unit.primaryEvent,
    context,
  };
}

function syncTask(
  unit: WorkUnitV1,
  fields: Readonly<{
    reason: SyncReasonV1;
    target: SyncTargetV1;
    context: TaskContextRequirementV1;
    fullRebuild?: boolean;
  }>,
): SyncTaskV1 {
  return {
    ...taskBase(unit, fields.context),
    kind: "sync",
    reason: fields.reason,
    target: fields.target,
    fullRebuild: fields.fullRebuild ?? false,
  };
}

function isManualSyncEvent(eventType: string): boolean {
  return (
    eventType === EVENT_MANUAL_WRITE ||
    eventType === EVENT_MANUAL_SYNC ||
    eventType === EVENT_MANUAL_FULL_SYNC
  );
}

/**
 * 修复本地镜像只重试 Sidecar 文件提交，绝不能把 API/当前状态回退到聊天文本
 * 的全量重算结果。迁移、独立和复制则需要完整重放，才能把其受控恢复指令固化。
 */
function findComboRule(
  firstType: string,
  nextType: string,
): EventComboRuleV1 | undefined {
  if (
    firstType === EVENT_MESSAGE_UPDATED &&
    nextType === EVENT_GENERATION_STARTED
  ) {
    return {
      first: firstType,
      next: nextType,
      result: "edit-and-continue",
      maxIntervalMs: 1500,
      immediate: true,
    };
  }
  if (
    firstType === EVENT_MESSAGE_SWIPED &&
    nextType === EVENT_GENERATION_STARTED
  ) {
    return {
      first: firstType,
      next: nextType,
      result: "swipe-and-regenerate",
      maxIntervalMs: 600,
      immediate: true,
    };
  }
  return undefined;
}

function createDomainTask(unit: WorkUnitV1): DomainTaskV1 | null {
  if (needsPreviousMessageRollback(unit)) {
    return syncTask(unit, {
      reason: "swipe-regeneration",
      target: { kind: "previous-of-latest", stopAfterTarget: true },
      context: "latest-message",
    });
  }

  if (unit.combo === "edit-and-continue") {
    return syncTask(unit, {
      reason: "edited",
      target: { kind: "auto" },
      context: "latest-message-with-mk",
    });
  }

  const group = getEventGroup(unit.effectiveType);
  if (group === "INIT") {
    const operation: InitializeTaskV1["operation"] =
      unit.effectiveType === EVENT_UI_INITIALIZE_RESOURCES
        ? "resources"
        : unit.effectiveType === EVENT_UI_UPDATE_SETTINGS
          ? "settings-update"
          : "startup";
    return {
      ...taskBase(
        unit,
        operation === "startup" ? "latest-message-with-mk" : "none",
      ),
      kind: "initialize",
      operation,
      args: unit.primaryEvent.args,
    };
  }

  if (group === "SYNC") {
    return syncTask(unit, {
      reason: isManualSyncEvent(unit.effectiveType)
        ? "manual"
        : "history-changed",
      target: { kind: "auto" },
      context: "latest-message-with-mk",
      fullRebuild:
        unit.effectiveType === EVENT_MANUAL_FULL_SYNC ||
        unit.effectiveType === EVENT_UI_SIDECAR_BINDING_CHOICE,
    });
  }

  if (group === "DIRECTED_SYNC") {
    const messageId = readTransportArgument(unit.primaryEvent.args[0]);
    return syncTask(unit, {
      reason: "edited",
      target:
        typeof messageId === "number" &&
        Number.isInteger(messageId) &&
        messageId >= 0
          ? { kind: "message", messageId, stopAfterTarget: false }
          : { kind: "auto" },
      context: "latest-message-with-mk",
    });
  }

  if (group === "API") {
    const intent: ApiTaskV1["intent"] =
      unit.effectiveType === API_FACADE_SYNC ? "state-sync" : "message-write";
    return {
      ...taskBase(unit, "latest-message-with-mk"),
      kind: "api",
      intent,
      eventType: unit.effectiveType,
      args: unit.primaryEvent.args,
    };
  }

  if (group === "UPDATE_MK_ONLY") {
    return {
      ...taskBase(unit, "latest-message-with-mk"),
      kind: "update-mk",
    };
  }

  if (group === "COLLISION_DETECTORS") {
    return {
      ...taskBase(unit, "latest-message-with-mk"),
      kind: "update-mk",
    };
  }

  return null;
}

function usesAgentGenerationSession(unit: WorkUnitV1): boolean {
  return (
    unit.primaryEvent.type === EVENT_GENERATION_STARTED ||
    unit.primaryEvent.type === EVENT_GENERATION_STOPPED ||
    unit.primaryEvent.type === EVENT_MESSAGE_SENT ||
    unit.primaryEvent.type === EVENT_MESSAGE_RECEIVED ||
    unit.primaryEvent.type === EVENT_UI_AGENT_CONFIGURATION ||
    unit.primaryEvent.type === EVENT_UI_AGENT_RETRY ||
    unit.primaryEvent.type === "era.agent.stage_continue"
  );
}

function firstSequenceOf(events: readonly EraTransportEventV1[]): number {
  return Math.min(...events.map((event) => event.sequence));
}

/** 使用显式事件时间判断当前集合是否出现候选基线的立即组合。 */
export function hasImmediateCombo(events: readonly TimedEventV1[]): boolean {
  const candidates = events.filter((event) => !isDryRunGeneration(event));
  for (let index = 0; index < candidates.length - 1; index += 1) {
    const current = candidates[index];
    const next = candidates[index + 1];
    const rule = findComboRule(current.type, next.type);
    if (
      rule?.immediate &&
      next.type === rule.next &&
      !isDryRunGeneration(next) &&
      next.occurredAt - current.occurredAt <= rule.maxIntervalMs
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 把一个已按 sequence 排序的收集批次规划为领域任务或明确忽略步骤。
 * 每个输入来源保留 primary、combined 或 coalesced 关系。
 */
export function planEventBatch(
  events: readonly EraTransportEventV1[],
): readonly EventPlanStepV1[] {
  const units: WorkUnitV1[] = [];
  const ignored: OrderedStepV1[] = [];

  for (const event of events) {
    if (isDryRunGeneration(event)) {
      ignored.push({
        firstSequence: event.sequence,
        step: {
          kind: "ignore",
          events: [event],
          reason: `${event.type} 是 dry-run 预演，不参与真实生成组合`,
        },
      });
      continue;
    }

    const current: WorkUnitV1 = {
      effectiveType: event.type,
      primaryEvent: event,
      sources: [{ event, relation: "primary" }],
    };
    const previous = units.at(-1);
    if (previous === undefined) {
      units.push(current);
      continue;
    }

    const interval = event.occurredAt - previous.primaryEvent.occurredAt;
    const comboRule = findComboRule(
      previous.effectiveType,
      current.effectiveType,
    );
    if (comboRule !== undefined && interval <= comboRule.maxIntervalMs) {
      units.pop();
      units.push({
        effectiveType: current.effectiveType,
        primaryEvent: current.primaryEvent,
        combo: comboRule.result,
        sources: [...previous.sources, ...current.sources].map((source) => ({
          event: source.event,
          relation: "combined",
        })),
      });
      continue;
    }

    const shouldCoalesce =
      getEventGroup(previous.effectiveType) === "SYNC" &&
      getEventGroup(current.effectiveType) === "SYNC";
    if (shouldCoalesce) {
      units[units.length - 1] = {
        ...current,
        sources: [
          ...previous.sources.map((source) => ({
            event: source.event,
            relation: "coalesced" as const,
          })),
          ...current.sources,
        ],
      };
      continue;
    }

    units.push(current);
  }

  const ordered: OrderedStepV1[] = [...ignored];
  for (const unit of units) {
    const unitEvents = sourceEvents(unit);
    const task = createDomainTask(unit);
    if (task !== null) {
      ordered.push({
        firstSequence: firstSequenceOf(unitEvents),
        step: {
          kind: "execute",
          task,
          sources: unit.sources,
          ...(usesAgentGenerationSession(unit)
            ? { taskRoute: "agent-generation-session" as const }
            : {}),
        },
      });
      continue;
    }
    ordered.push({
      firstSequence: firstSequenceOf(unitEvents),
      step: {
        kind: "ignore",
        events: unitEvents,
        reason:
          getEventGroup(unit.effectiveType) === "COLLISION_DETECTORS"
            ? `${unit.effectiveType} 是生成栅栏检测事件，本身无需执行状态任务`
            : `${unit.effectiveType} 没有对应的领域任务`,
      },
    });
  }

  return ordered
    .sort((left, right) => left.firstSequence - right.firstSequence)
    .map(({ step }, index): EraPlannedStepV1 => {
      if (step.kind === "ignore") {
        return {
          ...step,
          stepId: `step:ignored:${step.events
            .map((event) => event.eventId)
            .join("+")}`,
          index,
          taskRoute: "ignore",
          sourceSequences: step.events.map((event) => event.sequence),
        };
      }
      const taskRoute = step.taskRoute ?? step.task.kind;
      const sourceSequences = step.sources.map(
        (source) => source.event.sequence,
      );
      const sourceEventList = step.sources.map((source) => source.event);
      return {
        ...step,
        stepId: `step:${step.task.id}`,
        index,
        taskRoute,
        sourceSequences,
        events: sourceEventList,
      };
    });
}

function uniqueSorted(values: readonly number[]): readonly number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function incrementCount(counts: Map<number, number>, sequence: number): void {
  counts.set(sequence, (counts.get(sequence) ?? 0) + 1);
}

/** 验证每个批次来源 sequence 恰好被一个计划步骤覆盖。 */
export function validateEventPlanCoverage(
  events: readonly EraTransportEventV1[],
  steps: readonly EventPlanStepV1[],
): EventPlanCoverageV1 {
  const expectedCounts = new Map<number, number>();
  const expectedIds = new Map<number, string>();
  for (const event of events) {
    incrementCount(expectedCounts, event.sequence);
    if (!expectedIds.has(event.sequence)) {
      expectedIds.set(event.sequence, event.eventId);
    }
  }

  const actualCounts = new Map<number, number>();
  const outOfBatch: number[] = [];
  const mismatchedIds: number[] = [];
  for (const step of steps) {
    const sources =
      step.kind === "execute"
        ? step.sources.map((source) => source.event)
        : step.events;
    for (const event of sources) {
      incrementCount(actualCounts, event.sequence);
      if (!expectedCounts.has(event.sequence)) {
        outOfBatch.push(event.sequence);
      } else if (expectedIds.get(event.sequence) !== event.eventId) {
        mismatchedIds.push(event.sequence);
      }
    }
  }

  const duplicateBatchSequences = uniqueSorted(
    [...expectedCounts.entries()]
      .filter(([, count]) => count !== 1)
      .map(([sequence]) => sequence),
  );
  const duplicatePlannedSequences = uniqueSorted(
    [...actualCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([sequence]) => sequence),
  );
  const missingSequences = uniqueSorted(
    [...expectedCounts.keys()].filter(
      (sequence) => (actualCounts.get(sequence) ?? 0) === 0,
    ),
  );
  const outOfBatchSequences = uniqueSorted(outOfBatch);
  const mismatchedEventIds = uniqueSorted(mismatchedIds);
  return {
    valid:
      duplicateBatchSequences.length === 0 &&
      duplicatePlannedSequences.length === 0 &&
      missingSequences.length === 0 &&
      outOfBatchSequences.length === 0 &&
      mismatchedEventIds.length === 0,
    duplicateBatchSequences,
    duplicatePlannedSequences,
    missingSequences,
    outOfBatchSequences,
    mismatchedEventIds,
  };
}
