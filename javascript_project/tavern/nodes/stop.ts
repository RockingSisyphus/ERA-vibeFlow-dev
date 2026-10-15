import {emit, takeFrame, route, warn} from "../base_lib/frames.ts";
import {settleReceipt} from "../base_lib/receipts.ts";
import {dispatchUi} from "../base_lib/resources.ts";

export function CloseIngress(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  s.stopping = true;
  s.started = false;
  f.result = {closed: true};
  s.backgroundWaiter?.resolve();
  return emit({frame: f}, params);
}
export function CancelGenerations(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s=f.session;
  s.operational.abort(f.input?.reason??"ERA 服务宿主已停止");
  s.startup.resolve({route:"dormant",reason:"stopped",warn:false});
  s.internalMessageWrites.clear();s.sessions.clear();
  for (const cycle of s.subscriptionCycles??[]) cycle.controller.abort();
  for (const item of s.subscriptions??[]) item.lifecycle.abort();
  s.subscriptions?.clear();
  for (const handoff of s.handoffs.values()) handoff.resolve(null);
  s.handoffs.clear();
  s.nativeCycle?.resolve({status:"cancelled",reason:"chat-changed"});s.nativeCycle=null;s.nativeGenerationActive=false;
  try{s.agentRecordView?.clear?.();}catch(error){warn(s,"清理生成查看记录时发生异常。",{error});}
  s.nativeStopTicket?.release();s.nativeStopTicket=null;
  return emit({frame: f}, params);
}
export function AbortWaiters(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  s.stopping = true;
  s.started = false;
  const reason = f.input?.reason ?? "ERA 服务宿主已停止";
  s.lifecycle.abort(reason);
  s.operational.abort(reason);
  s.pendingReceive?.reject(reason);
  s.pendingReceive = null;
  s.backgroundWaiter?.resolve();
  return emit({frame: f}, params);
}
export function RemoveListeners(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  try { s.unsubscribe?.(); } catch (error: any) { warn(s, "注销酒馆事件监听器时发生异常。", {error: error.message}); }
  s.unsubscribe = null;
  s.removeContextAbort?.();
  s.removeContextAbort = null;
  return emit({frame: f}, params);
}
export function ClearTimers(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  for (const timer of [...s.timers.values(), ...s.delayedAdmissions.values()]) timer.handle.controller.abort("stopped");
  for (const watchdog of s.watchdogs) watchdog.controller.abort("stopped");
  s.timers.clear(); s.delayedAdmissions.clear(); s.watchdogs.clear();
  f.stopSequences = [...s.receipts.keys()].sort((a: number,b: number) => a-b);
  f.itemIndex = 0;
  return emit({frame: f}, params);
}
export function ChooseCancelled(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  return emit(route(f, f.itemIndex < f.stopSequences.length ? "item" : "done"), params);
}
export function CancelOne(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const sequence = f.stopSequences[f.itemIndex++];
  const record = f.session.receipts.get(sequence);
  if (record) settleReceipt(f.session, {eventId: record.event.eventId, sequence, status: "cancelled",
    reason: typeof f.input?.reason === "string" ? f.input.reason : "ERA 服务宿主已停止"});
  return emit({frame: f, done: false}, params);
}
export function ClearPrompt(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  try { dispatchUi(f.session.api,"era-sidecar-binding-prompt",null); }
  catch (error: any) { warn(f.session, "清理 ERA Sidecar 绑定弹窗时发生异常。", {error: error.message}); }
  return emit({frame: f}, params);
}
export async function AwaitBackground(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  await Promise.allSettled([...f.session.activeNotifications]);
  return emit({frame: f}, params);
}
export function ReleaseSession(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  s.queue.length = 0; s.queueBytes = 0;
  s.refs.clear(); s.refsBySequence.clear(); s.failureLedger.clear(); s.processedFrames.clear();
  s.fatalTransitioning = false; s.fatalLatched = false;

  f.result = undefined;
  return emit({frame: f}, params);
}
