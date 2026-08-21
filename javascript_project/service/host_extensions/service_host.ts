/**
 * ERA 酒馆服务 Host Extension。
 *
 * 本文件只拥有宿主接线与资源生命周期；事件合并、CRUD、同步、回滚和领域路由
 * 必须留在 VibeFlow 工作流中。为满足 AOT 资源所有权检查，相关小型组件以类的
 * 形式集中在同一个已登记 Host Extension 源文件中，不导入 node 或 base_lib。
 */

import {
  DEFAULT_ERA_SERVICE_CONFIG_V1,
  ERA_COLLECTION_TIMER_EVENT_TYPE,
  isEraBatchResultV1,
  isEraCollectionControlV1,
  isEraTransportEventV1,
  isJsonValue,
} from "@era/vibeflow-contracts";
import type {
  EraBatchResultV1,
  EraCollectionCommandV1,
  EraDiagnosticV1,
  EraNotificationV1,
  EraSettlementV1,
  EraTransportArg,
  EraTransportEventV1,
  JsonValue,
} from "@era/vibeflow-contracts";

export type {
  EraBatchResultV1,
  EraCollectionCommandV1,
  EraDiagnosticV1,
  EraNotificationV1,
  EraSettlementV1,
  EraTransportArg,
  EraTransportEventV1,
  JsonValue,
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
  readonly identity: {
    readonly read: EraHostOperation;
  };
  /** Sidecar 的身份/files/UI 机械能力；绑定与迁移规则必须留在 workflow。 */
  readonly sidecar: {
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
}

export interface EraHostDiagnosticsSnapshot {
  readonly started: boolean;
  readonly stopping: boolean;
  readonly fatal: boolean;
  readonly cachedWriteDone: boolean;
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
}

export interface EraHostExtensionContext {
  readonly extensionId: string;
  readonly config: Readonly<EraHostExtensionConfig>;
  readonly signal: AbortSignal;
  /** 仅供 fake-host 测试或明确的自定义宿主装配使用。 */
  readonly adapter?: EraTavernHostAdapter;
}

interface PortRequest {
  readonly port: string;
}

interface PortSendRequest extends PortRequest {
  readonly value: unknown;
}

interface PortCallOptions {
  readonly signal?: AbortSignal;
}

interface PendingReceive {
  readonly cleanupSignal: () => void;
  readonly resolve: (value: { readonly value: EraTransportEventV1 }) => void;
  readonly reject: (reason?: unknown) => void;
}

interface ReceiptRecord {
  readonly event: EraTransportEventV1;
  readonly external?: EraInboundReceipt;
  readonly done: Promise<EraSettlementV1>;
  readonly resolve: (outcome: EraSettlementV1) => void;
  settled: boolean;
}

interface QueueEntry {
  readonly event: EraTransportEventV1;
}

interface EncodedEvent {
  readonly event: EraTransportEventV1;
  readonly references: ReadonlyMap<string, unknown>;
}

interface TimerRecord {
  readonly token: string;
  readonly dueAt: number;
  readonly handle: unknown;
}

interface PreparedBatch {
  readonly throughSequence: number;
  readonly settlements: readonly EraSettlementV1[];
  readonly notifications: readonly EraPreparedNotification[];
  readonly diagnostics: readonly EraDiagnosticV1[];
  readonly fatal: boolean;
  readonly cachedWriteDoneArgs: readonly unknown[] | null;
}

interface PreparedNotifications {
  readonly values: readonly EraPreparedNotification[];
  readonly cachedWriteDoneArgs: readonly unknown[] | null;
}

interface LinkedSignal {
  readonly signal: AbortSignal;
  cleanup(): void;
}

const DEFAULT_INBOUND_PORT = "era.service.in";
const DEFAULT_OUTBOUND_PORT = "era.service.out";
const DEFAULT_ADAPTER_GLOBAL_KEY = "__ERA_VIBEFLOW_SERVICE_ADAPTER__";
const MAX_PROCESSED_FRAMES = 4096;

/** Tavern 可观察的写入完成通知类型。 */
export const ERA_WRITE_DONE_NOTIFICATION_TYPE = "era:writeDone";

/** 仅在 Host 内部消费：请求重播最近一次 era:writeDone，不得透传给 Tavern。 */
export const ERA_INTERNAL_REPLAY_WRITE_DONE_NOTIFICATION_TYPE =
  "era:internal:replayWriteDone";

export class EraServiceHostError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EraServiceHostError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function configuredPositiveInteger(value: unknown, fallback: number): number {
  return positiveInteger(value) ? value : fallback;
}

function configuredNonNegativeInteger(
  value: unknown,
  fallback: number,
): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

function abortReason(signal: AbortSignal, fallback: string): unknown {
  return signal.reason ?? new EraServiceHostError("ERA_HOST_ABORTED", fallback);
}

function throwIfAborted(signal: AbortSignal, fallback: string): void {
  if (signal.aborted) throw abortReason(signal, fallback);
}

function linkSignals(
  signals: readonly (AbortSignal | undefined)[],
): LinkedSignal {
  const controller = new AbortController();
  const listeners: Array<readonly [AbortSignal, () => void]> = [];
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    const listener = () => controller.abort(signal.reason);
    signal.addEventListener("abort", listener, { once: true });
    listeners.push([signal, listener]);
  }
  return {
    signal: controller.signal,
    cleanup(): void {
      for (const [signal, listener] of listeners) {
        signal.removeEventListener("abort", listener);
      }
    },
  };
}

