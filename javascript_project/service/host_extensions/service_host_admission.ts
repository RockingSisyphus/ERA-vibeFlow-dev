/**
 * ERA 酒馆服务 Host Extension。
 *
 * 本文件只拥有宿主接线与资源生命周期；事件合并、CRUD、同步、回滚和领域路由
 * 必须留在 VibeFlow 工作流中。为满足 AOT 资源所有权检查，相关小型组件以类的
 * 形式集中在同一个已登记 Host Extension 源文件中，不导入 node 或 base_lib。
 */

import type {
EraCollectionCommandV1,
EraSettlementV1,
EraTransportArg,
EraTransportEventV1
} from "@era/vibeflow-contracts";
import {
ERA_COLLECTION_TIMER_EVENT_TYPE,
isEraBatchResultV1,
isEraCollectionControlV1,
isEraTransportEventV1
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

import { HostLifecycleRuntime } from "./service_host_lifecycle.ts";
import { abortReason,cloneJsonValue,deepFreeze,EraServiceHostError,finiteNumber,isRecord,linkSignals,refKind,rejectAdmission,stableStringify,utf8Bytes } from "./service_host_primitives.ts";
import type { EncodedEvent,EraAdmissionAccepted,EraAdmissionResult,EraInboundEvent,EraInboundReceipt,PortCallOptions,PortRequest,PortSendRequest,ReceiptRecord } from "./service_host_types.ts";
import { MAX_PROCESSED_FRAMES } from "./service_host_types.ts";
export abstract class HostAdmissionRuntime extends HostLifecycleRuntime {
  protected admit(input: EraInboundEvent): EraAdmissionResult {
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

  protected cancelAdmission(key: string): { status: string } {
    const pending = this.delayedAdmissions.get(key);
    if (pending) this.clock().clearTimeout(pending.handle);
    this.delayedAdmissions.delete(key);
    return { status: "cancelled" };
  }

  /** Execute only the delay policy supplied by a workflow, without choosing domain work. */
  protected scheduleAdmission(input: Readonly<Record<string, unknown>>): {
    status: string;
    dueAt: number;
  } {
    if (
      typeof input.key !== "string" ||
      !input.key ||
      !isRecord(input.event) ||
      !finiteNumber(input.delayMs) ||
      input.delayMs < 0 ||
      !finiteNumber(input.maxDelayMs) ||
      input.maxDelayMs < input.delayMs
    ) {
      throw new TypeError("延迟准入缺少有效事件、键或时间窗口。");
    }
    const key = input.key;
    const clock = this.clock();
    const firstAt = this.delayedAdmissions.get(key)?.firstAt ?? clock.now();
    this.cancelAdmission(key);
    const dueAt = Math.min(
      clock.now() + input.delayMs,
      firstAt + input.maxDelayMs,
    );
    const event = input.event as unknown as EraInboundEvent;
    const handle = clock.setTimeout(
      () => {
        this.delayedAdmissions.delete(key);
        const admission = this.admit(event);
        if (!admission.accepted)
          this.warn("延迟事件准入失败。", { key, code: admission.code });
      },
      Math.max(0, dueAt - clock.now()),
    );
    this.delayedAdmissions.set(key, { firstAt, handle });
    return { status: "scheduled", dueAt };
  }

  protected admitTimer(token: string): void {
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

  protected encodeEvent(
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

  protected createReceiptRecord(
    event: EraTransportEventV1,
    external?: EraInboundReceipt,
  ): ReceiptRecord {
    let resolve = (_outcome: EraSettlementV1): void => undefined;
    const done = new Promise<EraSettlementV1>((doneResolve) => {
      resolve = doneResolve;
    });
    return { event, external, done, resolve, settled: false };
  }

  protected deliverOrQueue(event: EraTransportEventV1): void {
    const pending = this.pendingReceive;
    if (!pending) {
      this.queue.push(event);
      return;
    }
    this.pendingReceive = null;
    pending.cleanupSignal();
    pending.resolve({ value: event });
  }

  protected receive(
    request: PortRequest,
    options: PortCallOptions,
  ): Promise<{ readonly value: EraTransportEventV1 }> {
    this.assertOperational();
    if (this.unsubscribe === null) {
      return Promise.reject(
        new EraServiceHostError(
          "ERA_HOST_INGRESS_INACTIVE",
          "ERA 服务入口尚未由启动工作流激活。",
        ),
      );
    }
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

  protected send(request: PortSendRequest, options: PortCallOptions): null {
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

  protected rememberFrame(frameId: string, fingerprint: string): void {
    this.processedFrames.set(frameId, fingerprint);
    if (this.processedFrames.size <= MAX_PROCESSED_FRAMES) return;
    const oldest = this.processedFrames.keys().next().value;
    if (typeof oldest === "string") this.processedFrames.delete(oldest);
  }

  protected applyCollectionCommand(command: EraCollectionCommandV1): void {
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

  protected cancelTimer(token: string): void {
    const existing = this.timers.get(token);
    if (!existing) return;
    this.clock().clearTimeout(existing.handle);
    this.timers.delete(token);
  }
}

export function createHostExtension(): { start(): void; stop(): void } { return { start() {}, stop() {} }; }
