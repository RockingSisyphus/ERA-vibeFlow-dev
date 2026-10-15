import {takeFrame, emit, route, assertRunning} from "../../base_lib/frames.ts";
import {currentTavern} from "../../base_lib/browser.ts";
import {assertCurrentMessageBasis} from "../../base_lib/messages/target.ts";
import {startResource, resourceValue} from "../../base_lib/resources.ts";
export function CheckBasis(inputs: any, params: any): any {
  const f = takeFrame(inputs); assertRunning(f.session); f.options?.signal?.throwIfAborted();
  if (f.input.sourceBasis !== undefined) assertCurrentMessageBasis(f.session.api, f.input.sourceBasis);
  return emit({frame: f}, params);
}
export function ChooseRefresh(inputs: any, params: any): any { const f = takeFrame(inputs); return emit(route(f, f.input.mode === "all" ? "all" : "one"), params); }
export function SelectOne(inputs: any, params: any): any {
  const f = takeFrame(inputs); f.refreshKind = "one"; f.messageId = f.input.messageId ?? f.input.message_id;
  if (!Number.isSafeInteger(f.messageId) || f.messageId < 0) throw new TypeError("消息请求缺少有效 messageId。");
  return emit({frame: f}, params);
}
export function SelectAll(inputs: any, params: any): any { const f = takeFrame(inputs); f.refreshKind = "all"; return emit({frame: f}, params); }
export function StartRefresh(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.operationResource = startResource(f, () => f.refreshKind === "all" ? currentTavern(f.session.api).reloadCurrentChat() : f.session.api.refreshOneMessage(f.messageId), resource => f.session.dispatch.finishCapability({...f, operationResource: resource}));
  f.publicPromise = f.operationResource.publicPromise;
  return emit({frame: f}, params);
}
export async function AwaitRefresh(inputs: any, params: any): Promise<any> { const f = takeFrame(inputs); await resourceValue(f); f.result = {status: "completed"}; return emit({frame: f}, params); }
