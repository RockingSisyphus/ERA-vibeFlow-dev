import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 同一 AOT workflow 的纯启动规则。
// @ts-ignore service root is intentionally outside app tsconfig rootDir.
import { classify } from '../../../javascript_project/service/nodes/lifecycle/classify_installation_scope';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 同一 AOT workflow 的纯启动规则。
// @ts-ignore service root is intentionally outside app tsconfig rootDir.
import { decide } from '../../../javascript_project/service/nodes/lifecycle/decide_startup_policy';

describe('ERA 安装作用域启动策略', () => {
  it('仅唯一且已启用的角色卡脚本被允许完整启动', () => {
    const classification = classify({ scriptId: 'era', scopes: ['character'], readStatus: 'complete' });
    expect(classification).toEqual({ status: 'character', reason: 'enabled-character-script' });
    expect(decide(classification)).toEqual({ classification: 'character', route: 'allow', warn: false });
  });

  it.each(['global', 'preset'] as const)('%s 安装进入 dormant，绝不创建业务运行时', scope => {
    expect(decide({ status: scope, reason: 'enabled' })).toEqual({
      classification: scope,
      route: 'dormant',
      warn: true,
    });
  });

  it('多作用域重复安装拒绝启动；作用域 API 故障只兼容启动并警告', () => {
    expect(classify({ scriptId: 'era', scopes: ['character', 'global'], readStatus: 'complete' })).toEqual({
      status: 'ambiguous',
      reason: 'enabled-in-multiple-scopes',
    });
    expect(decide({ status: 'ambiguous', reason: 'enabled-in-multiple-scopes' })).toEqual({
      classification: 'ambiguous',
      route: 'dormant',
      warn: true,
    });
    expect(decide(classify({ scriptId: 'era', scopes: [], readStatus: 'failed' }))).toEqual({
      classification: 'unknown',
      route: 'allow',
      warn: true,
    });
  });
});
