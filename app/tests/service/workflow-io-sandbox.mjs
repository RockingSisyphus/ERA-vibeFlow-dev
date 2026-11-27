/** 测试专用IO边界：领域AOT及计算AOT均为真实产物，仅模拟原本就由测试提供的酒馆IO。 */
import {Coordinator} from '../../../kernel/javascript/coordinator.mjs';
import {encodePacket,decodePacket} from '../../../base_lib/workflow_values/codec.mjs';
import * as expression from '../../../javascript_project/expression/generated/release/node.js';
import * as compaction from '../../../javascript_project/compaction/generated/release/node.js';
export async function runWithIoMocks(module,inputs,context={}){
 const scope=new Coordinator(),ownerToken=crypto.randomUUID(),operations=new Map(),children=new Set();let output,runtimeId;
 const port=context.capabilities?.["vibeflow.port"];let ready;const peerReady=new Promise(resolve=>{ready=resolve;});
 const sync={root:'era-tavern',path:'configs/era.tavern.sync.jsonc'};
 const asyncTargets=Object.fromEntries(['operation','parallel_reads','runtime'].map(name=>[name,{root:'era-tavern',path:`configs/era.tavern.${name}.jsonc`}]));
 scope.bind(expression.workflowDescriptor,expression.runWorkflow);scope.bind(compaction.workflowDescriptor,compaction.runWorkflow);
 scope.bind({workflow:sync,entry_mode:'sync',entries:{protocol:{}},default_entry:'protocol',calls:[]},input=>{
  const request=decodePacket(input.wire_request);
  if(request.ownerToken!==ownerToken)throw new TypeError('IO沙箱资源归属错误。');
  const api=context.capabilities?.[request.capability]?.[request.operation];
  if(typeof api!=='function')throw new TypeError(`未提供测试IO：${request.capability}.${request.operation}`);
  const controller=new AbortController(),value=api(request.input,{signal:controller.signal});
  if(value&&typeof value.then==='function'){const token=crypto.randomUUID();operations.set(token,{promise:Promise.resolve(value),controller});return {wireResponse:encodePacket({result:{pending:token}})};}
  return {wireResponse:encodePacket({result:{value}})};
 });
 for(const [name,workflow] of Object.entries(asyncTargets))scope.bind({workflow,entry_mode:'async',entries:{[`protocol_${name}`]:{}},calls:[]},async(input,options)=>{
  if(options.entry==='protocol_runtime'){runtimeId=options.workflowInstanceId;ready();await new Promise(resolve=>{options.signal.addEventListener('abort',resolve,{once:true});if(options.signal.aborted)resolve();});return {};}
  const request=decodePacket(input.wire_request);children.add(options.workflowInstanceId);
  if(request.ownerToken!==ownerToken)throw new TypeError('IO沙箱资源归属错误。');
  if(options.entry==='protocol_parallel_reads'){
   const cap=context.capabilities,initial=request.kind==='initialization';
   const rows=initial?[['identity','identity','read',{purpose:'era-initialize'}],['variables','variables','read',{scope:{type:'script'},purpose:'era-initialize'}],['worldbook','worldbook','read',{purpose:'era-initialize'}],['regex','regex','read',{purpose:'era-initialize'}],['character','character','read_main_greeting',{purpose:'era-initialize'}]]:[['messages','messages','read_context',{projection:'era-active-message-v1',range:'0--1',purpose:'era-dispatch-prepare'}],['identity','identity','read',{purpose:'era-dispatch-prepare'}],...request.latest?[]:[['current','sidecar','read_current',{}],['variables','variables','read',{scope:{type:'script'},purpose:'era-dispatch-placeholder'}]]];
   const result=Object.fromEntries(await Promise.all(rows.map(async([key,family,operation,input])=>[key,await cap[`era.tavern.${family}`][operation](input)])));
   return {wireResponse:encodePacket({result})};
  }
  const pending=operations.get(request.operationToken);if(!pending)throw new Error('测试IO操作编号已失效。');
  const stop=()=>pending.controller.abort(options.signal.reason);options.signal.addEventListener('abort',stop,{once:true});if(options.signal.aborted)stop();
  try{return {wireResponse:encodePacket({result:await pending.promise})};}finally{options.signal.removeEventListener('abort',stop);operations.delete(request.operationToken);}
 });
 scope.bind(module.workflowDescriptor,async(_input,options)=>{
  const native=options.workflowSession;
  const hostResources={
   metadata:()=>({ownerToken,runtimeId}),
   release(id){if(!children.has(id))throw new Error('不属于当前测试实例');scope.release(id);children.delete(id);},
   async stopOwned(id,workflow){if(!children.has(id))throw new Error('不属于当前测试实例');await scope.kill({id,workflow});},
   yieldTurn:()=>Promise.resolve(),
  };
  const communication={...native};
  if(port){
   const peer=scope.session(runtimeId);
   communication.send=request=>{const result=native.send(request);peer.receive({port:request.port}).catch(()=>{});if(request.port==='era.service.out')port.send({port:request.port,value:decodePacket(request.payload).value},{signal:options.signal});return result;};
   communication.receive=async(request,callOptions)=>{const result=await port.receive(request,callOptions);peer.send({id:options.workflowInstanceId,port:request.port,payload:encodePacket(result)});return native.receive(request,callOptions);};
  }
  const stop=()=>{scope.kill({id:options.workflowInstanceId,workflow:module.workflowDescriptor.workflow}).catch(()=>{});};
  context.signal?.addEventListener('abort',stop,{once:true});
  const declaration=module.workflowDescriptor;
  const inputSpecs=declaration.entries?.[options.entry]?.inputs??declaration.inputs;
  const localInputs=inputSpecs.some(input=>input.key==='host_resources')
   ? {...inputs,host_resources:hostResources} : inputs;
  try{if(context.signal?.aborted)stop();output=await module.runWorkflowAsync(localInputs,{...options,trace:'off',workflowSession:communication});return {};}
  finally{context.signal?.removeEventListener('abort',stop);}
 });
 let peer;if(port){peer=scope.run({...asyncTargets.runtime,entry:'protocol_runtime'},{});await peerReady;}
 try{const terminal=await scope.run({...module.workflowDescriptor.workflow,...context.entry?{entry:context.entry}:{}},{});if(terminal.state!=='succeeded'){const error=new Error(terminal.error?.message??'领域工作流失败');Object.assign(error,terminal.error);throw error;}return output;}
 finally{for(const operation of operations.values())operation.controller.abort(new DOMException("IO沙箱结束","AbortError"));await scope.close();if(peer)await peer;}
}
