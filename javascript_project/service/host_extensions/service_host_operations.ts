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
export { EraServiceHostError } from "./service_host_primitives.ts";
export type { EncodedEvent,EraAdmissionAccepted,EraAdmissionRejected,EraAdmissionResult,EraAsyncHostOperation,EraCapabilityCallContext,EraHostDiagnosticsSnapshot,EraHostExtensionConfig,EraHostExtensionContext,EraHostOperation,EraInboundEvent,EraInboundReceipt,EraPreparedNotification,EraTavernCapabilityAdapter,EraTavernClock,EraTavernHostAdapter,EraWaitThroughOutcome,EraWaitThroughResult,LinkedSignal,PendingReceive,PortCallOptions,PortRequest,PortSendRequest,PreparedBatch,PreparedNotifications,QueueEntry,ReceiptRecord,TimerRecord } from "./service_host_types.ts";

import { abortReason,EraServiceHostError,linkSignals,throwIfAborted } from "./service_host_primitives.ts";
import { HostSettlementRuntime } from "./service_host_settlement.ts";
import type { EraHostDiagnosticsSnapshot,EraHostExtensionContext,EraTavernCapabilityAdapter,EraTavernClock,EraTavernHostAdapter,PortCallOptions } from "./service_host_types.ts";

class ServiceHostRuntime extends HostSettlementRuntime {
  protected invokeImmediate(
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

  /**
   * 密钥只能作为入站事件的宿主引用存在。Service 可机械转交该引用，
   * 但只有 Agent Host 边界会把它解析为页面实例闭包；引用正文不会进入工作流数据或回执。
   */
  protected resolveSecretReferenceInput(
    capability: keyof EraTavernCapabilityAdapter,
    operation: string,
    input: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    if (
      capability !== "agent" ||
      (operation !== "upsert_connection_profile" &&
        operation !== "list_connection_models_draft")
    ) {
      return input;
    }
    const reference = input.keyReference;
    if (!reference || typeof reference !== "object" || Array.isArray(reference))
      return input;
    const transport = reference as Readonly<Record<string, unknown>>;
    if (transport.kind !== "host-ref" || typeof transport.token !== "string")
      return input;
    const keyProvider = this.references.resolve(transport.token);
    if (typeof keyProvider !== "function") {
      throw new EraServiceHostError(
        "ERA_HOST_REF_KIND",
        "Agent 密钥宿主引用必须解析为页面实例闭包。",
      );
    }
    const { keyReference: _discarded, ...publicInput } = input;
    return Object.freeze({ ...publicInput, keyProvider });
  }

  protected invokeSuspend(
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
        result = callable.call(
          group,
          this.resolveSecretReferenceInput(capability, operation, input),
          {
            signal: linked.signal,
          },
        );
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

  protected fatalError(): EraServiceHostError {
    return new EraServiceHostError(
      "ERA_HOST_FATAL",
      "ERA 服务宿主已进入致命态。",
    );
  }

  protected throwIfFatal(): void {
    if (this.fatalTransitioning || this.fatalLatched) {
      throw this.fatalError();
    }
  }

  protected assertSendAvailable(): void {
    if (!this.started || this.stopping || this.lifecycle.signal.aborted) {
      throw new EraServiceHostError(
        "ERA_HOST_NOT_STARTED",
        "ERA 服务宿主未启动或正在停止。",
      );
    }
  }

  protected assertOperational(): void {
    this.assertSendAvailable();
    this.throwIfFatal();
  }

  protected latchFatal(): void {
    const error = this.fatalError();
    this.fatalTransitioning = false;
    this.fatalLatched = true;
    if (!this.operational.signal.aborted) this.operational.abort(error);
    this.rejectPendingReceive(error);
  }

  protected requireAdapter(): EraTavernHostAdapter {
    if (!this.adapter) {
      throw new EraServiceHostError(
        "ERA_HOST_ADAPTER_MISSING",
        "ERA 服务宿主没有已启动的酒馆适配器。",
      );
    }
    return this.adapter;
  }

  protected clock(): EraTavernClock {
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

  protected warn(
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

  protected rejectPendingReceive(reason: unknown): void {
    const pending = this.pendingReceive;
    if (!pending) return;
    this.pendingReceive = null;
    pending.cleanupSignal();
    pending.reject(reason);
  }

  protected async performStop(reason: unknown): Promise<void> {
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
    for (const key of this.delayedAdmissions.keys()) this.cancelAdmission(key);
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
    this.fatalTransitioning = false;
    this.fatalLatched = false;

    // 测试报告是 adapter 所属浏览器侧资源；停止时只请求清理，不在 Host 内
    // 解释 marker 或决定身份结果。
    if (this.adapter) {
      try {
        // lifecycle 已在上方中止；清理是 adapter 自己的资源释放，使用新的
        // 已激活 signal，避免把正常 teardown 误当成被取消的 capability 调用。
        this.adapter.sidecar.clear_prompt(
          {},
          { signal: new AbortController().signal },
        );
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
