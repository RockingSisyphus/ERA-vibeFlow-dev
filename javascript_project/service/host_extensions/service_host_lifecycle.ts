/**
 * ERA 酒馆服务 Host Extension。
 *
 * 本文件只拥有宿主接线与资源生命周期；事件合并、CRUD、同步、回滚和领域路由
 * 必须留在 VibeFlow 工作流中。为满足 AOT 资源所有权检查，相关小型组件以类的
 * 形式集中在同一个已登记 Host Extension 源文件中，不导入 node 或 base_lib。
 */


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

import { abortReason,EraServiceHostError,throwIfAborted } from "./service_host_primitives.ts";
import { ServiceHostRuntimeBase } from "./service_host_runtime_base.ts";
import type { EraHostDiagnosticsSnapshot,EraTavernHostAdapter } from "./service_host_types.ts";
export abstract class HostLifecycleRuntime extends ServiceHostRuntimeBase {
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
      this.adapter = adapter;
      this.started = true;
      // 旧 Host 使用者保持 start 即订阅；ERA 主服务选择 staged_startup，
      // 将唯一 subscribe 推迟到 workflow 的 allow 分支。
      if (!this.stagedStartup) {
        this.activateIngress({ route: "allow", classification: "legacy" });
      }
    } catch (error) {
      this.context.signal.removeEventListener("abort", onContextAbort);
      this.contextAbortListener = null;
      this.adapter = null;
      throw error;
    }
  }

  /** 唯一的 Tavern listener 登记点，且对 allow 分支幂等。 */
  protected activateIngress(
    decision: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    if (!this.started || this.adapter === null) {
      throw new EraServiceHostError(
        "ERA_HOST_NOT_STARTED",
        "ERA 服务宿主尚未完成无监听器启动。",
      );
    }
    if (this.stopping) {
      throw new EraServiceHostError(
        "ERA_HOST_STOPPING",
        "ERA 服务宿主正在停止，不能登记事件入口。",
      );
    }
    if (this.unsubscribe === null) {
      const unsubscribe = this.adapter.subscribe((event) => this.admit(event));
      if (typeof unsubscribe !== "function") {
        throw new EraServiceHostError(
          "ERA_HOST_ADAPTER_SHAPE",
          "酒馆适配器 subscribe 必须返回注销函数。",
        );
      }
      this.unsubscribe = unsubscribe;
    }
    this.adapter.settleStartupGate?.(decision);
    return Object.freeze({ activated: true });
  }

  /** dormant 分支只结算启动闸门，绝不调用 subscribe。 */
  protected settleDormantStartup(
    decision: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    if (!this.started || this.adapter === null) {
      throw new EraServiceHostError(
        "ERA_HOST_NOT_STARTED",
        "ERA 服务宿主尚未完成无监听器启动。",
      );
    }
    this.adapter.settleStartupGate?.(decision);
    return Object.freeze({ activated: false });
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
      accepted: this.acceptedCount,
      settled: this.settledCount,
      queueEvents: this.queue.length,
      queueBytes: this.queue.bytes,
      pendingReceipts: this.receipts.size,
      timers:
        this.timers.size + this.delayedAdmissions.size + this.watchdogs.size,
      hostRefs: this.references.size,
      notifications: this.activeNotifications.size,
      portWaiters: this.pendingReceive === null ? 0 : 1,
      processedFrames: this.processedFrames.size,
      nextSequence: this.nextSequence,
    });
  }

  protected resolveAdapter(): EraTavernHostAdapter {
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

  protected validateAdapter(adapter: EraTavernHostAdapter): void {
    const required: ReadonlyArray<readonly [unknown, string]> = [
      [adapter.subscribe, "subscribe"],
      [adapter.notify, "notify"],
      [adapter.agent?.read_context, "agent.read_context"],
      [adapter.agent?.await_native_completion, "agent.await_native_completion"],
      [adapter.agent?.write_configuration, "agent.write_configuration"],
      [adapter.agent?.capture_preset, "agent.capture_preset"],
      [
        adapter.agent?.list_connection_models_draft,
        "agent.list_connection_models_draft",
      ],
      [adapter.agent?.read_connection_state, "agent.read_connection_state"],
      [
        adapter.agent?.upsert_connection_profile,
        "agent.upsert_connection_profile",
      ],
      [
        adapter.agent?.delete_connection_profile,
        "agent.delete_connection_profile",
      ],
      [
        adapter.agent?.clear_connection_profile_key,
        "agent.clear_connection_profile_key",
      ],
      [adapter.agent?.list_connection_models, "agent.list_connection_models"],
      [adapter.agent?.generate, "agent.generate"],
      [adapter.agent?.generate_story, "agent.generate_story"],
      [adapter.agent?.inject_once, "agent.inject_once"],
      [adapter.agent?.read_session_binding, "agent.read_session_binding"],
      [adapter.agent?.write_session, "agent.write_session"],
      [adapter.agent?.clear_session, "agent.clear_session"],
      [adapter.agent?.create_error_message, "agent.create_error_message"],
      [adapter.agent?.stop_native_generation, "agent.stop_native_generation"],
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
      [
        adapter.character?.read_greeting_refresh_context,
        "character.read_greeting_refresh_context",
      ],
      [
        adapter.character?.apply_greeting_refresh,
        "character.apply_greeting_refresh",
      ],
      [adapter.character?.read_main_greeting, "character.read_main_greeting"],
      [adapter.character?.write_main_greeting, "character.write_main_greeting"],
      [adapter.identity?.read, "identity.read"],
      [adapter.installation_scope?.read, "installation_scope.read"],
      [adapter.sidecar?.read_current, "sidecar.read_current"],
      [adapter.sidecar?.read_working, "sidecar.read_working"],
      [adapter.functions?.begin, "functions.begin"],
      [adapter.functions?.next, "functions.next"],
      [adapter.functions?.acknowledge, "functions.acknowledge"],
      [adapter.functions?.release, "functions.release"],
      [adapter.sidecar?.write_working, "sidecar.write_working"],
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
}

export function createHostExtension(): { start(): void; stop(): void } { return { start() {}, stop() {} }; }
