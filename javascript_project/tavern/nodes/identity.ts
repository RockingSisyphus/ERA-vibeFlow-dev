import {emit, takeFrame} from "../base_lib/frames.ts";
import {identity, enabledScriptIds} from "../base_lib/browser.ts";
export function ReadIdentity(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const api = f.session.api;
  const result = {...identity(api), characterName: api.getCurrentCharacterName(), isGroup: Boolean(api.SillyTavern.groupId), scriptId: api.getScriptId(), lifecycleToken: f.session.lifecycleToken};
  if (Object.hasOwn(f.input, "sourceContext")) (result as any).statusbarSource = f.session.verifyStatusbarSource(f.input.sourceContext);
  f.result = structuredClone(result);
  return emit({frame: f}, params);
}
export function ReadInstallationScope(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const api = f.session.api;
  let scriptId;
  try { scriptId = api.getScriptId(); } catch { scriptId = null; }
  if (typeof scriptId !== "string" || !scriptId) f.result = {scriptId: null, scopes: [], readStatus: "unavailable"};
  else {
    try {
      const scopes = ["character", "global", "preset"].filter(type => enabledScriptIds(api.getScriptTrees({type})).includes(scriptId));
      f.result = {scriptId, scopes, readStatus: "complete"};
    } catch { f.result = {scriptId, scopes: [], readStatus: "failed"}; }
  }
  return emit({frame: f}, params);
}
