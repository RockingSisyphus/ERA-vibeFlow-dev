/**
 * ERA 酒馆服务 Host Extension。
 *
 * 本文件只拥有宿主接线与资源生命周期；事件合并、CRUD、同步、回滚和领域路由
 * 必须留在 VibeFlow 工作流中。为满足 AOT 资源所有权检查，相关小型组件以类的
 * 形式集中在同一个已登记 Host Extension 源文件中，不导入 node 或 base_lib。
 */

import type {
EraBatchResultV1,
EraNotificationV1,
EraSettlementV1,
EraTransportArg
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

import { HostAdmissionRuntime } from "./service_host_admission.ts";
import { abortReason,awaitWithAbort,cloneJsonValue,EraServiceHostError,linkSignals } from "./service_host_primitives.ts";
import type { EraPreparedNotification,EraWaitThroughResult,PreparedBatch,PreparedNotifications } from "./service_host_types.ts";
export abstract class HostSettlementRuntime extends HostAdmissionRuntime {
  protected prepareBatch(frame: EraBatchResultV1): PreparedBatch {
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
    };
  }

  protected prepareNotifications(
    value: readonly EraNotificationV1[],
  ): PreparedNotifications {
    const values: EraPreparedNotification[] = [];
    for (const notification of value) {
      const args = notification.args.map((arg) => this.decodeTransportArg(arg));
      const prepared = Object.freeze({
        type: notification.type,
        args: Object.freeze(args),
      });
      values.push(prepared);
    }
    return Object.freeze({
      values: Object.freeze(values),
    });
  }

  protected decodeTransportArg(value: EraTransportArg): unknown {
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

  protected applyBatch(batch: PreparedBatch): void {
    if (batch.fatal) this.fatalTransitioning = true;
    for (const settlement of batch.settlements) {
      this.settleRecord(settlement.sequence, settlement);
    }
    if (batch.fatal) this.latchFatal();
    for (const diagnostic of batch.diagnostics) {
      this.warn("ERA 工作流诊断。", {
        code: diagnostic.code,
        message: diagnostic.message,
        sequence: diagnostic.sequence,
      });
    }
  }

  protected settleRecord(sequence: number, outcome: EraSettlementV1): void {
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

  protected waitThrough(sequence: number): Promise<EraWaitThroughResult> {
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

  protected scheduleNotifications(
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
}

export function createHostExtension(): { start(): void; stop(): void } { return { start() {}, stop() {} }; }