function awaitWithAbort<T>(
  operation: () => T | Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(abortReason(signal, "宿主异步操作已经取消。"));
  }
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const finish = (callback: () => void): void => {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () =>
      finish(() => reject(abortReason(signal, "宿主异步操作已经取消。")));
    signal.addEventListener("abort", onAbort, { once: true });
    let result: T | Promise<T>;
    try {
      result = operation();
    } catch (error) {
      finish(() => reject(error));
      return;
    }
    Promise.resolve(result).then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

function cloneJsonValue(
  value: unknown,
): { readonly ok: true; readonly value: JsonValue } | { readonly ok: false } {
  try {
    // Tavern Helper 在 iframe 中执行用户脚本；跨 realm 的普通对象拥有不同的
    // Object.prototype。先结构化克隆到 Host realm，再做 JsonValue 严格校验，
    // 可避免把合法 API detail 误编码为不可供 workflow 读取的 host-ref。
    const cloned = structuredClone(value);
    if (!isJsonValue(cloned)) return { ok: false };
    return {
      ok: true,
      value: deepFreeze(cloned as JsonValue),
    };
  } catch {
    return { ok: false };
  }
}

function refKind(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  const constructorName = (value as { constructor?: { name?: unknown } })
    .constructor?.name;
  return typeof constructorName === "string" && constructorName.length > 0
    ? constructorName
    : "object";
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      deepFreeze(item);
    }
    return Object.freeze(value);
  }
  return value;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function rejectAdmission(
  code: EraAdmissionRejected["code"],
  message: string,
): EraAdmissionRejected {
  return Object.freeze({ accepted: false, code, message });
}

class HostReferenceRegistry {
  private readonly values = new Map<string, unknown>();
  private readonly tokensBySequence = new Map<number, readonly string[]>();

  commit(sequence: number, references: ReadonlyMap<string, unknown>): void {
    const tokens = [...references.keys()];
    for (const [token, value] of references) this.values.set(token, value);
    if (tokens.length > 0) this.tokensBySequence.set(sequence, tokens);
  }

  resolve(token: string): unknown {
    if (!this.values.has(token)) {
      throw new EraServiceHostError(
        "ERA_HOST_REF_UNKNOWN",
        `宿主引用令牌不存在或已经释放：${token}`,
      );
    }
    return this.values.get(token);
  }

  release(sequence: number): void {
    const tokens = this.tokensBySequence.get(sequence) ?? [];
    for (const token of tokens) this.values.delete(token);
    this.tokensBySequence.delete(sequence);
  }

  clear(): void {
    this.values.clear();
    this.tokensBySequence.clear();
  }

  get size(): number {
    return this.values.size;
  }
}

class BoundedEventQueue {
  private readonly entries: QueueEntry[] = [];
  private byteCount = 0;

  constructor(
    private readonly maxEvents: number,
    private readonly maxBytes: number,
  ) {}

  canPush(bytes: number): boolean {
    return (
      this.entries.length < this.maxEvents &&
      this.byteCount + bytes <= this.maxBytes
    );
  }

  push(event: EraTransportEventV1): void {
    this.entries.push({ event });
    this.byteCount += event.encodedBytes;
  }

  shift(): EraTransportEventV1 | undefined {
    const entry = this.entries.shift();
    if (!entry) return undefined;
    this.byteCount -= entry.event.encodedBytes;
    return entry.event;
  }

  clear(): void {
    this.entries.splice(0, this.entries.length);
    this.byteCount = 0;
  }

  get length(): number {
    return this.entries.length;
  }

  get bytes(): number {
    return this.byteCount;
  }
}

class ServiceHostRuntime {
  private readonly inboundPort: string;
  private readonly outboundPort: string;
  private readonly maxEventBytes: number;
  private readonly maxHostRefsPerEvent: number;
  private readonly watchdogMs: number;
  private readonly adapterGlobalKey: string;
  private readonly queue: BoundedEventQueue;
  private readonly references = new HostReferenceRegistry();
  private readonly receipts = new Map<number, ReceiptRecord>();
  private readonly failureLedger = new Map<number, EraWaitThroughOutcome>();
  private readonly timers = new Map<string, TimerRecord>();
  private readonly watchdogs = new Set<unknown>();
  private readonly processedFrames = new Map<string, string>();
  private readonly activeNotifications = new Set<Promise<void>>();
  private readonly lifecycle = new AbortController();
  private readonly operational = new AbortController();

  private adapter: EraTavernHostAdapter | null = null;
  private unsubscribe: (() => void) | null = null;
  private contextAbortListener: (() => void) | null = null;
  private pendingReceive: PendingReceive | null = null;
  private stopPromise: Promise<void> | null = null;
  private started = false;
  private stopping = false;
  private fatalTransitioning = false;
  private fatalLatched = false;
  private cachedWriteDoneArgs: readonly unknown[] | null = null;
  private nextSequence = 1;
  private acceptedCount = 0;
  private settledCount = 0;

  constructor(private readonly context: EraHostExtensionContext) {
    const config = context.config ?? {};
    this.inboundPort = config.ports?.inbound ?? DEFAULT_INBOUND_PORT;
    this.outboundPort = config.ports?.outbound ?? DEFAULT_OUTBOUND_PORT;
    this.maxEventBytes = configuredPositiveInteger(
      config.limits?.max_event_bytes,
      DEFAULT_ERA_SERVICE_CONFIG_V1.max_event_bytes,
    );
    this.maxHostRefsPerEvent = configuredPositiveInteger(
      config.limits?.max_host_refs_per_event,
      DEFAULT_ERA_SERVICE_CONFIG_V1.max_host_refs_per_event,
    );
    this.watchdogMs = configuredNonNegativeInteger(
      config.barrier_watchdog_ms,
      DEFAULT_ERA_SERVICE_CONFIG_V1.barrier_watchdog_ms,
    );
    this.adapterGlobalKey =
      config.adapter_global_key?.trim() || DEFAULT_ADAPTER_GLOBAL_KEY;
    this.queue = new BoundedEventQueue(
      configuredPositiveInteger(
        config.limits?.max_fifo_events,
        DEFAULT_ERA_SERVICE_CONFIG_V1.max_fifo_events,
      ),
      configuredPositiveInteger(
        config.limits?.max_fifo_bytes,
        DEFAULT_ERA_SERVICE_CONFIG_V1.max_fifo_bytes,
      ),
    );
  }

