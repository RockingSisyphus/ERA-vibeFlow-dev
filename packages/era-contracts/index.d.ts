export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type MacroStoredStat =
  | { readonly kind: "present"; readonly value: unknown }
  | { readonly kind: "missing" }
  | { readonly kind: "projection-only" }
  | { readonly kind: "view"; readonly mode: "raw" | "lazy" | "prompt"; readonly statWithMeta: unknown; readonly statWithoutMeta: unknown };

export type MacroSnapshot = (
  | {
      readonly kind: "present";
      readonly statWithMeta: unknown;
      readonly statWithoutMeta: unknown;
    }
  | { readonly kind: "missing" }) & { readonly mode?: "raw" | "lazy" };

export interface MacroOccurrence {
  readonly decoded?: string | null;
  readonly substring: string;
  readonly path: string;
  readonly withMeta: boolean;
  readonly start: number;
  readonly end: number;
}

export type MacroOccurrencePlan = {
  readonly original: string;
  readonly snapshot: MacroSnapshot;
  readonly occurrences: readonly MacroOccurrence[];
};

export type MacroResolution =
  | {
      readonly kind: "preserve";
      readonly start: number;
      readonly end: number;
      readonly substring: string;
    }
  | {
      readonly kind: "missing";
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly kind: "value";
      readonly start: number;
      readonly end: number;
      readonly value: unknown;
    };

export type ResolvedMacroOccurrences = {
  readonly original: string;
  readonly resolutions: readonly MacroResolution[];
};


export interface MacroInputs {
  readonly substring: string;
  readonly storedStat: MacroStoredStat;
}

export interface MacroOutputs {
  readonly replacement: string;
}

export type EraTransportArg =
  | { readonly kind: "json"; readonly value: JsonValue }
  | { readonly kind: "undefined" }
  | {
      readonly kind: "host-ref";
      readonly token: string;
      readonly refKind: string;
    };

export interface EraTransportEventV1 {
  readonly schemaVersion: 1;
  readonly eventId: string;
  readonly sequence: number;
  readonly type: string;
  readonly occurredAt: number;
  readonly source: "tavern" | "ui" | "era-api" | "timer";
  readonly args: readonly EraTransportArg[];
  readonly encodedBytes: number;
}

export declare const ERA_COLLECTION_TIMER_EVENT_TYPE: "era.service.collection_timer";

export interface EraServiceConfigV1 {
  readonly max_event_bytes: number;
  readonly max_fifo_events: number;
  readonly max_fifo_bytes: number;
  readonly max_collection_events: number;
  readonly max_collection_bytes: number;
  readonly max_batch_steps: number;
  readonly barrier_watchdog_ms: number;
  readonly max_host_refs_per_event: number;
}

export declare const DEFAULT_ERA_SERVICE_CONFIG_V1: Readonly<EraServiceConfigV1>;

export interface EraSyncCursorV1 {
  readonly messageId: number;
  readonly mk: string;
  readonly blockIndex: number;
}

export interface EraServiceStateV1 {
  readonly schemaVersion: 1;
  readonly collection: readonly EraTransportEventV1[];
  readonly collectionBytes: number;
  readonly iteration: number;
  readonly consecutiveProcessingCount: number;
  readonly consecutiveMk: string | null;
  readonly timerToken: string | null;
  /**
   * 消息内函数调用的块级续做游标；未接通写入时为 null。
   *
   * 校验器（`isEraServiceStateV1`）把它算作服务状态的必填字段，因此这里必须声明，
   * 否则声明的 ABI 与实际接受的形状不一致。
   */
  readonly syncCursor: EraSyncCursorV1 | null;
  readonly scopeWindow: EraScopeWindowStateV1;
}

export interface EraScopeWindowStateV1 {
  readonly token: number | null;
  readonly messageId: number | null;
  readonly messageAdmission: boolean | null;
  readonly branchAdmission: boolean | null;
}

export type EraCollectionRouteV1 = "wait" | "execute";

export interface EraCollectionReductionV1 {
  readonly schemaVersion: 1;
  readonly route: EraCollectionRouteV1;
  readonly nextState: EraServiceStateV1;
  readonly batchEvents: readonly EraTransportEventV1[];
  readonly throughSequence: number | null;
}

export type EraDispatchClassV1 = "initialize" | "sync" | "api" | "update-mk";
export type EraExecutableTaskRouteV1 =
  EraDispatchClassV1 | "agent-generation-session";
