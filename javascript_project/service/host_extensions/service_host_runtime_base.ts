/**
 * ERA 酒馆服务 Host Extension。
 *
 * 本文件只拥有宿主接线与资源生命周期；事件合并、CRUD、同步、回滚和领域路由
 * 必须留在 VibeFlow 工作流中。为满足 AOT 资源所有权检查，相关小型组件以类的
 * 形式集中在同一个已登记 Host Extension 源文件中，不导入 node 或 base_lib。
 */

import {
DEFAULT_ERA_SERVICE_CONFIG_V1
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
export type { EncodedEvent,EraAdmissionAccepted,EraAdmissionRejected,EraAdmissionResult,EraAsyncHostOperation,EraCapabilityCallContext,EraHostDiagnosticsSnapshot,EraHostExtensionConfig,EraHostExtensionContext,EraHostOperation,EraInboundEvent,EraInboundReceipt,EraPreparedNotification,EraTavernCapabilityAdapter,EraTavernClock,EraTavernHostAdapter,EraWaitThroughOutcome,EraWaitThroughResult,LinkedSignal,PendingReceive,PortCallOptions,PortRequest,PortSendRequest,PreparedBatch,PreparedNotifications,QueueEntry,ReceiptRecord,TimerRecord } from "./service_host_types.ts";

import { BoundedEventQueue,configuredNonNegativeInteger,configuredPositiveInteger,HostReferenceRegistry } from "./service_host_primitives.ts";
import type { EraHostExtensionContext,EraTavernHostAdapter,EraWaitThroughOutcome,PendingReceive,PortCallOptions,PortRequest,PortSendRequest,ReceiptRecord,TimerRecord } from "./service_host_types.ts";
import { DEFAULT_ADAPTER_GLOBAL_KEY,DEFAULT_INBOUND_PORT,DEFAULT_OUTBOUND_PORT } from "./service_host_types.ts";
export abstract class ServiceHostRuntimeBase {
  protected readonly inboundPort: string;
  protected readonly outboundPort: string;
  protected readonly maxEventBytes: number;
  protected readonly maxHostRefsPerEvent: number;
  protected readonly watchdogMs: number;
  protected readonly adapterGlobalKey: string;
  protected readonly stagedStartup: boolean;
  protected readonly queue: BoundedEventQueue;
  protected readonly references = new HostReferenceRegistry();
  protected readonly receipts = new Map<number, ReceiptRecord>();
  protected readonly failureLedger = new Map<number, EraWaitThroughOutcome>();
  protected readonly timers = new Map<string, TimerRecord>();
  protected readonly delayedAdmissions = new Map<
    string,
    { firstAt: number; handle: unknown }
  >();
  protected readonly watchdogs = new Set<unknown>();
  protected readonly processedFrames = new Map<string, string>();
  protected readonly activeNotifications = new Set<Promise<void>>();
  protected readonly lifecycle = new AbortController();
  protected readonly operational = new AbortController();

  protected adapter: EraTavernHostAdapter | null = null;
  protected unsubscribe: (() => void) | null = null;
  protected contextAbortListener: (() => void) | null = null;
  protected pendingReceive: PendingReceive | null = null;
  protected stopPromise: Promise<void> | null = null;
  protected started = false;
  protected stopping = false;
  protected fatalTransitioning = false;
  protected fatalLatched = false;
  protected nextSequence = 1;
  protected acceptedCount = 0;
  protected settledCount = 0;

  constructor(protected readonly context: EraHostExtensionContext) {
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
    this.stagedStartup = config.staged_startup === true;
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
    "era.lifecycle.admission": {
      schedule: (input: Readonly<Record<string, unknown>>) =>
        this.scheduleAdmission(input),
      cancel: (input: Readonly<Record<string, unknown>>) =>
        this.cancelAdmission(String(input.key)),
    },
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
    "era.tavern.agent": {
      await_native_completion: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend("agent", "await_native_completion", input, options),
      read_context: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("agent", "read_context", input, options),
      write_configuration: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("agent", "write_configuration", input, options),
      capture_preset: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("agent", "capture_preset", input, options),
      read_configuration_sources: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeImmediate(
          "agent",
          "read_configuration_sources",
          input,
          options,
        ),
      read_connection_state: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeImmediate("agent", "read_connection_state", input, options),
      upsert_connection_profile: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend(
          "agent",
          "upsert_connection_profile",
          input,
          options,
        ),
      delete_connection_profile: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend(
          "agent",
          "delete_connection_profile",
          input,
          options,
        ),
      clear_connection_profile_key: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend(
          "agent",
          "clear_connection_profile_key",
          input,
          options,
        ),
      list_connection_models: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend("agent", "list_connection_models", input, options),
      list_connection_models_draft: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend(
          "agent",
          "list_connection_models_draft",
          input,
          options,
        ),
      generate: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("agent", "generate", input, options),
      generate_story: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("agent", "generate_story", input, options),
      inject_once: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("agent", "inject_once", input, options),
      read_session_binding: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeImmediate("agent", "read_session_binding", input, options),
      write_session: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("agent", "write_session", input, options),
      clear_session: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("agent", "clear_session", input, options),
      create_error_message: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("agent", "create_error_message", input, options),
      stop_native_generation: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeImmediate("agent", "stop_native_generation", input, options),
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
    "era.tavern.character": {
      patch_single_floor: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend("character", "patch_single_floor", input, options),
      patch_external_statusbar: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend(
          "character",
          "patch_external_statusbar",
          input,
          options,
        ),
      read_greeting_refresh_context: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeImmediate(
          "character",
          "read_greeting_refresh_context",
          input,
          options,
        ),
      apply_greeting_refresh: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend(
          "character",
          "apply_greeting_refresh",
          input,
          options,
        ),
      read_main_greeting: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend("character", "read_main_greeting", input, options),
      write_main_greeting: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) =>
        this.invokeSuspend("character", "write_main_greeting", input, options),
    },
    "era.tavern.identity": {
      read: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("identity", "read", input, options),
    },
    "era.tavern.installation_scope": {
      read: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("installation_scope", "read", input, options),
    },
    "era.tavern.startup_gate": {
      activate: (input: Readonly<Record<string, unknown>>) =>
        this.activateIngress(input),
      dormant: (input: Readonly<Record<string, unknown>>) =>
        this.settleDormantStartup(input),
    },
    "era.tavern.functions": {
      begin: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("functions", "begin", input, options),
      next: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeSuspend("functions", "next", input, options),
      acknowledge: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("functions", "acknowledge", input, options),
      release: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("functions", "release", input, options),
    },
    "era.tavern.sidecar": {
      read_working: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("sidecar", "read_working", input, options),
      write_working: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("sidecar", "write_working", input, options),
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
      publish_snapshot: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("sidecar", "publish_snapshot", input, options),
      create_id: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("sidecar", "create_id", input, options),
      present_prompt: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("sidecar", "present_prompt", input, options),
      clear_prompt: (
        input: Readonly<Record<string, unknown>>,
        options: PortCallOptions = {},
      ) => this.invokeImmediate("sidecar", "clear_prompt", input, options),
    },
  } as const;
  protected abstract activateIngress(...args: any[]): any;
  protected abstract admit(...args: any[]): any;
  protected abstract admitTimer(...args: any[]): any;
  protected abstract applyBatch(...args: any[]): any;
  protected abstract applyCollectionCommand(...args: any[]): any;
  protected abstract assertOperational(...args: any[]): any;
  protected abstract assertSendAvailable(...args: any[]): any;
  protected abstract cancelAdmission(...args: any[]): any;
  protected abstract cancelTimer(...args: any[]): any;
  protected abstract clock(...args: any[]): any;
  protected abstract createReceiptRecord(...args: any[]): any;
  protected abstract decodeTransportArg(...args: any[]): any;
  protected abstract deliverOrQueue(...args: any[]): any;
  public abstract diagnosticsSnapshot(...args: any[]): any;
  protected abstract encodeEvent(...args: any[]): any;
  protected abstract fatalError(...args: any[]): any;
  protected abstract invokeImmediate(...args: any[]): any;
  protected abstract invokeSuspend(...args: any[]): any;
  protected abstract latchFatal(...args: any[]): any;
  protected abstract performStop(reason: unknown): Promise<void>;
  protected abstract prepareBatch(...args: any[]): any;
  protected abstract prepareNotifications(...args: any[]): any;
  protected abstract receive(...args: any[]): any;
  protected abstract rejectPendingReceive(...args: any[]): any;
  protected abstract rememberFrame(...args: any[]): any;
  protected abstract requireAdapter(...args: any[]): any;
  protected abstract resolveAdapter(...args: any[]): any;
  protected abstract resolveSecretReferenceInput(...args: any[]): any;
  protected abstract scheduleAdmission(...args: any[]): any;
  protected abstract scheduleNotifications(...args: any[]): any;
  protected abstract send(...args: any[]): any;
  protected abstract settleDormantStartup(...args: any[]): any;
  protected abstract settleRecord(...args: any[]): any;
  public abstract start(...args: any[]): any;
  public abstract stop(...args: any[]): any;
  protected abstract throwIfFatal(...args: any[]): any;
  protected abstract validateAdapter(...args: any[]): any;
  protected abstract waitThrough(...args: any[]): any;
  protected abstract warn(...args: any[]): any;
}

export function createHostExtension(): { start(): void; stop(): void } { return { start() {}, stop() {} }; }
