import {isEraBatchResultV1, isEraCollectionControlV1, isJsonValue} from "../base_lib/contracts.ts";
import {emit, takeFrame, assertRunning, route, stableStringify, EraServiceHostError} from "../base_lib/frames.ts";
import {deferred, linkedSignals} from "../base_lib/resources.ts";

export function CheckFrame(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  assertRunning(s, false);
  if (f.input?.port !== s.outboundPort) throw new EraServiceHostError("ERA_HOST_PORT_UNKNOWN", `出站 Port 必须是 ${s.outboundPort}。`);
  const frame = f.input.value;
  if (!frame || typeof frame !== "object" || Array.isArray(frame) || typeof frame.frameId !== "string" || !frame.frameId)
    throw new EraServiceHostError("ERA_HOST_FRAME_INVALID", "出站 frame 缺少非空 frameId。");
  f.outputFrame = frame;
  f.fingerprint = stableStringify(frame);
  const previous = s.processedFrames.get(frame.frameId);
  if (previous !== undefined && previous !== f.fingerprint)
    throw new EraServiceHostError("ERA_HOST_FRAME_CONFLICT", `frameId ${frame.frameId} 对应的内容发生冲突。`);
  f.duplicate = previous !== undefined;
  return emit({frame: f}, params);
}
export function ChooseFrame(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.duplicate) return emit(route(f, "duplicate"), params);
  assertRunning(f.session);
  if (isEraBatchResultV1(f.outputFrame)) return emit(route(f, "batch"), params);
  if (isEraCollectionControlV1(f.outputFrame)) return emit(route(f, "control"), params);
  throw new EraServiceHostError("ERA_HOST_FRAME_INVALID", `未知的出站 frame 类型：${String(f.outputFrame.kind)}`);
}
export function PrepareBatch(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  const frame = f.outputFrame;
  const seen = new Set();
  for (const value of frame.settlements) {
    if (value.sequence > frame.throughSequence || seen.has(value.sequence))
      throw new EraServiceHostError("ERA_HOST_FRAME_INVALID", "settlement 的序号重复或超过覆盖范围。");
    const record = s.receipts.get(value.sequence);
    if (!record || record.event.eventId !== value.eventId || record.settled)
      throw new EraServiceHostError("ERA_HOST_SETTLEMENT_CONFLICT", `事件 ${value.eventId}#${value.sequence} 没有待结算回执。`);
    seen.add(value.sequence);
  }
  const required = [...s.receipts.keys()].filter((n: number) => n <= frame.throughSequence);
  if (required.length !== seen.size || required.some(n => !seen.has(n)))
    throw new EraServiceHostError("ERA_HOST_SETTLEMENT_COVERAGE", `batch-result 未恰好覆盖 throughSequence=${frame.throughSequence} 以内的全部回执。`);
  const notifications = frame.notifications.map((n: any) => ({type: n.type, args: n.args.map((a: any) => {
    if (a.kind === "undefined") return undefined;
    if (a.kind === "json") {
      const value = structuredClone(a.value);
      if (!isJsonValue(value)) throw new EraServiceHostError("ERA_HOST_FRAME_INVALID", "notification 参数不是可移植 JSON。");
      return value;
    }
    if (!s.refs.has(a.token)) throw new EraServiceHostError("ERA_HOST_REF_UNKNOWN", `宿主引用已释放：${a.token}`);
    return s.refs.get(a.token);
  })}));
  f.batch = {...frame, notifications, settlements: [...frame.settlements].sort((a: any,b: any) => a.sequence-b.sequence)};
  f.itemIndex = 0;
  return emit({frame: f}, params);
}
export function ApplyFrame(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.result = null;
  return emit({frame: f}, params);
}
export function RememberFrame(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  if (!f.duplicate) {
    s.processedFrames.set(f.outputFrame.frameId, f.fingerprint);
    if (s.processedFrames.size > 4096) s.processedFrames.delete(s.processedFrames.keys().next().value);
  }
  return emit({frame: f}, params);
}
export function PrepareNotifications(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;
  const items=!f.duplicate&&!s.stopping&&isEraBatchResultV1(f.outputFrame)?f.batch.notifications:[];
  f.notificationIndex=0;f.notificationGroup=items.length?{owner:s,items,outcomes:new Array(items.length),remaining:items.length,completion:deferred(),linked:linkedSignals([s.lifecycle.signal,f.origin==="service"?undefined:f.options?.signal])}:null;
  return emit({frame:f},params);
}
export function ActivateNotifications(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,group=f.notificationGroup;
  if(group){s.notificationGroups??=new Set();s.notificationGroups.add(group);s.activeNotifications.add(group.completion.promise);}
  f.result=null;return emit({frame:f},params);
}