export type EraTaskRouteV1 = EraExecutableTaskRouteV1 | "ignore";
export type EraEventRelationV1 = "primary" | "combined" | "coalesced";
export type EraTaskContextRequirementV1 =
  "none" | "latest-message" | "latest-message-with-mk";

export interface EraTavernMessageV2 {
  readonly schemaVersion: 2;
  readonly messageId: number;
  readonly role: string;
  readonly activeText: string;
  readonly swipeIndex: number | null;
  readonly candidate: Readonly<{
    exists: boolean;
    generation: number | null;
    predecessor: number | null;
    phase: "idle" | "preparing" | "generating" | "completed" | "cancelled";
  }>;
}

export interface EraTavernMessageContextV2 {
  readonly schemaVersion: 2;
  readonly messages: readonly EraTavernMessageV2[];
}

export interface EraDispatchContextV2 {
  readonly schemaVersion: 2;
  readonly status: "ready" | "failed";
  readonly dispatchClass: EraDispatchClassV1 | "ignore";
  readonly requirement: EraTaskContextRequirementV1;
  readonly messages: readonly EraTavernMessageV2[];
  readonly processingMessage: EraTavernMessageV2 | null;
  readonly processingMk: string | null;
  readonly messageChanged: boolean;
  readonly variablesChanged: boolean;
  readonly failure: EraFailureV1 | null;
}

export interface GenerationCycleIdentityV1 {
  readonly chatId: string;
  readonly eventId: string;
  readonly sourceKey: string;
}

export interface EraFloorIdentityV1 {
  readonly chatId: string;
  readonly messageId: number;
  readonly swipeId: number;
  readonly mk: string;
}

export interface EraStagedMessageUpdateV1 {
  readonly messageId: number;
  readonly content: string;
}

export interface EraAgentFloorCandidateV1 {
  readonly messageId: number;
  readonly swipeId: number;
  readonly mk: string;
  readonly content: string;
  readonly extra: Readonly<Record<string, JsonValue>>;
  readonly terminalStatus: "settled" | "story-complete" | "unsettled";
  readonly requiresInitialPresentation: boolean;
}

export interface EraDispatchContextV3 {
  readonly schemaVersion: 3;
  readonly status: "ready" | "failed";
  readonly dispatchClass: EraDispatchClassV1 | "ignore";
  readonly requirement: EraTaskContextRequirementV1;
  readonly messages: readonly EraTavernMessageV2[];
  readonly processingMessage: EraTavernMessageV2 | null;
  readonly processingMk: string | null;
  readonly messageChanged: boolean;
  readonly variablesChanged: boolean;
  readonly failure: EraFailureV1 | null;
  readonly generationCycleIdentity: GenerationCycleIdentityV1 | null;
  readonly floorIdentity: EraFloorIdentityV1 | null;
  readonly stagedMessageUpdates: readonly EraStagedMessageUpdateV1[];
  readonly agentFloorCandidate: EraAgentFloorCandidateV1 | null;
  /** 启用时采用的楼内状态栏标记，供最终消息写入判断是否需要首次呈现。 */
  readonly statusbarPlaceholder?: string;
  /** 本次计算实际读取的宿主事实；只在事务内存中保留，不持久化。 */
  readonly sourceBasis?: EraMessageSourceBasisV1;
}

export interface EraMessageSourceBasisV1 {
  readonly identity: Readonly<{
    characterId: string | null;
    chatId: string;
    groupId: string | null;
  }>;
  readonly messages: readonly EraTavernMessageV2[];
}
export type EraSyncReasonV1 =
  | "history-changed"
  | "edited"
  | "swipe-regeneration"
  | "manual"
  | "facade-commit";
export type EraSyncTargetV1 =
  | { readonly kind: "auto" }
  | {
      readonly kind: "message";
      readonly messageId: number;
      readonly stopAfterTarget: boolean;
    }
  | {
      readonly kind: "previous-of-latest";
      readonly stopAfterTarget: true;
    };

export interface EraDomainTaskBaseV1 {
  readonly id: string;
  readonly sourceEvents: readonly EraTransportEventV1[];
  readonly primaryEvent: EraTransportEventV1;
  readonly context: EraTaskContextRequirementV1;
}

export interface EraInitializeTaskV1 extends EraDomainTaskBaseV1 {
  readonly kind: "initialize";
  readonly operation: "startup" | "resources" | "settings-update";
  readonly args: readonly EraTransportArg[];
}

