import { describe, expect, it } from 'vitest';

import { REPLACE_PLACEHOLDER_REGEX } from '../../src/ERA变量框架/initer/manual/regex_objects/replace_placeholder';
import { eraVarIntentEntry } from '../../src/ERA变量框架/initer/manual/worldbook_entries/era_var_intent';
import { eraVarOperationRuleEntry } from '../../src/ERA变量框架/initer/manual/worldbook_entries/era_var_operation_rule';
import { SettingsSchema } from '../../src/ERA变量框架/utils/constants';

type CharacterContext =
  | {
      readonly kind: 'character';
      readonly characterName: string;
      readonly primaryWorldbook: string | null;
      readonly additionalWorldbooks: readonly string[];
    }
  | { readonly kind: 'group-chat'; readonly groupName?: string }
  | { readonly kind: 'no-character' };

interface SettingsPlan {
  readonly kind: 'settings';
  readonly status: 'ready' | 'invalid';
  readonly settings?: Readonly<Record<string, unknown>>;
  readonly removedUnknownKeys?: readonly string[];
  readonly error?: Readonly<Record<string, unknown>>;
  readonly actions: readonly Readonly<Record<string, unknown>>[];
}

interface WorldbookPlan {
  readonly kind: 'worldbook';
  readonly status: 'ready' | 'skipped' | 'conflict';
  readonly worldbookName?: string;
  readonly createdPrimary?: boolean;
  readonly reason?: string;
  readonly details: readonly {
    readonly entryName: string;
    readonly status: 'planned' | 'exists';
  }[];
  readonly actions: readonly (
    | { readonly kind: 'create-worldbook'; readonly worldbookName: string }
    | {
        readonly kind: 'bind-primary-worldbook';
        readonly characterName: string;
        readonly worldbookName: string;
        readonly additionalWorldbooks: readonly string[];
      }
    | {
        readonly kind: 'create-entry';
        readonly worldbookName: string;
        readonly entry: Readonly<Record<string, unknown>>;
      }
  )[];
}

interface RegexPlan {
  readonly kind: 'regex';
  readonly status: 'ready' | 'skipped';
  readonly reason?: string;
  readonly details: readonly {
    readonly regexName: string;
    readonly status: 'planned' | 'exists';
  }[];
  readonly actions: readonly {
    readonly kind: 'upsert-missing-regex';
    readonly regex: Readonly<Record<string, unknown>>;
  }[];
}

interface PlaceholderPlan {
  readonly kind: 'placeholder';
  readonly status: 'update' | 'skipped' | 'exists';
  readonly messageId?: number;
  readonly textContent?: string;
  readonly reason?: string;
  readonly actions: readonly Readonly<Record<string, unknown>>[];
}

interface ResourcePlannerModule {
  planEraSettings(raw: unknown): SettingsPlan;
  getEraWorldbookEntries(): readonly Readonly<Record<string, unknown>>[];
  planEraWorldbook(input: {
    readonly context: CharacterContext;
    readonly existingWorldbookNames: readonly string[];
    readonly primaryEntries: readonly unknown[];
  }): WorldbookPlan;
  getEraRegexPayloads(): readonly Readonly<Record<string, unknown>>[];
  planEraCharacterRegexes(input: {
    readonly context: CharacterContext;
    readonly localRegexEnabled: boolean;
    readonly existingRegexes: readonly unknown[];
  }): RegexPlan;
  planEraPlaceholder(input: {
    readonly enabled: boolean;
    readonly placeholder: string;
    readonly message:
      | { readonly kind: 'missing'; readonly messageId: number }
      | {
          readonly kind: 'present';
          readonly messageId: number;
          readonly role: 'assistant' | 'user' | 'unknown';
          readonly textContent: string | null;
          readonly attachments?: readonly unknown[];
        };
  }): PlaceholderPlan;
}

interface InitializationTransactionModule {
  planInitialization(context: Readonly<Record<string, unknown>>): {
    readonly disposition: 'ready' | 'failed';
    readonly actions: readonly Readonly<Record<string, unknown>>[];
  };
}