  readonly capabilities = {
    "vibeflow.port": {
      receive: (request: PortRequest, options: PortCallOptions = {}) =>
        this.receive(request, options),
      send: (request: PortSendRequest, options: PortCallOptions = {}) =>
        this.send(request, options),
    },
    "era.tavern.variables": {
      read: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("variables", "read", input, options),
      commit: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("variables", "commit", input, options),
    },
    "era.tavern.messages": {
      read_context: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("messages", "read_context", input, options),
      update_content: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("messages", "update_content", input, options),
      refresh: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("messages", "refresh", input, options),
    },
    "era.tavern.worldbook": {
      read: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("worldbook", "read", input, options),
      create: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("worldbook", "create", input, options),
      bind: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("worldbook", "bind", input, options),
      replace_entries: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("worldbook", "replace_entries", input, options),
    },
    "era.tavern.regex": {
      read: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("regex", "read", input, options),
      upsert: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("regex", "upsert", input, options),
    },
    "era.tavern.identity": {
      read: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("identity", "read", input, options),
    },
    "era.tavern.sidecar": {
      read_current: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("sidecar", "read_current", input, options),
      read_record: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("sidecar", "read_record", input, options),
      write_record: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("sidecar", "write_record", input, options),
      commit_metadata: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("sidecar", "commit_metadata", input, options),
      create_id: (input: Readonly<Record<string, unknown>>, options: PortCallOptions = {}) =>
        this.invokeImmediate("sidecar", "create_id", input, options),
      present_prompt: (input: Readonly<Record<string, unknown>>, options: PortCallOptions = {}) =>
        this.invokeImmediate("sidecar", "present_prompt", input, options),
      clear_prompt: (input: Readonly<Record<string, unknown>>, options: PortCallOptions = {}) =>
        this.invokeImmediate("sidecar", "clear_prompt", input, options),
    },
  } as const;

  start(): void {
    if (this.started) return;
    if (this.stopping || this.stopPromise) {
      throw new EraServiceHostError(
        "ERA_HOST_STOPPED",
        "已经停止的 ERA 服务宿主不能重新启动。",
      );
    }
    throwIfAborted(this.context.signal, "ERA 服务宿主在启动前已经取消。");
    const adapter = this.resolveAdapter();
    this.validateAdapter(adapter);

    const onContextAbort = () => {
      if (!this.lifecycle.signal.aborted) {
        this.lifecycle.abort(this.context.signal.reason);
      }
      this.rejectPendingReceive(
        abortReason(this.context.signal, "ERA 服务宿主已经取消。"),
      );
    };
    this.context.signal.addEventListener("abort", onContextAbort, {
      once: true,
    });
    this.contextAbortListener = onContextAbort;

    try {
      const unsubscribe = adapter.subscribe((event) => this.admit(event));
      if (typeof unsubscribe !== "function") {
        throw new EraServiceHostError(
          "ERA_HOST_ADAPTER_SHAPE",
          "酒馆适配器 subscribe 必须返回注销函数。",
        );
      }
      this.adapter = adapter;
      this.unsubscribe = unsubscribe;
      this.started = true;
    } catch (error) {
      this.context.signal.removeEventListener("abort", onContextAbort);
      this.contextAbortListener = null;
      this.adapter = null;
      throw error;
    }
  }

