/**
 * ERA 酒馆服务 Host Extension。
 *
 * 本文件只拥有宿主接线与资源生命周期；事件合并、CRUD、同步、回滚和领域路由
 * 必须留在 VibeFlow 工作流中。为满足 AOT 资源所有权检查，相关小型组件以类的
 * 形式集中在同一个已登记 Host Extension 源文件中，不导入 node 或 base_lib。
 */

import type {
EraDiagnosticV1,
EraSettlementV1,
EraTransportEventV1
} from "@era/vibeflow-contracts";

export type {
EraBatchResultV1,
EraCollectionCommandV1,
EraDiagnosticV1,
EraNotificationV1,
EraSettlementV1,
EraTransportArg,
EraTransportEventV1,
JsonValue
} from "@era/vibeflow-contracts";

export interface EraWaitThroughOutcome {
  readonly eventId: string;
  readonly sequence: number;
  readonly outcome: EraSettlementV1;
}

export interface EraWaitThroughResult {
  readonly throughSequence: number;
  readonly outcomes: readonly EraWaitThroughOutcome[];
  readonly hasFailures: boolean;
}

export interface EraInboundReceipt {
  settle(outcome: EraSettlementV1): void;
}

export interface EraInboundEvent {
  readonly type: string;
  readonly source: "tavern" | "ui" | "era-api" | "timer";
  readonly args?: readonly unknown[];
  readonly occurredAt?: number;
  readonly receipt?: EraInboundReceipt;
}

export interface EraAdmissionAccepted {
  readonly accepted: true;
  readonly eventId: string;
  readonly sequence: number;
  readonly done: Promise<EraSettlementV1>;
  waitThrough(): Promise<EraWaitThroughResult>;
}

export interface EraAdmissionRejected {
  readonly accepted: false;
  readonly code:
    | "ERA_HOST_NOT_STARTED"
    | "ERA_HOST_STOPPING"
    | "ERA_HOST_FATAL"
    | "ERA_HOST_EVENT_INVALID"
    | "ERA_HOST_EVENT_TOO_LARGE"
    | "ERA_HOST_FIFO_FULL"
    | "ERA_HOST_TOO_MANY_REFS";
  readonly message: string;
}

export type EraAdmissionResult = EraAdmissionAccepted | EraAdmissionRejected;

export interface EraCapabilityCallContext {
  readonly signal: AbortSignal;
}

export type EraHostOperation = (
  input: Readonly<Record<string, unknown>>,
  context: EraCapabilityCallContext,
) => unknown;

export type EraAsyncHostOperation = (
  input: Readonly<Record<string, unknown>>,
  context: EraCapabilityCallContext,
) => unknown | Promise<unknown>;

export interface EraTavernCapabilityAdapter {
  readonly agent: {
    readonly await_native_completion: EraAsyncHostOperation;
    readonly read_context: EraAsyncHostOperation;
    readonly write_configuration: EraAsyncHostOperation;
    readonly capture_preset: EraHostOperation;
    readonly read_configuration_sources: EraHostOperation;
    readonly read_connection_state: EraHostOperation;
    readonly upsert_connection_profile: EraAsyncHostOperation;
    readonly delete_connection_profile: EraAsyncHostOperation;
    readonly clear_connection_profile_key: EraAsyncHostOperation;
    readonly list_connection_models: EraAsyncHostOperation;
    readonly list_connection_models_draft: EraAsyncHostOperation;
    readonly generate: EraAsyncHostOperation;
    readonly generate_story: EraAsyncHostOperation;
    readonly inject_once: EraHostOperation;
    readonly read_session_binding: EraHostOperation;
    readonly write_session: EraHostOperation;
    readonly clear_session: EraHostOperation;
    readonly create_error_message: EraAsyncHostOperation;
    readonly stop_native_generation: EraHostOperation;
  };
  readonly variables: {
    readonly read: EraAsyncHostOperation;
    readonly commit: EraAsyncHostOperation;
  };
  readonly messages: {
    readonly read_context: EraAsyncHostOperation;
    readonly update_content: EraAsyncHostOperation;
    readonly refresh: EraAsyncHostOperation;
  };
  readonly worldbook: {
    readonly read: EraAsyncHostOperation;
    readonly create: EraAsyncHostOperation;
    readonly bind: EraAsyncHostOperation;
    readonly replace_entries: EraAsyncHostOperation;
  };
  readonly regex: {
    readonly read: EraAsyncHostOperation;
    readonly upsert: EraAsyncHostOperation;
  };
  readonly character: {
    readonly patch_external_statusbar?: EraAsyncHostOperation;
    readonly patch_single_floor?: EraAsyncHostOperation;
    readonly read_greeting_refresh_context: EraHostOperation;
    readonly apply_greeting_refresh: EraAsyncHostOperation;
    readonly read_main_greeting: EraAsyncHostOperation;
    readonly write_main_greeting: EraAsyncHostOperation;
  };
  readonly identity: {
    readonly read: EraHostOperation;
  };
  /** 启动期脚本树的原始只读事实；分类规则保留在 workflow。 */
  readonly installation_scope: {
    readonly read: EraHostOperation;
  };
  /** Sidecar 的身份/files/UI 机械能力；绑定与迁移规则必须留在 workflow。 */
  readonly functions: {
    readonly begin: EraHostOperation;
    readonly next: EraAsyncHostOperation;
    readonly acknowledge: EraHostOperation;
    readonly release: EraHostOperation;
  };
  readonly sidecar: {
    readonly read_working: EraHostOperation;
    readonly write_working: EraHostOperation;
    readonly read_current: EraAsyncHostOperation;
    readonly read_record: EraAsyncHostOperation;
    readonly write_record: EraAsyncHostOperation;
    readonly commit_metadata: EraAsyncHostOperation;
    readonly create_id: EraHostOperation;
    readonly present_prompt: EraHostOperation;
    readonly clear_prompt: EraHostOperation;
  };
}

