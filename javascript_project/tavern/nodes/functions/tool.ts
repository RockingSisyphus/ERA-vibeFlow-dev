import {takeFrame,emit} from "../../base_lib/frames.ts";
export function ReadCall(inputs:any,params:any):any {
  const f=takeFrame(inputs);if(!f.call)throw new TypeError("缺少已安排的作者调用资源。");
  return emit({frame:f},params);
}
export async function InvokeTool(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);
  if(!f.call.active||f.call.signal.aborted)f.toolOutcome={status:"rejected",error:new Error("ERA_FUNCTION_CONTEXT_EXPIRED")};
  if(!f.toolOutcome) {
    try {
      const value=await f.session.resources.perform(()=>f.session.api.SillyTavern.ToolManager.invokeFunctionTool(f.call.name,f.call.parameters));
      f.toolOutcome=Object.prototype.toString.call(value)==="[object Error]"?{status:"rejected",error:new Error(value.message)}:{status:"fulfilled",value};
    } catch(error){f.toolOutcome={status:"rejected",error};}
  }
  // 作者返回时停止接收新操作，已入队的操作仍由消息流程结算。
  f.call.acceptingSubmissions=false;
  return emit({frame:f},params);
}
export function RecordTerminal(inputs:any,params:any):any {
  const f=takeFrame(inputs),o=f.toolOutcome;
  if(o.status==="rejected")f.call.error={code:"ERA_FUNCTION_CALL_FAILED",message:o.error instanceof Error?o.error.message:String(o.error)};
  f.call.finished=true;return emit({frame:f},params);
}
export function WakeNext(inputs:any,params:any):any {const f=takeFrame(inputs);f.call.wake?.resolve();return emit({frame:{status:"author-finished"}},params);}
