import {tavernEndpoint} from "../../base_lib/browser.ts";
import {takeFrame, emit, route} from "../../base_lib/frames.ts";
import {resourceValue, rawCall} from "../../base_lib/resources.ts";
import {sameChat, assertPersistedMessages, sourceChanged} from "../../base_lib/messages/persistence.ts";
import {assertCurrentMessageBasis} from "../../base_lib/messages/target.ts";
/** setChatMessages 失败仍按原接口抛出；只有落盘确认链将失败交给 Service。 */
export async function AwaitWrite(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs); await resourceValue(f); return emit({frame: f}, params);
}
export async function SaveChat(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs); f.persistenceConfirmed = false;
  if (f.persistence.expected.length === 0) { f.result = {status: "committed"}; return emit(route(f, "finished"), params); }
  try {
    await rawCall(f, signal => {
      signal.throwIfAborted();
      if (!sameChat(f.session.api, f.persistence.target)) throw new Error("消息已更新，但保存前聊天已切换。");
      return f.persistence.tavern.saveChat();
    });
    return emit(route(f, "continue"), params);
  } catch (error) { f.persistenceError = error; return emit(route(f, "failed"), params); }
}
export async function ReadSavedChat(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  try {
    f.savedResponse = await rawCall(f, signal => f.session.api.fetch(tavernEndpoint(f.session.api, "/api/chats/get"), {
      method: "POST", headers: f.persistence.tavern.getRequestHeaders(), signal, body: JSON.stringify(f.persistence.target),
    }));
    if (!f.savedResponse.ok) throw new Error(`聊天保存回读失败：HTTP ${f.savedResponse.status}`);
    return emit(route(f, "continue"), params);
  } catch (error) { f.persistenceError = error; return emit(route(f, "failed"), params); }
}
export async function ReadSavedJson(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  try { f.savedMessages = await f.savedResponse.json(); return emit(route(f, "continue"), params); }
  catch (error) { f.persistenceError = error; return emit(route(f, "failed"), params); }
}
export function CheckSavedMessages(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  try {
    assertPersistedMessages(f.savedMessages, f.persistence.expected);
    f.persistenceConfirmed = true;
    assertCurrentMessageBasis(f.session.api, f.persistence.postWriteBasis);
    f.result = {status: "committed"};
  } catch (error) { f.persistenceError = error; }
  return emit({frame: f}, params);
}
export function ProjectDisplay(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (Object.hasOwn(f, "persistenceError")) {
    f.result = {status: "failed", writeState: "memory-written", persistenceConfirmed: f.persistenceConfirmed,
      sourceChanged: sourceChanged(f.session.api, f.persistence.postWriteBasis),
      message: f.persistenceError instanceof Error ? f.persistenceError.message : String(f.persistenceError)};
    return emit({frame: f}, params);
  }
  if (f.input.projectTechnicalBlocks !== false) f.session.projectTechnicalBlocks?.([...f.affectedMessageIds]);
  f.session.lifecycle.signal.throwIfAborted(); f.session.operational.signal.throwIfAborted(); f.options?.signal?.throwIfAborted();
  return emit({frame: f}, params);
}