const plannerUrl = new URL('../../../javascript_project/service/base_lib/domain/resource_planner.ts', import.meta.url)
  .href;
const planner = (await import(/* @vite-ignore */ plannerUrl)) as ResourcePlannerModule;
const initializationTransactionUrl = new URL(
  '../../../javascript_project/service/base_lib/initialization_transaction.ts',
  import.meta.url,
).href;
const initializationTransaction = (await import(
  /* @vite-ignore */ initializationTransactionUrl
)) as InitializationTransactionModule;

function character(primaryWorldbook: string | null = '主世界书'): CharacterContext {
  return {
    kind: 'character',
    characterName: '测试角色',
    primaryWorldbook,
    additionalWorldbooks: ['附加世界书'],
  };
}

function actionKinds(plan: WorldbookPlan): string[] {
  return plan.actions.map(action => action.kind);
}

describe('VibeFlow Service 宿主资源规划器差分', () => {
  it('按 UI 合同解包 settings 字段，不把包装对象 strip 成默认设置', () => {
    const candidate = SettingsSchema.parse({
      开启黑夜模式: true,
      强制重载功能: true,
      强制重载消息数: 3,
      特殊符号值: 'ERA_UI_E2E_PLACEHOLDER',
    });
    const plan = initializationTransaction.planInitialization({
      schemaVersion: 1,
      step: {
        kind: 'execute',
        task: {
          kind: 'initialize',
          operation: 'settings-update',
          args: [{ kind: 'json', value: { settings: candidate } }],
        },
      },
      identityRaw: {},
      scriptVariablesRaw: {},
      messagesRaw: {},
      worldbookRaw: {},
      regexRaw: {},
      readFailure: null,
    });
    expect(plan.disposition).toBe('ready');
    expect(plan.actions).toEqual([{ kind: 'replace-settings', settings: candidate }]);
  });

  it('等价应用八项 Zod 默认值并 strip 未知字段', () => {
    const defaults = SettingsSchema.parse({});
    const defaultPlan = planner.planEraSettings(undefined);
    expect(defaultPlan).toMatchObject({ status: 'ready', settings: defaults, removedUnknownKeys: [] });

    const raw = {
      特殊符号值: '<自定义/>',
      强制重载消息数: 7,
      调试模式: true,
      未知字段: { 必须被移除: true },
    };
    const candidate = SettingsSchema.parse(raw);
    const plan = planner.planEraSettings(raw);
    expect(plan).toMatchObject({
      status: 'ready',
      settings: candidate,
      removedUnknownKeys: ['未知字段'],
    });
    expect(plan.actions).toEqual([{ kind: 'replace-settings', settings: candidate }]);
    expect(plan.settings).not.toHaveProperty('未知字段');
  });

  it('对 Zod 同样拒绝的非对象和错误字段类型返回 typed invalid', () => {
    expect(() => SettingsSchema.parse('invalid')).toThrow();
    expect(planner.planEraSettings('invalid')).toMatchObject({
      status: 'invalid',
      error: { code: 'ERA_SETTINGS_INVALID' },
      actions: [],
    });

    expect(() => SettingsSchema.parse({ 开启悬浮球: 'true', 强制重载消息数: '2' })).toThrow();
    const invalid = planner.planEraSettings({ 开启悬浮球: 'true', 强制重载消息数: '2' });
    expect(invalid.status).toBe('invalid');
    expect(invalid.actions).toEqual([]);
    expect(invalid.error).toMatchObject({
      issues: [
        { field: '开启悬浮球', expected: 'boolean', actual: 'string' },
        { field: '强制重载消息数', expected: 'number', actual: 'string' },
      ],
    });

    for (const value of [0, -1, 1.5]) {
      expect(() => SettingsSchema.parse({ 强制重载消息数: value })).toThrow();
      expect(planner.planEraSettings({ 强制重载消息数: value })).toMatchObject({
        status: 'invalid',
        actions: [],
        error: { issues: [{ field: '强制重载消息数' }] },
      });
    }
  });

  it('逐字段保持两条世界书资源载荷及顺序，并为新主书声明 create+bind', () => {
    const candidateEntries = [eraVarOperationRuleEntry, eraVarIntentEntry];
    expect(planner.getEraWorldbookEntries()).toEqual(candidateEntries);

    const plan = planner.planEraWorldbook({
      context: character(null),
      existingWorldbookNames: [],
      primaryEntries: [],
    });
    expect(plan).toMatchObject({
      status: 'ready',
      worldbookName: 'ERA卡示例世界书',
      createdPrimary: true,
      details: [
        { entryName: 'ERA 变量操作规则', status: 'planned' },
        { entryName: 'ERA 变量意图说明', status: 'planned' },
      ],
    });
    expect(actionKinds(plan)).toEqual(['create-worldbook', 'bind-primary-worldbook', 'create-entry', 'create-entry']);
    expect(plan.actions.filter(action => action.kind === 'create-entry').map(action => action.entry)).toEqual(
      candidateEntries,
    );
  });

  it('复用已有主书、保留同名条目且重复规划幂等', () => {
    const existingOperation = { ...eraVarOperationRuleEntry, content: '用户自定义内容', unknown: 1 };
    const input = {
      context: character('角色主书'),
      existingWorldbookNames: ['角色主书'],
      primaryEntries: [existingOperation, { ...eraVarIntentEntry }],
    } as const;
    const before = structuredClone(input.primaryEntries);
    const first = planner.planEraWorldbook(input);
    const second = planner.planEraWorldbook(input);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: 'ready',
      worldbookName: '角色主书',
      createdPrimary: false,
      details: [
        { entryName: 'ERA 变量操作规则', status: 'exists' },
        { entryName: 'ERA 变量意图说明', status: 'exists' },
      ],
      actions: [],
    });
    expect(input.primaryEntries).toEqual(before);
    expect(first.details).not.toBe(second.details);
  });

  it('同名世界书冲突、群聊与无角色均返回清晰 typed plan', () => {
    expect(
      planner.planEraWorldbook({
        context: character(null),
        existingWorldbookNames: ['ERA卡示例世界书'],
        primaryEntries: [],
      }),
    ).toMatchObject({ status: 'conflict', actions: [], details: [] });
    expect(
      planner.planEraWorldbook({
        context: { kind: 'group-chat', groupName: '测试群' },
        existingWorldbookNames: [],
        primaryEntries: [],
      }),
    ).toMatchObject({ status: 'skipped', actions: [], details: [] });
    expect(
      planner.planEraWorldbook({
        context: { kind: 'no-character' },
        existingWorldbookNames: [],
        primaryEntries: [],
      }),
    ).toMatchObject({ status: 'skipped', actions: [], details: [] });
  });

  it('逐字段保持局部正则载荷和注入顺序', () => {
    const candidateRegexes = [REPLACE_PLACEHOLDER_REGEX];
    expect(planner.getEraRegexPayloads()).toEqual(candidateRegexes);

    const plan = planner.planEraCharacterRegexes({
      context: character(),
      localRegexEnabled: true,
      existingRegexes: [],
    });
    expect(plan.status).toBe('ready');
    expect(plan.details.map(detail => detail.regexName)).toEqual(candidateRegexes.map(regex => regex.script_name));
    expect(plan.actions.map(action => action.regex)).toEqual(candidateRegexes);
  });

  it('关闭局部正则时仍规划状态栏并由 Host 启用；群聊和无角色 typed skipped；同名对象保留', () => {
    const disabled = planner.planEraCharacterRegexes({
      context: character(),
      localRegexEnabled: false,
      existingRegexes: [],
    });
    expect(disabled).toMatchObject({
      status: 'ready',
      details: [{ regexName: 'ERA 状态栏模板', status: 'planned' }],
    });
    expect(disabled.actions).toHaveLength(1);

    for (const context of [{ kind: 'group-chat' }, { kind: 'no-character' }] as const) {
      expect(planner.planEraCharacterRegexes({ context, localRegexEnabled: true, existingRegexes: [] })).toMatchObject({
        status: 'skipped',
        actions: [],
        details: [],
      });
    }

    const existing = [{ script_name: 'ERA 状态栏模板', replace_string: '用户自定义', id: 'keep-me' }];
    const before = structuredClone(existing);
    const plan = planner.planEraCharacterRegexes({
      context: character(),
      localRegexEnabled: true,
      existingRegexes: existing,
    });
    expect(plan.details[0]).toEqual({ regexName: 'ERA 状态栏模板', status: 'exists' });
    expect(plan.actions).toHaveLength(0);
    expect(existing).toEqual(before);
  });

  it('仅对缺少目标串的 AI 文本声明 trimEnd+换行+placeholder 更新', () => {
    const plan = planner.planEraPlaceholder({
      enabled: true,
      placeholder: '<StatusPlaceHolderImpl/>',
      message: {
        kind: 'present',
        messageId: 42,
        role: 'assistant',
        textContent: '正文尾部   \n\n',
      },
    });
    expect(plan).toEqual({
      kind: 'placeholder',
      status: 'update',
      messageId: 42,
      textContent: '正文尾部\n<StatusPlaceHolderImpl/>',
      actions: [
        {
          kind: 'update-message-text',
          messageId: 42,
          textContent: '正文尾部\n<StatusPlaceHolderImpl/>',
        },
      ],
    });
    expect(
      planner.planEraPlaceholder({
        enabled: true,
        placeholder: '<StatusPlaceHolderImpl/>',
        message: { kind: 'present', messageId: 43, role: 'assistant', textContent: null },
      }),
    ).toMatchObject({ status: 'update', textContent: '\n<StatusPlaceHolderImpl/>' });
  });

  it('关闭、空消息、用户、未知角色和已含占位符均不写入', () => {
    const fixtures = [
      { enabled: false, message: { kind: 'present', messageId: 1, role: 'assistant', textContent: '正文' } },
      { enabled: true, message: { kind: 'missing', messageId: 2 } },
      { enabled: true, message: { kind: 'present', messageId: 3, role: 'user', textContent: '正文' } },
      { enabled: true, message: { kind: 'present', messageId: 4, role: 'unknown', textContent: '正文' } },
      {
        enabled: true,
        message: {
          kind: 'present',
          messageId: 5,
          role: 'assistant',
          textContent: '正文\n<StatusPlaceHolderImpl/>',
        },
      },
    ] as const;
    for (const fixture of fixtures) {
      expect(
        planner.planEraPlaceholder({
          ...fixture,
          placeholder: '<StatusPlaceHolderImpl/>',
        }),
      ).toMatchObject({ actions: [] });
    }
  });

  it('多模态输入只产生文本 action，不修改或复制附件', () => {
    const attachments = [
      { type: 'image', url: 'asset://image-1' },
      { type: 'audio', url: 'asset://audio-1' },
    ] as const;
    const before = structuredClone(attachments);
    const first = planner.planEraPlaceholder({
      enabled: true,
      placeholder: '<P/>',
      message: {
        kind: 'present',
        messageId: 99,
        role: 'assistant',
        textContent: '文本',
        attachments,
      },
    });
    const second = planner.planEraPlaceholder({
      enabled: true,
      placeholder: '<P/>',
      message: {
        kind: 'present',
        messageId: 99,
        role: 'assistant',
        textContent: '文本',
        attachments,
      },
    });
    expect(first.actions[0]).toEqual({
      kind: 'update-message-text',
      messageId: 99,
      textContent: '文本\n<P/>',
    });
    expect(first.actions[0]).not.toHaveProperty('attachments');
    expect(attachments).toEqual(before);
    expect(first.actions).not.toBe(second.actions);
    expect(first.actions[0]).not.toBe(second.actions[0]);
  });
});
