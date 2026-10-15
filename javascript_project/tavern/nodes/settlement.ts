import {emit, takeFrame, route, warn, EraServiceHostError} from "../base_lib/frames.ts";
import {settleReceipt} from "../base_lib/receipts.ts";

export function MarkFatal(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.batch.fatal) f.session.fatalTransitioning = true;
  f.itemIndex = 0;
  return emit({frame: f}, params);
}
export function ChooseReceipt(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  return emit(route(f, f.itemIndex < f.batch.settlements.length ? "item" : "done"), params);
}
export function SettleOne(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  settleReceipt(f.session, f.batch.settlements[f.itemIndex]);
  f.itemIndex++;
  return emit({frame: f, done: false}, params);
}
export function EmptyReceipt(inputs: any, params: any): any {
  return emit({frame: takeFrame(inputs), done: true}, params);
}
export function LatchFatal(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.batch.fatal) {
    const s = f.session;
    s.fatalTransitioning = false;
    s.fatalLatched = true;
    const error = new EraServiceHostError("ERA_HOST_FATAL", "ERA 服务宿主已进入致命态。");
    s.operational.abort(error);
    s.pendingReceive?.reject(error);
    s.pendingReceive = null;
  }
  return emit({frame: f}, params);
}
export function PublishDiagnostics(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  for (const diagnostic of f.batch.diagnostics) warn(f.session, "ERA 工作流诊断。", diagnostic);
  return emit({frame: f}, params);
}
export function EnqueueNotifications(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  return emit({frame: f}, params);
}
