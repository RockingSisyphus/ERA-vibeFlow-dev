import {emit, takeFrame, EraServiceHostError, route} from "../base_lib/frames.ts";

export function CheckInstance(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (!f.session?.started) throw new EraServiceHostError("ERA_HOST_NOT_STARTED", "ERA 服务宿主尚未启动。");
  if (f.session.stopping) throw new EraServiceHostError("ERA_HOST_STOPPING", "停止期间不能登记事件入口。");
  return emit({frame: f}, params);
}
export function ChooseScope(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  return emit(route(f, f.operation === "dormant" || f.input?.route === "dormant" ? "dormant" : "allow"), params);
}
export function Allow(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  if (!s.unsubscribe) {
    const releases:(()=>void)[]=[];
    const releaseAll=()=>{for(const release of releases.splice(0))release();};
    const register=(type:string,source:string,order:string,inputType=type)=>{
      const handler=(...args:any[])=>s.dispatch.eventIngress({session:s,input:{type:inputType,source,args}});
      releases.push(s.resources.listen(type,handler,order));
    };
    try {
      if(s.registerTechnicalProjection)releases.push(s.resources.keep(s.registerTechnicalProjection()));
      register(s.api.tavern_events.GENERATION_ENDED,"tavern","normal");
      const buttons=[["写入变量修改","manual_write"],["手动同步状态","manual_sync"],["强制完全重算","manual_full_sync"]];
      const buttonTypes=new Set(buttons.map((b:any)=>b[1]));
      for(const item of s.eventDefinitions)if(!buttonTypes.has(item.type))register(item.type,"tavern",item.listenerOrder);
      for(const [label,type] of buttons)register(s.api.getButtonEvent(label),"ui","normal",type);
      s.unsubscribe=s.resources.keep(releaseAll);
    }catch(error){releaseAll();throw error;}
  }
  f.result = Object.freeze({activated: true});
  return emit({frame: f}, params);
}
export function Dormant(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.result = Object.freeze({activated: false});
  return emit({frame: f}, params);
}
export function SettleStartup(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s=f.session;
  if(f.activationAutomatic||s.startupSettled)return emit({frame:f},params);
  s.startupSettled=true;s.startup.resolve(Object.freeze({...f.input}));s.onStartupDecision?.(f.input);
  if(f.operation!=="dormant"&&f.input?.route!=="dormant"&&s.onActivated&&!s.presentationMounted){
    s.presentationMounted=true;s.resources.mount(()=>s.onActivated(s.presentationClient,s.lifecycle.signal));
  }
  return emit({frame: f}, params);
}