export interface EraSyncTaskV1 extends EraDomainTaskBaseV1 {
  readonly kind: "sync";
  readonly reason: EraSyncReasonV1;
  readonly target: EraSyncTargetV1;
  readonly fullRebuild: boolean;
}

export interface EraApiTaskV1 extends EraDomainTaskBaseV1 {
  readonly kind: "api";
  readonly intent: "query" | "message-write" | "state-sync";
  readonly eventType: string;
  readonly args: readonly EraTransportArg[];
}

export interface EraUpdateMkTaskV1 extends EraDomainTaskBaseV1 {
  readonly kind: "update-mk";
}

export type EraDomainTaskV1 =
  EraInitializeTaskV1 | EraSyncTaskV1 | EraApiTaskV1 | EraUpdateMkTaskV1;

export interface EraPlannedSourceV1 {
  readonly event: EraTransportEventV1;
  readonly relation: EraEventRelationV1;
}

interface EraPlannedStepBaseV1 {
  readonly stepId: string;
  readonly index: number;
  readonly taskRoute: EraTaskRouteV1;
  readonly sourceSequences: readonly number[];
  readonly events: readonly EraTransportEventV1[];
}

export type EraPlannedStepV1 =
  | (EraPlannedStepBaseV1 & {
      readonly kind: "execute";
      readonly taskRoute: EraExecutableTaskRouteV1;
      /** Agent 路由包装既有领域任务；关闭功能时必须原样委托 task.kind。 */
      readonly task: EraDomainTaskV1;
      readonly sources: readonly EraPlannedSourceV1[];
    })
  | (EraPlannedStepBaseV1 & {
      readonly kind: "ignore";
      readonly taskRoute: "ignore";
      readonly reason: string;
    });

export interface EraBatchPlanV1 {
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly throughSequence: number;
  readonly nextState: EraServiceStateV1;
  readonly events: readonly EraTransportEventV1[];
  readonly sourceSequences: readonly number[];
  readonly steps: readonly EraPlannedStepV1[];
}

