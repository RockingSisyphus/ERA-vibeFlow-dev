import {emit, takeFrame, route} from "../base_lib/frames.ts";
import {currentTavern, currentRegexEnabled, record, regexData} from "../base_lib/browser.ts";
import {syncCall, startResource, resourceValue, rawCall} from "../base_lib/resources.ts";
export function ReadRegex(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.result = syncCall(f, () => ({enabled: currentRegexEnabled(f.session.api), regexes: structuredClone(f.session.api.getTavernRegexes({type: "character"}))}));
  return emit({frame: f}, params);
}
export function StartUpsert(inputs: any, params: any): any {
  const f = takeFrame(inputs), api = f.session.api;
  if (!record(f.input.regex)) throw new TypeError("正则写入请求缺少 regex。");
  const updated = [...api.getTavernRegexes({type: "character"}), structuredClone(f.input.regex)];
  const tavern = currentTavern(api), index = Number(tavern.characterId);
  if (!Number.isSafeInteger(index) || index < 0) throw new TypeError("当前聊天没有可写入局部正则的角色索引。");
  f.regexCount = updated.length;
  f.operationResource = startResource(f, () => tavern.writeExtensionField(index, "regex_scripts", updated.map(regexData)), resource => f.session.dispatch.finishCapability({...f, operationResource: resource}));
  f.publicPromise = f.operationResource.publicPromise;
  return emit({frame: f}, params);
}
export async function AwaitField(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  await resourceValue(f);
  return emit({frame: f}, params);
}
export function ChooseEnabled(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  return emit(route(f, currentRegexEnabled(f.session.api) ? "enabled" : "enable"), params);
}
export async function EnableAndSave(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs), api = f.session.api;
  const id = api.getCurrentCharacterId();
  if (!id) throw new TypeError("当前聊天没有角色，无法启用角色局部正则。");
  const tavern = currentTavern(api), settings = tavern.extensionSettings;
  const allowed = Array.isArray(settings.character_allowed_regex) ? settings.character_allowed_regex.filter((v: any) => typeof v === "string") : [];
  if (!allowed.includes(id)) settings.character_allowed_regex = [...allowed, id];
  await rawCall(f, () => {
    const save = tavern.saveSettingsDebounced;
    const scheduled = save();
    return typeof save.flush === "function" ? save.flush() : scheduled;
  });
  return emit({frame: f}, params);
}
export async function ReloadChat(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  await rawCall(f, () => currentTavern(f.session.api).reloadCurrentChat());
  f.result = {status: "committed", count: f.regexCount, enabled: true};
  return emit({frame: f}, params);
}
