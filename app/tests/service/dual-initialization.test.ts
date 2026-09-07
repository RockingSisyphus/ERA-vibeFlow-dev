import { describe, expect, it } from 'vitest';
import {
  planInitialization,
  type InitializationContextV1,
} from '../../../javascript_project/service/base_lib/initialization_transaction';
import { getEraExternalStatusbarHtml } from '@era/example-resources';

function context(mode?: string, firstMessage = '作者正文', html = ''): InitializationContextV1 {
  return {
    schemaVersion: 1,
    step: {
      kind: 'execute',
      task: { kind: 'initialize', operation: 'resources', args: mode ? [{ kind: 'json', value: { mode } }] : [] },
    } as unknown as InitializationContextV1['step'],
    identityRaw: { characterName: '测试卡' },
    scriptVariablesRaw: {},
    messagesRaw: {},
    worldbookRaw: { names: [], entries: [], bindings: {} },
    regexRaw: { enabled: true, regexes: [] },
    characterRaw: { status: 'ready', characterId: 'test.png', firstMessage, externalStatusbar: { html } },
    readFailure: null,
  };
}
describe('双模式初始化的同源资源规划', () => {
  it('外置模式保存默认配置、关闭尾部符号，最后写主开场白且无楼内资源', () => {
    const plan = planInitialization(context('external'));
    expect(plan.disposition).toBe('ready');
    expect(plan.actions.some(action => action.kind === 'upsert-regex')).toBe(false);
    expect(plan.actions[0]).toMatchObject({ kind: 'replace-settings', settings: { 在ai消息尾部生成特殊符号: false } });
    expect(plan.actions).toContainEqual({
      kind: 'patch-external-statusbar',
      characterId: 'test.png',
      patch: { enabled: true, html: getEraExternalStatusbarHtml() },
    });
    expect(plan.actions.at(-1)).toMatchObject({ kind: 'update-main-greeting', expected: '作者正文' });
    const last = plan.actions.at(-1) as { next: string };
    expect(last.next).toContain('作者正文');
    expect(last.next).toContain('<VariableInsert>');
    expect(last.next).not.toContain('<StatusPlaceHolderImpl/>');
  });
  it('无参数仍为传统模式，且不改外置配置', () => {
    const plan = planInitialization(context());
    expect(plan.actions.some(action => action.kind === 'upsert-regex')).toBe(true);
    expect(plan.actions.some(action => action.kind === 'patch-external-statusbar')).toBe(false);
  });
  it.each(['traditional', 'external'])('有标记时 %s 不产生任何写入', mode => {
    const plan = planInitialization(context(mode, '<!-- ERA_DEMO_GREETING_V2_BEGIN -->'));
    expect(plan.disposition).toBe('failed');
    expect(plan.actions).toEqual([]);
  });
  it('已有外置 HTML 或无角色时拒绝，不产生部分资源计划', () => {
    expect(planInitialization(context('external', '原文', '<p>作者内容</p>')).actions).toEqual([]);
    expect(planInitialization({ ...context('external'), identityRaw: {} }).actions).toEqual([]);
  });
});
