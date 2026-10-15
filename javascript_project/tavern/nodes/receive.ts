import {emit, takeFrame, assertRunning, EraServiceHostError} from "../base_lib/frames.ts";
import {linkedSignals, waitResource} from "../base_lib/resources.ts";

export function CheckPort(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  assertRunning(s);
  if (!s.unsubscribe) throw new EraServiceHostError("ERA_HOST_INGRESS_INACTIVE", "ERA 服务入口尚未由启动工作流激活。");
  if (f.input?.port !== s.inboundPort) throw new EraServiceHostError("ERA_HOST_PORT_UNKNOWN", `入站 Port 必须是 ${s.inboundPort}。`);
  if (s.pendingReceive) throw new EraServiceHostError("ERA_HOST_PORT_CONCURRENT_RECEIVE", "同一实例只允许一个挂起的 receive。");
  return emit({frame: f}, params);
}
export function ReadQueue(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  if (s.pendingReceive) throw new EraServiceHostError("ERA_HOST_PORT_CONCURRENT_RECEIVE", "同一实例只允许一个挂起的 receive。");
  const event = s.queue.shift();
  if (event) { s.queueBytes -= event.encodedBytes; f.result = {value: event}; return emit({frame: f}, params); }
  const linked = linkedSignals([s.lifecycle.signal, s.operational.signal, f.options?.signal]);
  const pending = waitResource(linked, () => {
    if (s.pendingReceive === pending) s.pendingReceive = null;
  });
  s.pendingReceive = pending;
  f.pending = pending.promise;
  return emit({frame: f}, params);
}
export async function AwaitEvent(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  if (f.pending) f.result = await f.pending;
  return emit({frame: f}, params);
}
