type Scope = 'character' | 'global' | 'preset';
type Classification = Scope | 'ambiguous' | 'unknown';

function isScope(value: unknown): value is Scope {
  return value === 'character' || value === 'global' || value === 'preset';
}

/** 纯函数：脚本树 Host 事实 -> 唯一安装位置分类。 */
export function classify(value: unknown): Readonly<{ status: Classification; reason: string }> {
  if (!value || typeof value !== 'object') return { status: 'unknown', reason: 'facts-invalid' };
  const facts = value as Record<string, unknown>;
  if (facts.readStatus !== 'complete') return { status: 'unknown', reason: `host-${String(facts.readStatus ?? 'unavailable')}` };
  if (typeof facts.scriptId !== 'string' || facts.scriptId.length === 0) return { status: 'unknown', reason: 'script-id-unavailable' };
  const scopes = Array.isArray(facts.scopes) ? [...new Set(facts.scopes.filter(isScope))] : [];
  if (scopes.length === 1) return { status: scopes[0], reason: `enabled-${scopes[0]}-script` };
  if (scopes.length > 1) return { status: 'ambiguous', reason: 'enabled-in-multiple-scopes' };
  return { status: 'unknown', reason: 'script-id-not-in-enabled-tree' };
}

export function run(inputs: Readonly<{ 'era.installation.scope.facts': { readonly value: unknown } }>): any {
  return { installation_scope_classification: classify(inputs['era.installation.scope.facts'].value) };
}