export interface EraTavernClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface EraPreparedNotification {
  readonly type: string;
  readonly args: readonly unknown[];
}

/**
 * 应用层实现此接口，并在 start() 前通过测试 context.adapter 或约定全局键注入。
 * subscribe 必须同步注册并返回同步注销函数；监听器返回明确的接纳结果与回执。
 */
export interface EraTavernHostAdapter extends EraTavernCapabilityAdapter {
  subscribe(
    listener: (event: EraInboundEvent) => EraAdmissionResult,
  ): () => void;
  notify(
    notification: EraPreparedNotification,
    context: EraCapabilityCallContext,
  ): void | Promise<void>;
  readonly clock?: EraTavernClock;
  warn?(message: string, details?: Readonly<Record<string, unknown>>): void;
  /** 应用接线层拥有的启动闸门；Host 只转交 workflow 已作出的结果。 */
  settleStartupGate?(decision: Readonly<Record<string, unknown>>): void;
}

export interface EraHostDiagnosticsSnapshot {
  readonly started: boolean;
  readonly stopping: boolean;
  readonly fatal: boolean;
  readonly accepted: number;
  readonly settled: number;
  readonly queueEvents: number;
  readonly queueBytes: number;
  readonly pendingReceipts: number;
  readonly timers: number;
  readonly hostRefs: number;
  readonly notifications: number;
  readonly portWaiters: number;
  readonly processedFrames: number;
  readonly nextSequence: number;
}

export interface EraHostExtensionConfig {
  readonly ports?: {
    readonly inbound?: string;
    readonly outbound?: string;
  };
  readonly limits?: {
    readonly max_event_bytes?: number;
    readonly max_fifo_events?: number;
    readonly max_fifo_bytes?: number;
    readonly max_host_refs_per_event?: number;
  };
  readonly barrier_watchdog_ms?: number;
  readonly adapter_global_key?: string;
  /** true 时先启动 Host capability，等 workflow 明确 allow 后才订阅 Tavern 事件。 */
  readonly staged_startup?: boolean;
}

export interface EraHostExtensionContext {
  readonly extensionId: string;
  readonly config: Readonly<EraHostExtensionConfig>;
  readonly signal: AbortSignal;
  /** 仅供 fake-host 测试或明确的自定义宿主装配使用。 */
  readonly adapter?: EraTavernHostAdapter;
}

export interface PortRequest {
  readonly port: string;
}

export interface PortSendRequest extends PortRequest {
  readonly value: unknown;
}

export interface PortCallOptions {
  readonly signal?: AbortSignal;
}

export interface PendingReceive {
  readonly cleanupSignal: () => void;
  readonly resolve: (value: { readonly value: EraTransportEventV1 }) => void;
  readonly reject: (reason?: unknown) => void;
}

export interface ReceiptRecord {
  readonly event: EraTransportEventV1;
  readonly external?: EraInboundReceipt;
  readonly done: Promise<EraSettlementV1>;
  readonly resolve: (outcome: EraSettlementV1) => void;
  settled: boolean;
}

export interface QueueEntry {
  readonly event: EraTransportEventV1;
}

export interface EncodedEvent {
  readonly event: EraTransportEventV1;
  readonly references: ReadonlyMap<string, unknown>;
}

export interface TimerRecord {
  readonly token: string;
  readonly dueAt: number;
  readonly handle: unknown;
}

export interface PreparedBatch {
  readonly throughSequence: number;
  readonly settlements: readonly EraSettlementV1[];
  readonly notifications: readonly EraPreparedNotification[];
  readonly diagnostics: readonly EraDiagnosticV1[];
  readonly fatal: boolean;
}

export interface PreparedNotifications {
  readonly values: readonly EraPreparedNotification[];
}

export interface LinkedSignal {
  readonly signal: AbortSignal;
  cleanup(): void;
}

export const DEFAULT_INBOUND_PORT = "era.service.in";
export const DEFAULT_OUTBOUND_PORT = "era.service.out";
export const DEFAULT_ADAPTER_GLOBAL_KEY = "__ERA_VIBEFLOW_SERVICE_ADAPTER__";
export const MAX_PROCESSED_FRAMES = 4096;


export function createHostExtension(): { start(): void; stop(): void } { return { start() {}, stop() {} }; }
