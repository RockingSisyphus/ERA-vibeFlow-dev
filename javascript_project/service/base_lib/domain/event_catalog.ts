import type {
EraDomainTaskV1,
EraEventRelationV1,
EraPlannedSourceV1,
EraPlannedStepV1,
EraSyncReasonV1,
EraSyncTargetV1,
EraTaskContextRequirementV1,
EraTransportEventV1
} from "@era/vibeflow-contracts";

export const API_FACADE_COMMIT = "era.facade.commit";
export const API_FACADE_SYNC = "era.facade.sync";

export const EVENT_APP_READY = "app_ready";
export const EVENT_MESSAGE_SWIPED = "message_swiped";
export const EVENT_MESSAGE_SENT = "message_sent";
export const EVENT_MESSAGE_RECEIVED = "message_received";
export const EVENT_MESSAGE_EDITED = "message_edited";
export const EVENT_MESSAGE_DELETED = "message_deleted";
export const EVENT_MESSAGE_UPDATED = "message_updated";
export const EVENT_CHAT_CHANGED = "chat_id_changed";
export const EVENT_GENERATION_STARTED = "generation_started";
export const EVENT_GENERATION_STOPPED = "generation_stopped";
export const EVENT_MANUAL_WRITE = "manual_write";
export const EVENT_MANUAL_SYNC = "manual_sync";
export const EVENT_MANUAL_FULL_SYNC = "manual_full_sync";
export const EVENT_UI_INITIALIZE_RESOURCES = "era.ui.initialize_resources";
export const EVENT_UI_UPDATE_SETTINGS = "era.ui.update_settings";
export const EVENT_UI_SIDECAR_BINDING_CHOICE = "era.ui.sidecar_binding_choice";
export const EVENT_UI_AGENT_CONFIGURATION = "era.ui.agent_configuration";
export const EVENT_UI_AGENT_RETRY = "era.ui.agent_retry";

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

export interface EventComboRuleV1 {
  readonly first: string;
  readonly next: string;
  readonly result: ComboSemantic;
  readonly maxIntervalMs: number;
  readonly immediate: boolean;
}

export const DEFAULT_COLLECTION_WINDOW_MS = 100;

export type ComboSemantic = "edit-and-continue" | "swipe-and-regenerate";

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

export type TaskBaseV1 = Pick<
  EraDomainTaskV1,
  "id" | "sourceEvents" | "primaryEvent" | "context"
>;
export type InitializeTaskV1 = Extract<
  EraDomainTaskV1,
  { readonly kind: "initialize" }
>;
export type SyncTaskV1 = Extract<EraDomainTaskV1, { readonly kind: "sync" }>;
export type ApiTaskV1 = Extract<EraDomainTaskV1, { readonly kind: "api" }>;

export interface WorkUnitV1 {
  readonly effectiveType: string;
  readonly primaryEvent: EraTransportEventV1;
  readonly sources: readonly EraPlannedSourceV1[];
  readonly combo?: ComboSemantic;
}

export type DraftExecuteStepV1 = Pick<ExecuteStepV1, "kind" | "task" | "sources"> & {
  readonly taskRoute?: ExecuteStepV1["taskRoute"];
};
export type DraftIgnoreStepV1 = Pick<IgnoreStepV1, "kind" | "events" | "reason">;
export type DraftPlanStepV1 = DraftExecuteStepV1 | DraftIgnoreStepV1;

export interface OrderedStepV1 {
  readonly firstSequence: number;
  readonly step: DraftPlanStepV1;
}

export type TimedEventV1 = Pick<EraTransportEventV1, "type" | "occurredAt" | "args">;

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

export function isApiEventType(eventType: string): boolean {
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
  if (eventType === EVENT_UI_SIDECAR_BINDING_CHOICE) {
    return {
      type: eventType,
      group: "SYNC",
      listenerOrder: "normal",
      awaitMode: "detached",
      // Sidecar 绑定选择直接进入同步派发，不等待事件收集窗口。
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
