import {emit, takeFrame, route, assertRunning} from "../base_lib/frames.ts";
import {variableScope, record} from "../base_lib/browser.ts";
import {syncCall} from "../base_lib/resources.ts";
export function ReadVariables(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.result = syncCall(f, signal => {
    const scope = variableScope(f.input.scope);
    const variables = structuredClone(f.session.api.getVariables(scope));
    signal.throwIfAborted();
    return {scope, variables};
  });
  return emit({frame: f}, params);
}
export function CheckScope(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  assertRunning(f.session);
  f.options?.signal?.throwIfAborted();
  f.scope = variableScope(f.input.scope);
  return emit({frame: f}, params);
}
export function ChooseWrite(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  return emit(route(f, record(f.input.variables) ? "replace" : "patch"), params);
}
export function SelectReplace(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.variableWrite = {kind: "replace", value: structuredClone(f.input.variables)};
  return emit({frame: f}, params);
}
export function SelectPatch(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const changes = record(f.input.changes) ? structuredClone(f.input.changes) : {};
  if (Object.hasOwn(f.input, "stat")) changes.stat_data = structuredClone(f.input.stat);
  if (Object.hasOwn(f.input, "meta")) changes.ERAMetaData = structuredClone(f.input.meta);
  f.variableWrite = {kind: "patch", value: changes};
  return emit({frame: f}, params);
}
export function WriteVariables(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  syncCall(f, () => {
    const api = f.session.api;
    if (f.variableWrite.kind === "replace") api.replaceVariables(f.variableWrite.value, f.scope);
    else api.updateVariablesWith((current: any) => Object.assign(current, f.variableWrite.value), f.scope);
  });
  return emit({frame: f}, params);
}
export function ReadBack(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const variables = syncCall(f, () => structuredClone(f.session.api.getVariables(f.scope)));
  f.result = {status: "committed", scope: f.scope, variables};
  return emit({frame: f}, params);
}
export function PublishSettings(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.scope.type === "script") f.session.onScriptVariablesCommitted?.();
  return emit({frame: f}, params);
}
