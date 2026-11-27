/** 只生成固定官方调用接线；实际资源由同页边界拥有，业务分支由Config拥有。 */
export function generateBindings(declaration) {
 const quote=JSON.stringify;
 const lines=[
  '// GENERATED from bindings.jsonc. Do not edit.',
  'import {Coordinator} from "../../../kernel/javascript/coordinator.mjs";',
  'import {encodePacket,decodePacket} from "../../../base_lib/workflow_values/codec.mjs";',
  'import {createResourceOwner} from "../plugins/protocol_resources/runtime.mjs";',
  'export function runEra(entries,options={}) {',
  ' const dispatchFactory=(syncFrame,asyncFrame)=>({',
 ];
 for(const recipe of declaration.dispatch_recipes) {
  const async=recipe.steps.some(step=>step.entry==='async');
  lines.push(`${quote(recipe.name)}:${async?'async ':''}frame=>{`);
  for(const [i,step] of recipe.steps.entries()){
   const input=i===0?'frame':`step${i-1}`;
   const request=step.action?`{...${input},action:${quote(step.action)}}`:input;
   let expression=`${step.entry==='async'?'await asyncFrame':'syncFrame'}(${request})`;
   if(step.projection==='value')expression=`(${expression}).result`;
   lines.push(i===recipe.steps.length-1?`return ${expression};`:`const step${i}=${expression};`);
  }
  lines.push('},');
 }
 lines.push('});',' const resourceRequest=(capability,operation,input)=>{switch(capability+"/"+operation){');
 for(const cap of declaration.capabilities){
  lines.push(`case ${quote(cap.capability+'/'+cap.operation)}:return {origin:${quote(declaration.capability_origin)},action:${quote(cap.action)},family:${quote(cap.family)},operation:${quote(cap.operation)},input};`);
 }
 lines.push('default:throw new TypeError("未登记的酒馆资源请求。");}};',
  ' return createResourceOwner({scope:new Coordinator(),entries,encodePacket,decodePacket,options,dispatchFactory,resourceRequest}).run();','}','');
 return lines.join('\n');
}
