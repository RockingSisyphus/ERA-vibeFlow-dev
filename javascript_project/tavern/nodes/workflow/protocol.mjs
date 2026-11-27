// 按 VibeFlow 1.5.3 工作流协作接口转交原生操作。
export async function Call(inputs,params,context){const api=context.workflow;return {instance:(await api.call({workflow:params.workflow,launch:params.launch,inputs:inputs["era.workflow.wire_inputs"].value})).id};}
export async function Wait(inputs,params,context){const api=context.workflow;return {terminal:await api.wait({id:inputs["era.workflow.instance"].value})};}
export async function Kill(inputs,params,context){const api=context.workflow;return {stopped:await api.kill({id:inputs["era.workflow.instance"].value,workflow:params.workflow})};}
export function Send(inputs,params,context){const api=context.workflow;api.send(inputs["era.workflow.wire_message"].value);return {};}
export async function Receive(inputs,params,context){const api=context.workflow;return {message:await api.receive({port:params.port})};}

// 此组合只用于当前流程拥有的子实例；宿主停止本次拥有的子实例，等待实际清理完成。
export async function WaitOwned(inputs,params,context){
 const api=context.workflow,id=inputs["era.workflow.instance"].value;
 try{return {terminal:await api.wait({id})};}
 catch(error){
  try{await inputs["era.workflow.host_resources"].value.stopOwned(id,params.workflow);}
  catch(cleanupError){throw new AggregateError([error,cleanupError],"子流程等待失败，停止清理也失败。");}
  throw error;
 }
}

export function InvokeSync(inputs,params,context){const api=context.workflow;try{return {wire_outputs:api.invoke_sync({workflow:params.workflow,inputs:inputs["era.workflow.wire_inputs"].value})};}catch(error){return {wire_outputs:{workflowFailure:error}};}}

export function SendEvent(inputs,_params,context){const owner=inputs["era.workflow.local_owner"].value;let closed=owner.session.stopping;if(!closed)try{context.workflow.send(inputs["era.workflow.wire_message"].value);}catch(error){if(error?.code!=="VF_INSTANCE_ENDED")throw error;closed=true;}return {delivery:{owner,closed}};}
