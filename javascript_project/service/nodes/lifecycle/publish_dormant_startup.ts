interface Ctx {
  readonly capabilities: { readonly 'era.tavern.startup_gate': { dormant(input: Readonly<Record<string, unknown>>): unknown } };
}

export function run(inputs: Readonly<{ 'era.installation.scope.decision': { readonly value: unknown } }>, _params: Readonly<Record<string, unknown>>, context: Ctx): any {
  context.capabilities['era.tavern.startup_gate'].dormant(inputs['era.installation.scope.decision'].value as Record<string, unknown>);
  return {};
}
