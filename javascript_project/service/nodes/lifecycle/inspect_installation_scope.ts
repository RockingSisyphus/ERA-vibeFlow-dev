/** 启动期只采集 Host 原始事实；不在 Node 内推断允许/拒绝策略。 */
interface Ctx {
  readonly capabilities: {
    readonly "era.tavern.installation_scope": {
      read(input: Readonly<Record<string, unknown>>): unknown;
    };
  };
}

export function run(
  _inputs: Readonly<Record<string, never>>,
  _params: Readonly<Record<string, unknown>>,
  context: Ctx,
): any {
  return {
    installation_scope_facts: context.capabilities["era.tavern.installation_scope"].read({}),
  };
}
