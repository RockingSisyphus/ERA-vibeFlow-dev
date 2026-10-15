import {takeFrame, emit, route, assertRunning} from "../../base_lib/frames.ts";
import {record} from "../../base_lib/browser.ts";
import {persistenceFacts} from "../../base_lib/messages/persistence.ts";
import {assertCurrentMessageBasis, assertExpectedSidecarPointer} from "../../base_lib/messages/target.ts";
import {startResource} from "../../base_lib/resources.ts";
export function CheckTarget(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  assertRunning(f.session); f.options?.signal?.throwIfAborted();
  if (f.input.sourceBasis !== undefined) assertCurrentMessageBasis(f.session.api, f.input.sourceBasis);
  assertExpectedSidecarPointer(f.session.api, f.input);
  f.persistence = persistenceFacts(f.session.api, f.input);
  f.hostUpdates = []; f.affectedMessageIds = new Set(); f.itemIndex = 0;
  f.session.internalMessageWrites ??= new Map();
  f.messageRefresh = f.input.refresh === "affected" || f.input.refresh === "all" ? f.input.refresh : "none";
  return emit({frame: f}, params);
}
export function ChooseUpdate(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  return emit(route(f, Array.isArray(f.input.updates) || record(f.input.update) ? "many" : "single"), params);
}
export function SelectMany(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.updateItems = structuredClone(Array.isArray(f.input.updates) ? f.input.updates : [f.input.update]);
  return emit({frame: f}, params);
}
export function SelectSingle(inputs: any, params: any): any {
  const f = takeFrame(inputs); const id = f.input.message_id ?? f.input.messageId;
  if (!Number.isSafeInteger(id) || id < 0) throw new TypeError("消息更新请求缺少有效 messageId。");
  if (typeof f.input.content !== "string") throw new TypeError("消息更新请求缺少文本 content。");
  if (!f.session.api.getChatMessages(id)[0]) throw new Error(`找不到消息 #${id}。`);
  f.updateItems = [{message_id: id, message: f.input.content}];
  return emit({frame: f}, params);
}
export function ChooseItem(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  return emit(route(f, f.itemIndex < f.updateItems.length ? "item" : "done"), params);
}
export function PrepareItem(inputs: any, params: any): any {
  const f = takeFrame(inputs); const update = f.updateItems[f.itemIndex++];
  if (record(update)) {
    const id = update.message_id ?? update.messageId;
    if (Number.isSafeInteger(id) && id >= 0) {
      const current = record(update.extra) || Array.isArray(update.swipes) && typeof (update.message ?? update.mes) !== "string"
        ? f.session.api.getChatMessages(id, {include_swipes: true})[0] : null;
      const text = update.message ?? update.mes ?? (Array.isArray(update.swipes) ? update.swipes[Number(current?.swipe_id ?? 0)] : undefined);
      if (typeof text === "string") f.session.internalMessageWrites.set(id, text);
      f.affectedMessageIds.add(id);
      f.hostUpdates.push(record(update.extra) ? {...update, extra: {...(record(current?.extra) ? current.extra : {}), ...update.extra}} : update);
    }
  }
  return emit({frame: f, done: false}, params);
}
export function EmptyItem(inputs: any, params: any): any { return emit({frame: takeFrame(inputs), done: true}, params); }
export function StartWrite(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.input.sourceBasis !== undefined) assertCurrentMessageBasis(f.session.api, f.input.sourceBasis);
  assertExpectedSidecarPointer(f.session.api, f.input);
  f.operationResource = startResource(f, () => f.session.api.setChatMessages(f.hostUpdates, {refresh: f.messageRefresh}), resource => f.session.dispatch.finishCapability({...f, operationResource: resource}));
  f.publicPromise = f.operationResource.publicPromise;
  return emit({frame: f}, params);
}
