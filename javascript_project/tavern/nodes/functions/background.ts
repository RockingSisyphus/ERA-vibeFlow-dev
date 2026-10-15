import {takeFrame,emit,route} from "../../base_lib/frames.ts";
import {deferred,abortable,linkedSignals} from "../../base_lib/resources.ts";

/** 一次挂起资源；反复选择和并发调用由外层原生 Loop/edge 管理。 */
export async function WaitTask(inputs:any,params:any,context:any):Promise<any> {
  const f=takeFrame(inputs),s=f.session;
  context?.signal?.throwIfAborted();
  if(!s.tasks.length&&!s.stopping){
    const waiter=deferred();s.backgroundWaiter=waiter;
    try {await abortable(()=>waiter.promise,linkedSignals([context?.signal]));}
    finally {if(s.backgroundWaiter===waiter)s.backgroundWaiter=null;}
  }
  return emit({frame:{ready:true}},params);
}
export function ChooseTask(inputs:any,params:any):any {
  const f=takeFrame(inputs),task=f.backgroundTask;
  if(!["author_tool","notification","notification_finalize","timer_wait","stop"].includes(task.kind))throw new TypeError("未知后台任务类型。");
  return emit(route({...f,...task,session:f.session},task.kind),params);
}
export function ReturnTask(inputs:any,params:any):any {
  const f=takeFrame(inputs);return emit({frame:f,runtime_done:f.kind==="stop"},params);
}
