type InstallationScope = 'character' | 'global' | 'preset';

/**
 * 读取 Tavern Helper 已启用脚本树的机械适配；是否允许启动仍由 Service
 * workflow 的 era.installation.scope Nodeset 决定。
 */
function enabledScriptIds(tree: readonly ScriptTree[], enabledByAncestors = true): readonly string[] {
  const ids: string[] = [];
  for (const entry of tree) {
    const active = enabledByAncestors && entry.enabled === true;
    if (!active) continue;
    if (entry.type === 'script') {
      ids.push(entry.id);
      continue;
    }
    ids.push(...enabledScriptIds(entry.scripts, active));
  }
  return ids;
}

/**
 * 仅产生原始宿主 DTO，启动策略必须留给 VibeFlow workflow；否则浏览器适配层
 * 会悄悄复制角色卡、全局和预设脚本的业务规则，难以审计也难以测试。
 */
export function readInstallationScopeFacts(): Readonly<Record<string, unknown>> {
  const scriptId = (() => {
    try {
      return getScriptId();
    } catch {
      return null;
    }
  })();
  if (typeof scriptId !== 'string' || scriptId.length === 0) {
    return { scriptId: null, scopes: [], readStatus: 'unavailable' };
  }
  const scopes: InstallationScope[] = [];
  try {
    for (const scope of ['character', 'global', 'preset'] as const) {
      if (enabledScriptIds(getScriptTrees({ type: scope })).includes(scriptId)) {
        scopes.push(scope);
      }
    }
  } catch {
    return { scriptId, scopes: [], readStatus: 'failed' };
  }
  return { scriptId, scopes, readStatus: 'complete' };
}