export interface EraFailureV1 {
  readonly code: string;
  readonly message: string;
  readonly category: "input" | "domain" | "tavern" | "cancelled";
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export type EraSettlementV1 =
  | {
      readonly eventId: string;
      readonly sequence: number;
      readonly status: "completed";
      readonly taskId: string;
      readonly relation: "primary" | "combined" | "coalesced";
      readonly value?: JsonValue;
    }
  | {
      readonly eventId: string;
      readonly sequence: number;
      readonly status: "ignored";
      readonly reason: string;
    }
  | {
      readonly eventId: string;
      readonly sequence: number;
      readonly status: "failed";
      readonly error: EraFailureV1;
    }
  | {
      readonly eventId: string;
      readonly sequence: number;
      readonly status: "cancelled";
      readonly reason: string;
    };

export interface EraNotificationV1 {
  readonly type: string;
  readonly args: readonly EraTransportArg[];
}

export interface EraDiagnosticV1 {
  readonly code: string;
  readonly message: string;
  readonly sequence: number | null;
}

export type EraTaskStatusV1 = "committed" | "deferred" | "no-op" | "failed" | "fatal";

export interface EraTaskStateUpdateV1 {
  readonly consecutiveMk: string | null;
  readonly consecutiveProcessingCount: number;
  /**
   * 消息内函数调用的块级续做游标；只有计算中的楼层才有值，算完即回到 null。
   */
  readonly syncCursor?: EraSyncCursorV1 | null;
  readonly scopeWindow?: EraScopeWindowStateV1;
}

export interface EraTaskResultV1 {
  readonly status: EraTaskStatusV1;
  readonly settlements: readonly EraSettlementV1[];
  readonly notifications: readonly EraNotificationV1[];
  readonly diagnostics: readonly EraDiagnosticV1[];
  readonly stateUpdate?: EraTaskStateUpdateV1;
}

export interface EraExecutionSourceV1 {
  readonly eventId: string;
  readonly sequence: number;
}

export interface EraBatchExecutionStateV1 {
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly throughSequence: number;
  readonly nextState: EraServiceStateV1;
  readonly sources: readonly EraExecutionSourceV1[];
  readonly steps: readonly EraPlannedStepV1[];
  readonly index: number;
  readonly settlements: readonly EraSettlementV1[];
  readonly notifications: readonly EraNotificationV1[];
  readonly diagnostics: readonly EraDiagnosticV1[];
  readonly fatal: boolean;
  readonly coverageError: string | null;
}

export type EraBatchExecutionStateNextV1 = EraBatchExecutionStateV1;
export type EraBatchExecutionStateAfterV1 = EraBatchExecutionStateV1;
export type EraStepRequestV1 = EraPlannedStepV1;
export type EraStepRequestRoutedV1 = EraPlannedStepV1 & {
  readonly dispatchContext: EraDispatchContextV2 | EraDispatchContextV3;
};

export interface EraBatchFinalizationV1 {
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly throughSequence: number;
  readonly nextState: EraServiceStateV1;
  readonly settlements: readonly EraSettlementV1[];
  readonly notifications: readonly EraNotificationV1[];
  readonly diagnostics: readonly EraDiagnosticV1[];
  readonly fatal: boolean;
}

export declare function isEraTavernMessageV2(
  value: unknown,
): value is EraTavernMessageV2;
export declare function isEraTavernMessageContextV2(
  value: unknown,
): value is EraTavernMessageContextV2;
export declare function isEraDispatchContextV2(
  value: unknown,
): value is EraDispatchContextV2;
export declare function isEraDispatchContextV3(
  value: unknown,
): value is EraDispatchContextV3;

/** 把宿主或领域值克隆为无原型的可移植 JSON。 */
export declare function cloneEraPortableJsonV1(value: unknown): JsonValue;

/** 仅用于公开对象 API 的 legacy-safe-object-v1 安全物化。 */
export declare function normalizeLegacySafeObjectV1(value: unknown): {
  readonly [key: string]: JsonValue;
};

export type EraCollectionCommandV1 =
  | {
      readonly kind: "schedule";
      readonly token: string;
      readonly dueAt: number;
    }
  | {
      readonly kind: "cancel";
      readonly token: string;
    };

export interface EraCollectionControlV1 {
  readonly schemaVersion: 1;
  readonly frameId: string;
  readonly kind: "collection-control";
  readonly commands: readonly EraCollectionCommandV1[];
}

export interface EraBatchResultV1 {
  readonly schemaVersion: 1;
  readonly frameId: string;
  readonly kind: "batch-result";
  readonly throughSequence: number;
  readonly settlements: readonly EraSettlementV1[];
  readonly notifications: readonly EraNotificationV1[];
  readonly diagnostics: readonly EraDiagnosticV1[];
  readonly fatal: boolean;
}

export declare function isJsonValue(value: unknown): value is JsonValue;
export declare function isPresentMacroStoredStat(
  value: unknown,
): value is Extract<MacroStoredStat, { readonly kind: "present" }>;
export declare function missingMacroStoredStat(): Readonly<{
  kind: "missing";
}>;
export declare function isEraTransportArg(
  value: unknown,
): value is EraTransportArg;
export declare function isEraTransportEventV1(
  value: unknown,
): value is EraTransportEventV1;
export declare function countEraHostRefs(event: EraTransportEventV1): number;
export declare function isEraServiceConfigV1(
  value: unknown,
): value is EraServiceConfigV1;
export declare function isEraServiceStateV1(
  value: unknown,
): value is EraServiceStateV1;
export declare function isEraDomainTaskV1(
  value: unknown,
): value is EraDomainTaskV1;
export declare function isEraPlannedSourceV1(
  value: unknown,
): value is EraPlannedSourceV1;
export declare function isEraPlannedStepV1(
  value: unknown,
): value is EraPlannedStepV1;
export declare function isEraFailureV1(value: unknown): value is EraFailureV1;
export declare function isEraSettlementV1(
  value: unknown,
): value is EraSettlementV1;
export declare function isEraNotificationV1(
  value: unknown,
): value is EraNotificationV1;
export declare function isEraDiagnosticV1(
  value: unknown,
): value is EraDiagnosticV1;
export declare function isEraSyncCursorV1(
  value: unknown,
): value is EraSyncCursorV1;
export declare function isEraTaskStateUpdateV1(
  value: unknown,
): value is EraTaskStateUpdateV1;
export declare function isEraTaskResultV1(
  value: unknown,
): value is EraTaskResultV1;
export declare function isEraCollectionControlV1(
  value: unknown,
): value is EraCollectionControlV1;
export declare function isEraBatchResultV1(
  value: unknown,
): value is EraBatchResultV1;
