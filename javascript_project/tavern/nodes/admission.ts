import {ERA_COLLECTION_TIMER_EVENT_TYPE, isEraTransportEventV1, isJsonValue} from "../base_lib/contracts.ts";
import {emit, takeFrame, rejection, route, EraServiceHostError} from "../base_lib/frames.ts";
import {deferred} from "../base_lib/resources.ts";

export function CheckEvent(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  const input = f.input;
  // 展示连接随实例关闭而失效；保留其原拒绝码，直接宿主调用仍使用下面的宿主状态码。
  // 致命态在实际资源清理完成前保持原领域拒绝码；关闭前缀不能盖掉故障原因。
  if (s && (s.fatalTransitioning || s.fatalLatched))
    f.rejected = rejection("ERA_HOST_FATAL", "ERA 服务宿主已进入致命态，不再接纳新事件。");
  else if (f.origin === "presentation" && (!s?.started || s.stopping || s.lifecycle.signal.aborted))
    f.rejected = rejection("ERA_APP_SERVICE_UNAVAILABLE", "ERA 服务未启动或正在停止。");
  else if (!s?.started) f.rejected = rejection("ERA_HOST_NOT_STARTED", "ERA 服务宿主尚未启动。");
  else if (s.stopping || s.lifecycle.signal.aborted) f.rejected = rejection("ERA_HOST_STOPPING", "ERA 服务宿主正在停止，不再接纳新事件。");
  else if (!input || typeof input.type !== "string" || !input.type || !["tavern", "ui", "era-api", "timer"].includes(input.source)
    || ((input.source === "timer") !== (input.type === ERA_COLLECTION_TIMER_EVENT_TYPE))
    || (input.occurredAt !== undefined && !Number.isFinite(input.occurredAt))
    || (input.args !== undefined && !Array.isArray(input.args)))
    f.rejected = rejection("ERA_HOST_EVENT_INVALID", "宿主事件缺少合法的 type、source、occurredAt 或 args。");
  return emit({frame: f}, params);
}

function encodeArg(value: any, refs: Map<string, any>, id: string, max: number): any {
  if (value === undefined) return {kind: "undefined"};
  try {
    const cloned = structuredClone(value);
    if (isJsonValue(cloned)) return {kind: "json", value: cloned};
  } catch { /* 函数及非 JSON 对象改为实例引用。 */ }
  if (refs.size >= max) throw new EraServiceHostError("ERA_HOST_TOO_MANY_REFS", `单事件宿主引用超过 ${max} 个限制。`);
  const token = `${id}:ref:${refs.size + 1}`;
  refs.set(token, value);
  return {kind: "host-ref", token, refKind: value === null ? "null" : typeof value === "object" ? value.constructor?.name ?? "object" : typeof value};
}
export function EncodeEvent(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.rejected) return emit({frame: f}, params);
  const s = f.session;
  const id = `${s.extensionId}:event:${s.nextSequence}`;
  try {
    const refs = new Map<string, any>();
    const args = (f.input.args ?? []).map((value: any) => encodeArg(value, refs, id, s.maxHostRefs));
    let event: any = {
      schemaVersion: 1, eventId: id, sequence: s.nextSequence,
      type: f.input.type, source: f.input.source, occurredAt: f.input.occurredAt ?? s.clock.now(), args, encodedBytes: 0,
    };
    for (let attempt = 0; attempt < 8; attempt++) {
      const bytes = new TextEncoder().encode(JSON.stringify(event)).byteLength;
      if (bytes === event.encodedBytes) {
        if (!isEraTransportEventV1(event)) throw new TypeError("编码后的事件不满足传输契约。");
        f.encoded = {event, refs};
        return emit({frame: f}, params);
      }
      event = {...event, encodedBytes: bytes};
    }
    throw new TypeError("事件字节计数无法稳定。");
  } catch (error: any) {
    f.rejected = rejection(error.code === "ERA_HOST_TOO_MANY_REFS" ? error.code : "ERA_HOST_EVENT_INVALID", error.message);
    return emit({frame: f}, params);
  }
}
export function CheckCapacity(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.rejected) return emit({frame: f}, params);
  const s = f.session;
  const bytes = f.encoded.event.encodedBytes;
  if (bytes > s.maxEventBytes) f.rejected = rejection("ERA_HOST_EVENT_TOO_LARGE", `单事件 ${bytes} 字节，超过 ${s.maxEventBytes} 字节限制。`);
  else if (!s.pendingReceive && (s.queue.length >= s.maxFifoEvents || s.queueBytes + bytes > s.maxFifoBytes))
    f.rejected = rejection("ERA_HOST_FIFO_FULL", "ERA 服务宿主 FIFO 已达到事件数或字节数上限。");
  return emit({frame: f}, params);
}
export function ChooseAdmission(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  return emit(route(f, f.rejected ? "rejected" : "accepted"), params);
}
export function Rejected(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.result = f.rejected;
  return emit({frame: f}, params);
}
export function Accept(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  const {event, refs} = f.encoded;
  s.nextSequence++;
  s.acceptedCount++;
  for (const [key, value] of refs) s.refs.set(key, value);
  s.refsBySequence.set(event.sequence, [...refs.keys()]);
  const d = deferred();
  const record = {event, external: f.input.receipt, done: d.promise, resolve: d.resolve, settled: false};
  s.receipts.set(event.sequence, record);
  const publicDone = event.type === "era.ui.agent_retry"
    ? s.dispatch.generationReceipt({session:s,action:"generation_receipt",originalReceipt:record.done}) : record.done;
  f.result = Object.freeze({accepted: true, eventId: event.eventId, sequence: event.sequence, done: publicDone,
    waitThrough: () => s.dispatch.waitThrough({session: s, input: {sequence: event.sequence}})});
  return emit({frame: f}, params);
}
export function Deliver(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (!f.result.accepted) return emit({frame: f}, params);
  const s = f.session;
  const event = f.encoded.event;
  if (s.pendingReceive) {
    const pending = s.pendingReceive;
    s.pendingReceive = null;
    pending.resolve({value: event});
  } else { s.queue.push(event); s.queueBytes += event.encodedBytes; }
  s.observeSettlement?.(f.result.done);
  return emit({frame: f}, params);
}
