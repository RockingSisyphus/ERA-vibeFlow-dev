// 按 VibeFlow 1.5.3 工作流协作接口转交原生操作。
export function InvokeSync(inputs,params,context){const api=context.workflow;try{return {wire_outputs:api.invoke_sync({workflow:params.workflow,inputs:inputs["era.workflow.wire_inputs"].value})};}catch(error){return {wire_outputs:{workflowFailure:error}};}}
