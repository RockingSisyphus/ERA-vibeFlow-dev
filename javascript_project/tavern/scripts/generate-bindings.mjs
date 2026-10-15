
/** 仅生成固定参数接线；运行时不解释接口表、不维护调度或资源策略。 */
export function generateBindings(declaration) {
  const quote=JSON.stringify;
  const lines=['// GENERATED from bindings.jsonc. Do not edit.','export async function runEra(entries, options = {}) {','  let session;'];
  lines.push('  const syncFrame = frame => entries.sync({request:{...options,...frame,session,dispatch}}).result;');
  lines.push('  const asyncFrame = async frame => (await entries.async({request:{...options,...frame,session,dispatch}})).result;');
  lines.push('  const dispatch = {', '    bindSession: frame => { session = frame.session; return frame; },', '    runService: (inputs, callOptions) => entries.service(inputs, {signal:callOptions.signal,capabilities}),');
  for(const recipe of declaration.dispatch_recipes) {
    const asyncRecipe=recipe.steps.some(step=>step.entry==='async');
    lines.push(`    ${quote(recipe.name)}: ${asyncRecipe?'async ':''}frame => {`);
    for(const [index,step] of recipe.steps.entries()) {
      const input=index===0?'frame':`step${index-1}`;
      const request=step.action?`{...${input},action:${quote(step.action)}}`:input;
      const invoke=`${step.entry==='async'?'await asyncFrame':'syncFrame'}(${request})`;
      const expression=step.projection==='value'?`(${invoke}).result`:invoke;
      lines.push(index===recipe.steps.length-1?`      return ${expression};`:`      const step${index} = ${expression};`);
    }
    lines.push('    },');
  }
  lines.push('  };','  const capabilities = {');
  const callOptionsProjection='{'+declaration.capability_call_option_fields.map(field=>`${field}:callOptions.${field}`).join(',')+'}';
  const groups=Object.groupBy(declaration.capabilities,cap=>cap.capability);
  for(const [id,operations] of Object.entries(groups)) {
    lines.push(`    ${quote(id)}: {`);
    for(const cap of operations) {
      const request=cap.family?`{origin:${quote(declaration.capability_origin)},action:${quote(cap.action)},family:${quote(cap.family)},operation:${quote(cap.operation)},input,options:${callOptionsProjection}}`:`{origin:${quote(declaration.capability_origin)},action:${quote(cap.action)},input,options:${callOptionsProjection}}`;
      let expression;
      if(id==='vibeflow.port'&&cap.operation==='receive') {
        const prepare=declaration.port_recipes.receive.prepare_action;
        expression=`(await asyncFrame({...syncFrame({origin:${quote(declaration.capability_origin)},action:${quote(prepare)},input,options:${callOptionsProjection}}),action:${quote(cap.action)}})).result`;
      } else {
        const projected=cap.invocation?.includes('native')?'publicPromise':'result';
        expression=`syncFrame(${request}).${projected}`;
      }
      lines.push(`      ${quote(cap.operation)}: ${cap.completion==='suspend'?'async ':''}(input, callOptions = {}) => ${expression},`);
    }
    lines.push('    },');
  }
  lines.push('  };');
  const client=declaration.presentation_client;
  lines.push('  const presentationClient = {',
    `    enqueue: (type, source, args = []) => syncFrame({action:${quote(client.admit_action)},origin:${quote(client.admission_origin)},input:{type,source,args}}).result,`,
    `    currentLifecycleToken: () => session.${client.lifecycle_field},`,
    `    forCall: parameters => syncFrame({action:${quote(client.context_action)},input:{parameters,mode:"context"}}).result,`,
    `    subscribeGeneration: (listener, options) => syncFrame({action:${quote(client.subscription_action)},operation:"register",input:{listener,options}}).result,`,
    `    clearGenerationSubscriptions: () => syncFrame({action:${quote(client.subscription_action)},operation:${quote(client.clear_subscription_operation)},input:{clear:true}}).result,`,
    `    readAgentSession: () => syncFrame({...${JSON.stringify(client.agent_context)},input:{}}).result.session,`,
    `    diagnostics: () => syncFrame({action:${quote(client.diagnostics_action)}}).result,`,
    '  };');
  lines.push(`  return (await entries.${declaration.native_entry.entry}({request:{...options,dispatch,capabilities,presentationClient}},{signal:options.signal})).result;`);
  lines.push('}','');return lines.join('\n');
}
