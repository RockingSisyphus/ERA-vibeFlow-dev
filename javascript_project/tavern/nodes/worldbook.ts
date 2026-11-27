import {emit, takeFrame} from "../base_lib/frames.ts";
import {currentTavern} from "../base_lib/browser.ts";
import {startResource, resourceValue} from "../base_lib/resources.ts";
export function StartRead(inputs: any, params: any): any {
  const f = takeFrame(inputs), api = f.session.api;
  const names = structuredClone(api.getWorldbookNames());
  const bindings = structuredClone(api.getCharWorldbookNames("current"));
  const requestedName = typeof f.input.name === "string" ? f.input.name : bindings.primary;
  f.worldbookFacts = {names, bindings, requestedName};
  f.operationResource = startResource(f, () => requestedName ? api.getWorldbook(requestedName) : []);
  f.publicPromise = f.operationResource.publicPromise;
  return emit({frame: f}, params);
}
export async function ReadWorldbook(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  f.result = {...f.worldbookFacts, entries: structuredClone(await resourceValue(f))};
  return emit({frame: f}, params);
}
export function StartCreate(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (typeof f.input.name !== "string" || !f.input.name) throw new TypeError("世界书创建请求缺少 name。");
  f.worldbookName = f.input.name;
  f.operationResource = startResource(f, () => f.session.api.createWorldbook(f.worldbookName));
  f.publicPromise = f.operationResource.publicPromise;
  return emit({frame: f}, params);
}
export async function CreateWorldbook(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs), created = await resourceValue(f);
  f.result = {status: created ? "created" : "exists", name: f.worldbookName};
  return emit({frame: f}, params);
}
export function StartBind(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (typeof f.input.name !== "string" || !f.input.name) throw new TypeError("世界书绑定请求缺少 name。");
  const tavern = currentTavern(f.session.api), id = Number(tavern.characterId);
  if (!Number.isSafeInteger(id) || id < 0) throw new TypeError("当前聊天没有可写入世界书绑定的角色索引。");
  f.worldbookName = f.input.name;
  f.operationResource = startResource(f, () => tavern.writeExtensionField(id, "world", f.worldbookName));
  f.publicPromise = f.operationResource.publicPromise;
  return emit({frame: f}, params);
}
export async function BindWorldbook(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  await resourceValue(f);
  return emit({frame: f}, params);
}
export function ConfirmBinding(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const field = f.session.api.window?.top?.document?.querySelector("#character_world");
  if (field) field.value = f.worldbookName;
  f.result = {status: "bound", name: f.worldbookName};
  return emit({frame: f}, params);
}
export function StartReplace(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (typeof f.input.name !== "string" || !Array.isArray(f.input.entries)) throw new TypeError("世界书写入请求缺少 name 或 entries。");
  f.worldbookName = f.input.name;
  f.worldbookEntries = structuredClone(f.input.entries);
  f.operationResource = startResource(f, () => f.session.api.replaceWorldbook(f.worldbookName, f.worldbookEntries));
  f.publicPromise = f.operationResource.publicPromise;
  return emit({frame: f}, params);
}
export async function ReplaceEntries(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  await resourceValue(f);
  f.result = {status: "committed", name: f.worldbookName, count: f.worldbookEntries.length};
  return emit({frame: f}, params);
}
