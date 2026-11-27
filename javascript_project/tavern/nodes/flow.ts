import {emit, takeFrame, route, assertRunning} from "../base_lib/frames.ts";

/** 起止控制边界无数据输出，避免把同一结果重复登记为多份产物。 */
export function Terminal(): any { return {}; }

/** 纯传递边界：不执行资源或行为。 */
export function Pass(inputs: any, params: any): any { return emit({frame: takeFrame(inputs)}, params); }
export function BeginRuntime(inputs: any, params: any): any {
  return {
    ...emit({frame:{...inputs["era.tavern.call.frame"].value}}, params),
    runtime_entry_host_resources:inputs["era.workflow.host_resources"].value,
  };
}
/** 互斥路径的严格单结果汇合。 */
export function Join(inputs: any, params: any): any { return emit({frame: takeFrame(inputs)}, params); }
export function ChooseSync(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.action === "capability") {
    assertRunning(f.session); f.options?.signal?.throwIfAborted();
    if (!params.families.includes(f.family)) throw new TypeError("未声明的酒馆能力。");
    return emit(route(f, "cap_" + f.family), params);
  }
  const selected = params.actions[f.action];
  if (!selected) throw new TypeError(`未知同步入口：${f.action}`);
  return emit(route(f, selected), params);
}
export function ChooseAsync(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.action === "capability") {
    if (!params.families.includes(f.family)) throw new TypeError("当前能力没有异步续体。");
    return emit(route(f, "cap_" + f.family), params);
  }
  if (!params.actions.includes(f.action)) throw new TypeError(`未知异步入口：${f.action}`);
  return emit(route(f, f.action), params);
}

export function ChooseOperation(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (!params.operations.includes(f.operation)) throw new TypeError("未声明的酒馆操作。");
  return emit(route(f, f.operation), params);
}

export function Finished(inputs:any,params:any):any {takeFrame(inputs);return emit({frame:{status:"finished"}},params);}

export function FinishRuntime(inputs:any,params:any):any {takeFrame(inputs);return emit({frame:{status:"stopped"}},params);}
