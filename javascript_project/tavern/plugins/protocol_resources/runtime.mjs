/** 同页资源寻址。只保存原始资源和官方实例句柄，不执行领域算法。 */
/** 当前流程的一次宿主事件轮次；等待结束或取消均释放局部计时器和监听。 */
async function yieldHostTurn(clock,signal){
 let timer,abort;
 try{
  await new Promise((resolve,reject)=>{
   abort=()=>reject(signal.reason);
   signal.addEventListener('abort',abort,{once:true});
   if(signal.aborted)abort();
   else timer=clock.setTimeout(resolve,0);
  });
  return {};
 }finally{
  if(timer!==undefined)clock.clearTimeout(timer);
  if(abort)signal.removeEventListener('abort',abort);
 }
}
export function createResourceOwner({scope,entries,encodePacket,decodePacket,options,dispatchFactory,resourceRequest}) {
 const ownerToken=crypto.randomUUID(),frames=new Map(),operations=new Map(),children=new Map(),groups=new Map(),frameErrors=new Map();
 let session,runtimeId,serviceId,sequence=0;
 const token=()=>`${ownerToken}:${++sequence}`;
 const remember=(map,value)=>{const id=token();map.set(id,value);return id;};
 const take=(map,id)=>{if(!map.has(id))throw new TypeError('资源编号不属于当前ERA实例或已经释放。');return map.get(id);};
 const ref=(name,entry)=>({...entries[name].workflowDescriptor.workflow,entry});
 const envelope=frame=>({ownerToken,frameToken:remember(frames,{...options,...frame,session:frame.session??session,dispatch})});
 function syncFrame(frame){const input=envelope(frame);try{const output=decodePacket(scope.invoke_sync({workflow:ref('sync','protocol'),inputs:{wire_request:encodePacket(input)}}).wireResponse);const result=take(frames,output.frameToken);frames.delete(output.frameToken);return result;}finally{frames.delete(input.frameToken);}}
 async function asyncFrame(frame){const input=envelope(frame);try{const terminal=await scope.run(ref('operation','protocol_operation'),{wire_request:encodePacket(input)});scope.release(terminal.id);children.delete(terminal.id);if(terminal.state!=='succeeded'){const error=frameErrors.get(terminal.id)??fromError(terminal.error);frameErrors.delete(terminal.id);throw error;}const output=decodePacket(terminal.outputs.wireResponse);const result=take(frames,output.frameToken);frames.delete(output.frameToken);return result;}finally{frames.delete(input.frameToken);}}
 const dispatch={...dispatchFactory(syncFrame,asyncFrame),bindSession:frame=>{session=frame.session;return frame;}};
 function fromError(value){if(value instanceof Error)return value;const error=new Error(value?.message??String(value),value?.cause?{cause:fromError(value.cause)}:undefined);for(const key of ['name','code','cleanup_errors','context','errors'])if(value?.[key]!==undefined)error[key]=value[key];return error;}
 const settle=frame=>{for(const resource of [frame.operationResource,frame.modelResource])if(resource?.owner===frame.session)resource.completion.resolve(frame.result);return frame.result;};
 const protocol={
  restore({wire,mode,boundary,instanceId,signal}){
   if(wire.ownerToken!==ownerToken)throw new TypeError('工作流请求不属于当前ERA实例。');
   if(wire.frameToken){const frame=take(frames,wire.frameToken);frames.delete(wire.frameToken);return {...frame,protocolFrame:true};}
   if(wire.operationToken){const frame=take(operations,wire.operationToken);return {...frame,protocolOperation:wire.operationToken};}
   if(boundary.includes('runtime'))return {...options,dispatch,presentationClient,protocolRuntime:true};
   const operationScope={controller:new AbortController(),resources:new Set()};
   if(boundary.includes('parallel')){const group={...wire,session,operationScope};groups.set(instanceId,group);const abort=()=>operationScope.controller.abort(signal.reason);signal.addEventListener('abort',abort,{once:true});group.removeAbort=()=>signal.removeEventListener('abort',abort);if(signal.aborted)abort();return group;}
   return {...resourceRequest(wire.capability,wire.operation,wire.input),session,dispatch,options:{signal:operationScope.controller.signal},operationScope};
  },
  project({value,mode,boundary}){
   if(value.protocolFrame){if(mode==='async')settle(value);return {frameToken:remember(frames,value)};}
   if(boundary.includes('runtime'))return {result:value.result??value};
   if(boundary.includes('parallel'))return {result:value};
   if(value.protocolOperation){settle(value);operations.delete(value.protocolOperation);return {result:value.result};}
   if(value.publicPromise){const id=remember(operations,value);return {result:{pending:id}};}
   return {result:{value:value.result}};
  },
  metadata(){return {ownerToken,...runtimeId?{runtimeId}:{},...serviceId?{serviceId}:{}};},
  async cleanup(){
   const errors=[];
   for(const child of [...children.values()])try{if(!children.has(child.id))continue;if(child.cooperative)await scope.session(runtimeId).wait({id:child.id});else await scope.kill({id:child.id,workflow:child.workflow});}catch(error){errors.push(error);}
   for(const frame of operations.values()){
    frame.operationScope?.controller.abort(new DOMException('ERA instance stopped','AbortError'));
    await Promise.allSettled([...frame.operationScope?.resources??[]].map(resource=>resource.actual));
    frame.generationLease?.release();
    for(const resource of frame.operationScope?.resources??[])resource.completion.reject(new DOMException('ERA instance stopped','AbortError'));
   }
   operations.clear();if(errors.length)throw new AggregateError(errors,'独立工作流资源清理失败。');return {};
  }
 };
 function release(id){
  if(!children.has(id))throw new TypeError('只能释放本实例拥有的已结束子流程。');
  scope.release(id);
  children.delete(id);
 }
 for(const name of ['sync','operation','runtime','parallelReads','service','expression','compaction']){
  const module=entries[name];scope.bind(module.workflowDescriptor,(inputs,runOptions)=>{
   const id=runOptions.workflowInstanceId,isAsync=module.workflowDescriptor.entry_mode==='async';
   if(name==='runtime'&&runOptions.entry==='protocol_runtime')runtimeId=id;
   else if(name==='service')serviceId=id;
   const frame=decodePacket(inputs.wire_request??encodePacket({}));
   if(isAsync&&id!==runtimeId)children.set(id,{id,workflow:module.workflowDescriptor.workflow,cooperative:Boolean(frame.frameToken),...children.get(id)});
   const native=runOptions.workflowSession;
   const workflowSession={...native,async call(request,context){
    const child=await native.call(request,context);
    children.set(child.id,{id:child.id,workflow:request.workflow,...children.get(child.id),parent:id});
    return child;
   }};
   // Coordinator 已复制请求。宿主资源在本地传入，始终留在所属的页面与实例。
   const hostResources={
    metadata:protocol.metadata,release,
    yieldTurn:signal=>yieldHostTurn(session.clock,signal),
    async stopOwned(childId,workflow){
     if(children.get(childId)?.parent!==id)throw new TypeError('只能停止本流程启动的子实例。');
     await scope.kill({id:childId,workflow});
    },
    ...(['sync','operation','runtime','parallelReads'].includes(name)?{
     restore:request=>protocol.restore({...request,instanceId:id,signal:runOptions.signal}),
     project:protocol.project,cleanup:protocol.cleanup,
    }:{}),
   };
   const declaration=module.workflowDescriptor;
   const inputSpecs=declaration.entries?.[runOptions.entry]?.inputs??declaration.inputs;
   const localInputs=inputSpecs.some(input=>input.key==='host_resources')
    ? {...inputs,host_resources:hostResources} : inputs;
   const operation=frame.operationToken?operations.get(frame.operationToken):undefined;
   const abort=()=>operation?.operationScope?.controller.abort(runOptions.signal.reason);
   if(operation){runOptions.signal.addEventListener('abort',abort,{once:true});if(runOptions.signal.aborted)abort();}
   let removeExternal=()=>{},externalStop;
   if(id===runtimeId&&options.signal){const stop=()=>{externalStop=scope.kill({id,workflow:module.workflowDescriptor.workflow});externalStop.catch(()=>{});};options.signal.addEventListener('abort',stop,{once:true});removeExternal=()=>options.signal.removeEventListener('abort',stop);if(options.signal.aborted)stop();}
   let failure;
   const result=(isAsync?module.runWorkflowAsync:module.runWorkflow)(localInputs,{...runOptions,workflowSession});
   if(!isAsync)return result;
   return Promise.resolve(result).catch(error=>{failure=error;if(frame.frameToken)frameErrors.set(id,error);throw error;}).finally(async()=>{
    removeExternal();
    const group=groups.get(id);
    if(group){group.removeAbort();await Promise.allSettled([...group.operationScope.resources].map(resource=>resource.actual));for(const resource of group.operationScope.resources)resource.completion.reject(failure??new DOMException('读取组已结束','AbortError'));groups.delete(id);}
    if(operation){runOptions.signal.removeEventListener('abort',abort);await Promise.allSettled([...operation.operationScope.resources].map(resource=>resource.actual));operation.generationLease?.release();for(const resource of operation.operationScope.resources)resource.completion.reject(failure??new DOMException('操作已结束','AbortError'));operations.delete(frame.operationToken);}
   });
  });
 }
 const presentationClient={
  enqueue:(type,source,args=[])=>scope.closed?Object.freeze({accepted:false,code:'ERA_APP_SERVICE_UNAVAILABLE',message:'ERA 服务未启动或正在停止。'}):syncFrame({action:'admit',origin:'presentation',input:{type,source,args}}).result,
  currentLifecycleToken:()=>session.lifecycleToken,
  waitForCurrentWork:()=>dispatch.waitThrough({session,input:{sequence:session.nextSequence-1}}),
  forCall:parameters=>{if(scope.closed)throw new Error('ERA_FUNCTION_CONTEXT_EXPIRED');return syncFrame({action:'function_submit',input:{parameters,mode:'context'}}).result;},
  subscribeGeneration:(listener,options)=>syncFrame({action:'subscription_control',operation:'register',input:{listener,options}}).result,
  clearGenerationSubscriptions:()=>syncFrame({action:'subscription_control',operation:'cancel',input:{clear:true}}).result,
  readAgentSession:()=>syncFrame({action:'capability',family:'agent',operation:'read_context',input:{}}).result.session,
  diagnostics:()=>syncFrame({action:'diagnostics'}).result,
 };
 return {async run(){try{const result=await scope.run(ref('runtime','protocol_runtime'),{wire_request:encodePacket({ownerToken})});if(result.state!=='succeeded')throw fromError(result.error);return decodePacket(result.outputs.wireResponse).result;}finally{await protocol.cleanup();await scope.close();frames.clear();children.clear();frameErrors.clear();}}};
}
