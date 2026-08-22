type Classification = 'character' | 'global' | 'preset' | 'ambiguous' | 'unknown';

/** 纯策略：只允许角色卡脚本；作用域 API 不可用时兼容启动并报警。 */
export function decide(value: unknown): Readonly<{ classification: Classification; route: 'allow' | 'dormant'; warn: boolean }> {
  const status = value && typeof value === 'object' ? (value as Record<string, unknown>).status : undefined;
  const classification: Classification = status === 'character' || status === 'global' || status === 'preset' || status === 'ambiguous' || status === 'unknown'
    ? status
    : 'unknown';
  if (classification === 'character') return { classification, route: 'allow', warn: false };
  if (classification === 'unknown') return { classification, route: 'allow', warn: true };
  return { classification, route: 'dormant', warn: true };
}

export function run(inputs: Readonly<{ 'era.installation.scope.classification': { readonly value: unknown } }>): any {
  const installation_scope_decision = decide(inputs['era.installation.scope.classification'].value);
  return { installation_scope_decision, installation_scope_route: installation_scope_decision.route };
}