  stop(reason: unknown = "ERA 服务宿主已停止"): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = this.performStop(reason);
    return this.stopPromise;
  }

  diagnosticsSnapshot(): EraHostDiagnosticsSnapshot {
    return Object.freeze({
      started: this.started,
      stopping: this.stopping,
      fatal: this.fatalLatched || this.fatalTransitioning,
      cachedWriteDone: this.cachedWriteDoneArgs !== null,
      accepted: this.acceptedCount,
      settled: this.settledCount,
      queueEvents: this.queue.length,
      queueBytes: this.queue.bytes,
      pendingReceipts: this.receipts.size,
      timers: this.timers.size + this.watchdogs.size,
      hostRefs: this.references.size,
      notifications: this.activeNotifications.size,
      portWaiters: this.pendingReceive === null ? 0 : 1,
      processedFrames: this.processedFrames.size,
      nextSequence: this.nextSequence,
    });
  }

  private resolveAdapter(): EraTavernHostAdapter {
    if (this.context.adapter) return this.context.adapter;
    const candidate = (globalThis as Record<string, unknown>)[
      this.adapterGlobalKey
    ];
    if (!candidate || typeof candidate !== "object") {
      throw new EraServiceHostError(
        "ERA_HOST_ADAPTER_MISSING",
        `启动前必须在 globalThis[${JSON.stringify(this.adapterGlobalKey)}] 注入酒馆适配器。`,
      );
    }
    return candidate as EraTavernHostAdapter;
  }

  private validateAdapter(adapter: EraTavernHostAdapter): void {
    const required: ReadonlyArray<readonly [unknown, string]> = [
      [adapter.subscribe, "subscribe"],
      [adapter.notify, "notify"],
      [adapter.variables?.read, "variables.read"],
      [adapter.variables?.commit, "variables.commit"],
      [adapter.messages?.read_context, "messages.read_context"],
      [adapter.messages?.update_content, "messages.update_content"],
      [adapter.messages?.refresh, "messages.refresh"],
      [adapter.worldbook?.read, "worldbook.read"],
      [adapter.worldbook?.create, "worldbook.create"],
      [adapter.worldbook?.bind, "worldbook.bind"],
      [adapter.worldbook?.replace_entries, "worldbook.replace_entries"],
      [adapter.regex?.read, "regex.read"],
      [adapter.regex?.upsert, "regex.upsert"],
      [adapter.identity?.read, "identity.read"],
      [adapter.sidecar?.read_current, "sidecar.read_current"],
      [adapter.sidecar?.read_record, "sidecar.read_record"],
      [adapter.sidecar?.write_record, "sidecar.write_record"],
      [adapter.sidecar?.commit_metadata, "sidecar.commit_metadata"],
      [adapter.sidecar?.create_id, "sidecar.create_id"],
      [adapter.sidecar?.present_prompt, "sidecar.present_prompt"],
      [adapter.sidecar?.clear_prompt, "sidecar.clear_prompt"],
    ];
    for (const [value, name] of required) {
      if (typeof value !== "function") {
        throw new EraServiceHostError(
          "ERA_HOST_ADAPTER_SHAPE",
          `酒馆适配器缺少操作：${name}`,
        );
      }
    }
  }

  private admit(input: EraInboundEvent): EraAdmissionResult {
    if (!this.started) {
      return rejectAdmission("ERA_HOST_NOT_STARTED", "ERA 服务宿主尚未启动。");
    }
    if (this.stopping || this.lifecycle.signal.aborted) {
      return rejectAdmission(
        "ERA_HOST_STOPPING",
        "ERA 服务宿主正在停止，不再接纳新事件。",
      );
    }
    if (this.fatalTransitioning || this.fatalLatched) {
      return rejectAdmission(
        "ERA_HOST_FATAL",
        "ERA 服务宿主已进入致命态，不再接纳新事件。",
      );
    }
    if (
      !input ||
      typeof input !== "object" ||
      typeof input.type !== "string" ||
      input.type.length === 0 ||
      !["tavern", "ui", "era-api", "timer"].includes(input.source) ||
      (input.source === "timer") !==
        (input.type === ERA_COLLECTION_TIMER_EVENT_TYPE) ||
      (input.occurredAt !== undefined && !finiteNumber(input.occurredAt)) ||
      (input.args !== undefined && !Array.isArray(input.args))
    ) {
      return rejectAdmission(
        "ERA_HOST_EVENT_INVALID",
        "宿主事件缺少合法的 type、source、occurredAt 或 args。",
      );
    }

    const sequence = this.nextSequence;
    let encoded: EncodedEvent;
    try {
      encoded = this.encodeEvent(
        {
          type: input.type,
          source: input.source,
          args: input.args ?? [],
          occurredAt: input.occurredAt ?? this.clock().now(),
        },
        sequence,
      );
    } catch (error) {
      if (
        error instanceof EraServiceHostError &&
        error.code === "ERA_HOST_TOO_MANY_REFS"
      ) {
        return rejectAdmission("ERA_HOST_TOO_MANY_REFS", error.message);
      }
      return rejectAdmission(
        "ERA_HOST_EVENT_INVALID",
        error instanceof Error ? error.message : "宿主事件无法编码。",
      );
    }

    if (encoded.event.encodedBytes > this.maxEventBytes) {
      return rejectAdmission(
        "ERA_HOST_EVENT_TOO_LARGE",
        `单事件 ${encoded.event.encodedBytes} 字节，超过 ${this.maxEventBytes} 字节限制。`,
      );
    }
    if (
      this.pendingReceive === null &&
      !this.queue.canPush(encoded.event.encodedBytes)
    ) {
      return rejectAdmission(
        "ERA_HOST_FIFO_FULL",
        "ERA 服务宿主 FIFO 已达到事件数或字节数上限。",
      );
    }

    this.nextSequence += 1;
    this.acceptedCount += 1;
    this.references.commit(sequence, encoded.references);
    const record = this.createReceiptRecord(encoded.event, input.receipt);
    this.receipts.set(sequence, record);
    this.deliverOrQueue(encoded.event);

    const accepted: EraAdmissionAccepted = {
      accepted: true,
      eventId: encoded.event.eventId,
      sequence,
      done: record.done,
      waitThrough: () => this.waitThrough(sequence),
    };
    return Object.freeze(accepted);
  }

  private admitTimer(token: string): void {
    const result = this.admit({
      type: ERA_COLLECTION_TIMER_EVENT_TYPE,
      source: "timer",
      occurredAt: this.clock().now(),
      args: [token],
    });
    if (!result.accepted) {
      this.warn("收集定时器事件未被接纳。", {
        token,
        code: result.code,
        message: result.message,
      });
    }
  }

  private encodeEvent(
    input: Required<Omit<EraInboundEvent, "receipt">>,
    sequence: number,
  ): EncodedEvent {
    const eventId = `${this.context.extensionId}:event:${sequence}`;
    const references = new Map<string, unknown>();
    const args: EraTransportArg[] = [];
    for (const value of input.args) {
      if (value === undefined) {
        args.push(Object.freeze({ kind: "undefined" }));
        continue;
      }
      const json = cloneJsonValue(value);
      if (json.ok) {
        args.push(Object.freeze({ kind: "json", value: json.value }));
        continue;
      }
      if (references.size >= this.maxHostRefsPerEvent) {
        throw new EraServiceHostError(
          "ERA_HOST_TOO_MANY_REFS",
          `单事件宿主引用超过 ${this.maxHostRefsPerEvent} 个限制。`,
        );
      }
      const token = `${eventId}:ref:${references.size + 1}`;
      references.set(token, value);
      args.push(
        Object.freeze({ kind: "host-ref", token, refKind: refKind(value) }),
      );
    }

    let encodedBytes = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const event: EraTransportEventV1 = {
        schemaVersion: 1,
        eventId,
        sequence,
        type: input.type,
        occurredAt: input.occurredAt,
        source: input.source,
        args: Object.freeze(args),
        encodedBytes,
      };
      const nextBytes = utf8Bytes(JSON.stringify(event));
      if (nextBytes === encodedBytes) {
        if (!isEraTransportEventV1(event)) {
          throw new EraServiceHostError(
            "ERA_HOST_EVENT_INVALID",
            "编码后的事件不满足 era-contracts 传输契约。",
          );
        }
        return { event: deepFreeze(event), references };
      }
      encodedBytes = nextBytes;
    }
    throw new EraServiceHostError(
      "ERA_HOST_EVENT_INVALID",
      "事件字节计数无法稳定。",
    );
  }

  private createReceiptRecord(
    event: EraTransportEventV1,
    external?: EraInboundReceipt,
  ): ReceiptRecord {
    let resolve = (_outcome: EraSettlementV1): void => undefined;
    const done = new Promise<EraSettlementV1>((doneResolve) => {
      resolve = doneResolve;
    });
    return { event, external, done, resolve, settled: false };
  }

  private deliverOrQueue(event: EraTransportEventV1): void {
    const pending = this.pendingReceive;
    if (!pending) {
      this.queue.push(event);
      return;
    }
    this.pendingReceive = null;
    pending.cleanupSignal();
    pending.resolve({ value: event });
  }

  private receive(
    request: PortRequest,
    options: PortCallOptions,
  ): Promise<{ readonly value: EraTransportEventV1 }> {
    this.assertOperational();
    if (!request || request.port !== this.inboundPort) {
      return Promise.reject(
        new EraServiceHostError(
          "ERA_HOST_PORT_UNKNOWN",
          `入站 Port 必须是 ${this.inboundPort}。`,
        ),
      );
    }
    if (this.pendingReceive) {
      return Promise.reject(
        new EraServiceHostError(
          "ERA_HOST_PORT_CONCURRENT_RECEIVE",
          "同一 ERA 服务宿主只允许一个挂起的 Port receive。",
        ),
      );
    }
    const event = this.queue.shift();
    if (event) return Promise.resolve({ value: event });

    const linked = linkSignals([
      this.lifecycle.signal,
      this.operational.signal,
      options.signal,
    ]);
    if (linked.signal.aborted) {
      const reason = abortReason(linked.signal, "Port receive 已取消。");
      linked.cleanup();
      return Promise.reject(reason);
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        if (this.pendingReceive?.reject !== reject) return;
        this.pendingReceive = null;
        linked.cleanup();
        reject(abortReason(linked.signal, "Port receive 已取消。"));
      };
      linked.signal.addEventListener("abort", onAbort, { once: true });
      this.pendingReceive = {
        cleanupSignal: () => {
          linked.signal.removeEventListener("abort", onAbort);
          linked.cleanup();
        },
        resolve,
        reject,
      };
    });
  }

  private send(request: PortSendRequest, options: PortCallOptions): null {
    this.assertSendAvailable();
    if (!request || request.port !== this.outboundPort) {
      throw new EraServiceHostError(
        "ERA_HOST_PORT_UNKNOWN",
        `出站 Port 必须是 ${this.outboundPort}。`,
      );
    }
    if (!isRecord(request.value)) {
      throw new EraServiceHostError(
        "ERA_HOST_FRAME_INVALID",
        "出站 frame 必须是对象。",
      );
    }
    const frame = request.value;
    const frameId = frame.frameId;
    if (typeof frameId !== "string" || frameId.length === 0) {
      throw new EraServiceHostError(
        "ERA_HOST_FRAME_INVALID",
        "出站 frame 缺少非空 frameId。",
      );
    }
    const fingerprint = stableStringify(frame);
    const previous = this.processedFrames.get(frameId);
    if (previous !== undefined) {
      if (previous !== fingerprint) {
        throw new EraServiceHostError(
          "ERA_HOST_FRAME_CONFLICT",
          `frameId ${frameId} 对应的内容发生冲突。`,
        );
      }
      return null;
    }
    this.throwIfFatal();
    if (isEraCollectionControlV1(frame)) {
      for (const command of frame.commands)
        this.applyCollectionCommand(command);
      this.rememberFrame(frameId, fingerprint);
      return null;
    }
    if (isEraBatchResultV1(frame)) {
      const batch = this.prepareBatch(frame);
      this.applyBatch(batch);
      this.rememberFrame(frameId, fingerprint);
      this.scheduleNotifications(batch.notifications, options.signal);
      return null;
    }
    throw new EraServiceHostError(
      "ERA_HOST_FRAME_INVALID",
      `未知的出站 frame 类型：${String(frame.kind)}`,
    );
  }

  private rememberFrame(frameId: string, fingerprint: string): void {
    this.processedFrames.set(frameId, fingerprint);
    if (this.processedFrames.size <= MAX_PROCESSED_FRAMES) return;
    const oldest = this.processedFrames.keys().next().value;
    if (typeof oldest === "string") this.processedFrames.delete(oldest);
  }

  private applyCollectionCommand(command: EraCollectionCommandV1): void {
    const token = command.token;
    if (command.kind === "cancel") {
      this.cancelTimer(token);
      return;
    }
    const dueAt = command.dueAt;
    const existing = this.timers.get(token);
    if (existing?.dueAt === dueAt) return;
    if (existing) this.cancelTimer(token);
    const clock = this.clock();
    const handle = clock.setTimeout(
      () => {
        const current = this.timers.get(token);
        if (!current || current.handle !== handle) return;
        this.timers.delete(token);
        this.admitTimer(token);
      },
      Math.max(0, dueAt - clock.now()),
    );
    this.timers.set(token, { token, dueAt, handle });
  }

  private cancelTimer(token: string): void {
    const existing = this.timers.get(token);
    if (!existing) return;
    this.clock().clearTimeout(existing.handle);
    this.timers.delete(token);
  }

  private prepareBatch(frame: EraBatchResultV1): PreparedBatch {
    const throughSequence = frame.throughSequence;
    const seen = new Set<number>();
    const settlements: EraSettlementV1[] = frame.settlements.map((value) => {
      const { sequence, eventId } = value;
      if (sequence > throughSequence || seen.has(sequence)) {
        throw new EraServiceHostError(
          "ERA_HOST_FRAME_INVALID",
          "settlement 的 eventId、sequence 或 status 非法或重复。",
        );
      }
      const record = this.receipts.get(sequence);
      if (!record || record.event.eventId !== eventId || record.settled) {
        throw new EraServiceHostError(
          "ERA_HOST_SETTLEMENT_CONFLICT",
          `事件 ${eventId}#${sequence} 没有待结算回执。`,
        );
      }
      seen.add(sequence);
      return value;
    });

    const requiredSequences = [...this.receipts.keys()]
      .filter((sequence) => sequence <= throughSequence)
      .sort((left, right) => left - right);
    if (
      requiredSequences.length !== seen.size ||
      requiredSequences.some((sequence) => !seen.has(sequence))
    ) {
      throw new EraServiceHostError(
        "ERA_HOST_SETTLEMENT_COVERAGE",
        `batch-result 未恰好覆盖 throughSequence=${throughSequence} 以内的全部回执。`,
      );
    }

    const notifications = this.prepareNotifications(frame.notifications);
    return {
      throughSequence,
      settlements: settlements.sort(
        (left, right) => left.sequence - right.sequence,
      ),
      notifications: notifications.values,
      diagnostics: frame.diagnostics,
      fatal: frame.fatal,
      cachedWriteDoneArgs: notifications.cachedWriteDoneArgs,
    };
  }

  private prepareNotifications(
    value: readonly EraNotificationV1[],
  ): PreparedNotifications {
    const values: EraPreparedNotification[] = [];
    let cachedWriteDoneArgs = this.cachedWriteDoneArgs;
    for (const notification of value) {
      if (
        notification.type ===
        ERA_INTERNAL_REPLAY_WRITE_DONE_NOTIFICATION_TYPE
      ) {
        if (notification.args.length !== 0) {
          throw new EraServiceHostError(
            "ERA_HOST_FRAME_INVALID",
            "内部 writeDone 重播命令不得携带参数。",
          );
        }
        if (cachedWriteDoneArgs !== null) {
          values.push(
            Object.freeze({
              type: ERA_WRITE_DONE_NOTIFICATION_TYPE,
              args: cachedWriteDoneArgs,
            }),
          );
        }
        continue;
      }
      const args = notification.args.map((arg) => this.decodeTransportArg(arg));
      const prepared = Object.freeze({
        type: notification.type,
        args: Object.freeze(args),
      });
      if (prepared.type === ERA_WRITE_DONE_NOTIFICATION_TYPE) {
        cachedWriteDoneArgs = prepared.args;
      }
      values.push(prepared);
    }
    return Object.freeze({
      values: Object.freeze(values),
      cachedWriteDoneArgs,
    });
  }

  private decodeTransportArg(value: EraTransportArg): unknown {
    if (value.kind === "undefined") {
      return undefined;
    }
    if (value.kind === "json") {
      const cloned = cloneJsonValue(value.value);
      if (!cloned.ok) {
        throw new EraServiceHostError(
          "ERA_HOST_FRAME_INVALID",
          "notification 的 json 参数不是可移植 JSON。",
        );
      }
      return cloned.value;
    }
    return this.references.resolve(value.token);
  }

  private applyBatch(batch: PreparedBatch): void {
    if (batch.fatal) this.fatalTransitioning = true;
    for (const settlement of batch.settlements) {
      this.settleRecord(settlement.sequence, settlement);
    }
    if (batch.fatal) this.latchFatal();
    this.cachedWriteDoneArgs = batch.cachedWriteDoneArgs;
    for (const diagnostic of batch.diagnostics) {
      this.warn("ERA 工作流诊断。", {
        code: diagnostic.code,
        message: diagnostic.message,
        sequence: diagnostic.sequence,
      });
    }
  }

  private settleRecord(sequence: number, outcome: EraSettlementV1): void {
    const record = this.receipts.get(sequence);
    if (!record || record.settled) {
      throw new EraServiceHostError(
        "ERA_HOST_SETTLEMENT_CONFLICT",
        `事件序号 ${sequence} 已结算或不存在。`,
      );
    }
    record.settled = true;
    this.receipts.delete(sequence);
    this.references.release(sequence);
    this.settledCount += 1;
    if (outcome.status === "failed" || outcome.status === "cancelled") {
      this.failureLedger.set(sequence, {
        eventId: record.event.eventId,
        sequence,
        outcome,
      });
    }
    record.resolve(outcome);
    try {
      record.external?.settle(outcome);
    } catch (error) {
      this.warn("宿主回执回调发生异常；内部回执已经完成。", {
        sequence,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private waitThrough(sequence: number): Promise<EraWaitThroughResult> {
    const previousFailures = [...this.failureLedger.values()].filter(
      (item) => item.sequence <= sequence,
    );
    const records = [...this.receipts.values()]
      .filter((record) => record.event.sequence <= sequence)
      .sort((left, right) => left.event.sequence - right.event.sequence);
    const startedAt = this.clock().now();
    let watchdogHandle: unknown;
    if (records.length > 0 && this.watchdogMs > 0) {
      watchdogHandle = this.clock().setTimeout(() => {
        this.watchdogs.delete(watchdogHandle);
        const pendingSequences = records
          .filter((record) => !record.settled)
          .map((record) => record.event.sequence);
        if (pendingSequences.length > 0) {
          this.warn("ERA 高水位屏障等待超过告警阈值；不会自动放行。", {
            throughSequence: sequence,
            pendingSequences,
            elapsedMs: this.clock().now() - startedAt,
          });
        }
      }, this.watchdogMs);
      this.watchdogs.add(watchdogHandle);
    }

    return (async () => {
      try {
        const pendingOutcomes = await Promise.all(
          records.map(async (record) => ({
            eventId: record.event.eventId,
            sequence: record.event.sequence,
            outcome: await record.done,
          })),
        );
        const outcomes = [...previousFailures, ...pendingOutcomes].sort(
          (left, right) => left.sequence - right.sequence,
        );
        return Object.freeze({
          throughSequence: sequence,
          outcomes: Object.freeze(outcomes),
          hasFailures: outcomes.some(
            (item) =>
              item.outcome.status === "failed" ||
              item.outcome.status === "cancelled",
          ),
        });
      } finally {
        if (watchdogHandle !== undefined) {
          if (this.watchdogs.delete(watchdogHandle)) {
            this.clock().clearTimeout(watchdogHandle);
          }
        }
        for (const failedSequence of this.failureLedger.keys()) {
          if (failedSequence <= sequence)
            this.failureLedger.delete(failedSequence);
        }
      }
    })();
  }

  private scheduleNotifications(
    notifications: readonly EraPreparedNotification[],
    invocationSignal?: AbortSignal,
  ): void {
    if (notifications.length === 0 || this.stopping) return;
    const adapter = this.requireAdapter();
    const linked = linkSignals([this.lifecycle.signal, invocationSignal]);
    let run: Promise<void> | null = null;
    run = (async () => {
      try {
        const pending = notifications.map((notification) => {
          if (linked.signal.aborted) {
            return Promise.reject(
              abortReason(linked.signal, "ERA 后置通知已取消。"),
            );
          }
          try {
            return awaitWithAbort(
              () => adapter.notify(notification, { signal: linked.signal }),
              linked.signal,
            );
          } catch (error) {
            return Promise.reject(error);
          }
        });
        const results = await Promise.allSettled(pending);
        for (const result of results) {
          if (result.status === "rejected") {
            this.warn("ERA 后置通知失败；状态结算不受影响。", {
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            });
          }
        }
      } finally {
        linked.cleanup();
        if (run) this.activeNotifications.delete(run);
      }
    })();
    this.activeNotifications.add(run);
  }

  private invokeImmediate(
    capability: keyof EraTavernCapabilityAdapter,
    operation: string,
    input: Readonly<Record<string, unknown>>,
    options: PortCallOptions,
  ): unknown {
    this.assertOperational();
    throwIfAborted(this.lifecycle.signal, "ERA 服务宿主已经取消。");
    throwIfAborted(this.operational.signal, "ERA 服务宿主已进入致命态。");
    if (options.signal) {
      throwIfAborted(options.signal, "ERA Capability 调用已经取消。");
    }
    const adapter = this.requireAdapter();
    const group = adapter[capability] as unknown as Record<string, unknown>;
    const callable = group[operation];
    if (typeof callable !== "function") {
      throw new EraServiceHostError(
        "ERA_HOST_ADAPTER_OPERATION_MISSING",
        `酒馆适配器缺少 ${String(capability)}.${operation}。`,
      );
    }
    const result = callable.call(group, input, {
      signal: options.signal ?? this.operational.signal,
    });
    if (
      result !== null &&
      (typeof result === "object" || typeof result === "function") &&
      typeof (result as { then?: unknown }).then === "function"
    ) {
      throw new EraServiceHostError(
        "ERA_HOST_IMMEDIATE_PROMISE",
        `${String(capability)}.${operation} 必须同步返回，不能返回 thenable。`,
      );
    }
    return result;
  }

  private invokeSuspend(
    capability: keyof EraTavernCapabilityAdapter,
    operation: string,
    input: Readonly<Record<string, unknown>>,
    options: PortCallOptions,
  ): Promise<unknown> {
    this.assertOperational();
    const adapter = this.requireAdapter();
    const group = adapter[capability] as unknown as Record<string, unknown>;
    const callable = group[operation];
    if (typeof callable !== "function") {
      return Promise.reject(
        new EraServiceHostError(
          "ERA_HOST_ADAPTER_OPERATION_MISSING",
          `酒馆适配器缺少 ${String(capability)}.${operation}。`,
        ),
      );
    }
    const linked = linkSignals([
      this.lifecycle.signal,
      this.operational.signal,
      options.signal,
    ]);
    if (linked.signal.aborted) {
      const reason = abortReason(linked.signal, "ERA Capability 调用已取消。");
      linked.cleanup();
      return Promise.reject(reason);
    }

    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (callback: () => void): void => {
        if (finished) return;
        finished = true;
        linked.signal.removeEventListener("abort", onAbort);
        linked.cleanup();
        callback();
      };
      const onAbort = () =>
        finish(() =>
          reject(abortReason(linked.signal, "ERA Capability 调用已取消。")),
        );
      linked.signal.addEventListener("abort", onAbort, { once: true });
      let result: unknown;
      try {
        result = callable.call(group, input, { signal: linked.signal });
      } catch (error) {
        finish(() => reject(error));
        return;
      }
      Promise.resolve(result).then(
        (value) => finish(() => resolve(value)),
        (error) => finish(() => reject(error)),
      );
    });
  }

  private fatalError(): EraServiceHostError {
    return new EraServiceHostError(
      "ERA_HOST_FATAL",
      "ERA 服务宿主已进入致命态。",
    );
  }

  private throwIfFatal(): void {
    if (this.fatalTransitioning || this.fatalLatched) {
      throw this.fatalError();
    }
  }

  private assertSendAvailable(): void {
    if (!this.started || this.stopping || this.lifecycle.signal.aborted) {
      throw new EraServiceHostError(
        "ERA_HOST_NOT_STARTED",
        "ERA 服务宿主未启动或正在停止。",
      );
    }
  }

  private assertOperational(): void {
    this.assertSendAvailable();
    this.throwIfFatal();
  }

  private latchFatal(): void {
    const error = this.fatalError();
    this.fatalTransitioning = false;
    this.fatalLatched = true;
    if (!this.operational.signal.aborted) this.operational.abort(error);
    this.rejectPendingReceive(error);
  }

  private requireAdapter(): EraTavernHostAdapter {
    if (!this.adapter) {
      throw new EraServiceHostError(
        "ERA_HOST_ADAPTER_MISSING",
        "ERA 服务宿主没有已启动的酒馆适配器。",
      );
    }
    return this.adapter;
  }

  private clock(): EraTavernClock {
    return (
      this.adapter?.clock ?? {
        now: () => Date.now(),
        setTimeout: (callback, delayMs) =>
          globalThis.setTimeout(callback, delayMs),
        clearTimeout: (handle) =>
          globalThis.clearTimeout(
            handle as ReturnType<typeof globalThis.setTimeout>,
          ),
      }
    );
  }

  private warn(
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ): void {
    try {
      if (this.adapter?.warn) {
        this.adapter.warn(message, details);
      } else {
        console.warn(message, details);
      }
    } catch (error) {
      console.error("ERA 服务宿主告警回调发生异常。", error);
    }
  }

  private rejectPendingReceive(reason: unknown): void {
    const pending = this.pendingReceive;
    if (!pending) return;
    this.pendingReceive = null;
    pending.cleanupSignal();
    pending.reject(reason);
  }

  private async performStop(reason: unknown): Promise<void> {
    this.stopping = true;
    this.started = false;
    if (!this.lifecycle.signal.aborted) this.lifecycle.abort(reason);
    if (!this.operational.signal.aborted) this.operational.abort(reason);
    this.rejectPendingReceive(reason);

    if (this.unsubscribe) {
      try {
        this.unsubscribe();
      } catch (error) {
        this.warn("注销酒馆事件监听器时发生异常。", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.unsubscribe = null;
    }
    if (this.contextAbortListener) {
      this.context.signal.removeEventListener(
        "abort",
        this.contextAbortListener,
      );
      this.contextAbortListener = null;
    }

    for (const timer of this.timers.values()) {
      this.clock().clearTimeout(timer.handle);
    }
    this.timers.clear();
    for (const watchdog of this.watchdogs) {
      this.clock().clearTimeout(watchdog);
    }
    this.watchdogs.clear();

    const pendingSequences = [...this.receipts.keys()].sort(
      (left, right) => left - right,
    );
    for (const sequence of pendingSequences) {
      const record = this.receipts.get(sequence);
      if (!record) continue;
      this.settleRecord(sequence, {
        eventId: record.event.eventId,
        sequence,
        status: "cancelled",
        reason: typeof reason === "string" ? reason : "ERA 服务宿主已停止",
      });
    }
    this.queue.clear();
    this.references.clear();
    this.failureLedger.clear();
    this.processedFrames.clear();
    this.cachedWriteDoneArgs = null;
    this.fatalTransitioning = false;
    this.fatalLatched = false;

    // 测试报告是 adapter 所属浏览器侧资源；停止时只请求清理，不在 Host 内
    // 解释 marker 或决定身份结果。
    if (this.adapter) {
      try {
        // lifecycle 已在上方中止；清理是 adapter 自己的资源释放，使用新的
        // 已激活 signal，避免把正常 teardown 误当成被取消的 capability 调用。
        this.adapter.sidecar.clear_prompt({}, { signal: new AbortController().signal });
      } catch (error) {
        this.warn("清理 ERA Sidecar 绑定弹窗时发生异常。", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    while (this.activeNotifications.size > 0) {
      await Promise.allSettled([...this.activeNotifications]);
    }
    this.adapter = null;
  }
}

export interface EraServiceHostExtensionInstance {
  readonly capabilities: ServiceHostRuntime["capabilities"];
  readonly diagnostics: {
    snapshot(): EraHostDiagnosticsSnapshot;
  };
  start(): void;
  stop(): Promise<void>;
}

/**
 * 工厂仅创建隔离状态，不注册 Tavern listener、不启动 timer，也不执行 workflow。
 */
export function createHostExtension(
  context: EraHostExtensionContext,
): EraServiceHostExtensionInstance {
  const runtime = new ServiceHostRuntime(context);
  return Object.freeze({
    capabilities: runtime.capabilities,
    diagnostics: Object.freeze({
      snapshot: () => runtime.diagnosticsSnapshot(),
    }),
    start: () => runtime.start(),
    stop: () => runtime.stop(),
  });
}
