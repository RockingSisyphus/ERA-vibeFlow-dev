import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';

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
  getEraDemoGreetingBlock(): string;
  planEraDemoGreeting(input: {
    readonly context: CharacterContext;
    readonly firstMessage: string | null;
  }): Readonly<Record<string, unknown>>;
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
      历史状态栏显示范围: 5,
      历史状态栏超出范围行为: 'hidden',
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
      characterRaw: {},
      readFailure: null,
    });
    expect(plan.disposition).toBe('ready');
    expect(plan.actions).toEqual([{ kind: 'replace-settings', settings: candidate }]);
  });

  it('等价应用八项 Zod 默认值、迁移旧强制重载键并 strip 未知字段', () => {
    const defaults = SettingsSchema.parse({});
    const defaultPlan = planner.planEraSettings(undefined);
    expect(defaultPlan).toMatchObject({ status: 'ready', settings: defaults, removedUnknownKeys: [] });

    const raw = {
      特殊符号值: '<自定义/>',
      历史状态栏显示范围: 7,
      强制重载功能: true,
      强制重载消息数: 99,
      调试模式: true,
      未知字段: { 必须被移除: true },
    };
    const candidate = SettingsSchema.parse(raw);
    const plan = planner.planEraSettings(raw);
    expect(plan).toMatchObject({
      status: 'ready',
      settings: candidate,
      removedUnknownKeys: ['强制重载功能', '强制重载消息数', '未知字段'],
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

    expect(() => SettingsSchema.parse({ 开启悬浮球: 'true', 历史状态栏显示范围: '2' })).toThrow();
    const invalid = planner.planEraSettings({ 开启悬浮球: 'true', 历史状态栏显示范围: '2' });
    expect(invalid.status).toBe('invalid');
    expect(invalid.actions).toEqual([]);
    expect(invalid.error).toMatchObject({
      issues: [
        { field: '开启悬浮球', expected: 'boolean', actual: 'string' },
        { field: '历史状态栏显示范围', expected: 'number', actual: 'string' },
      ],
    });

    for (const value of [-1, 1.5]) {
      expect(() => SettingsSchema.parse({ 历史状态栏显示范围: value })).toThrow();
      expect(planner.planEraSettings({ 历史状态栏显示范围: value })).toMatchObject({
        status: 'invalid',
        actions: [],
        error: { issues: [{ field: '历史状态栏显示范围' }] },
      });
    }
    expect(SettingsSchema.parse({ 历史状态栏显示范围: 0 }).历史状态栏显示范围).toBe(0);
    expect(planner.planEraSettings({ 历史状态栏超出范围行为: 'invalid' })).toMatchObject({
      status: 'invalid',
      error: { issues: [{ field: '历史状态栏超出范围行为' }] },
    });
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

  it('Service 规划器产出的变量操作规则与 App 同源文本逐字一致', () => {
    const planned = planner.getEraWorldbookEntries().find(
      entry => entry.name === 'ERA 变量操作规则',
    );
    expect(planned).toBeTruthy();
    expect(planned?.content).toBe(eraVarOperationRuleEntry.content);
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

  it.each(['', '故事正文', '<VariableEdit>{"hp":16}</VariableEdit>'])(
    '默认替换串自身提供围栏分隔，不依赖作者在 %s 后补换行',
    prefix => {
      const replacement = String(planner.getEraRegexPayloads()[0]?.replace_string);
      expect(replacement.startsWith('\n\n```html\n')).toBe(true);
      expect(replacement.endsWith('\n```\n\n')).toBe(true);
      const renderedSource = `${prefix}<StatusPlaceHolderImpl/>后文<StatusPlaceHolderImpl/>`.replaceAll(
        '<StatusPlaceHolderImpl/>',
        replacement,
      );
      expect(renderedSource.match(/^```html$/gm)).toHaveLength(2);
      expect(renderedSource.match(/^```$/gm)).toHaveLength(2);
      expect(renderedSource.startsWith(prefix)).toBe(true);
    },
  );

  it('首个 iframe 先于 ERA 全局启动时使用 Helper 就绪事件，不执行第二套作者渲染器', async () => {
    const html = String(planner.getEraRegexPayloads()[0]?.replace_string);
    const bootstrap = html.match(/<script data-era-statusbar-bootstrap>([\s\S]*?)<\/script>/)?.[1];
    expect(bootstrap).toBeTruthy();
    let initialized!: () => void;
    const globalReady = new Promise<void>(resolve => {
      initialized = resolve;
    });
    let mounts = 0;
    const frame = {
      parent: {} as Record<string, unknown>,
      eraStatusbarMounted: undefined as Promise<void> | undefined,
    };
    runInNewContext(bootstrap!, {
      addEventListener: vi.fn(),
      window: frame,
      document: { body: { dataset: {} } },
      waitGlobalInitialized: (name: string) => {
        expect(name).toBe('ERA');
        return globalReady;
      },
    });
    expect(mounts).toBe(0);
    frame.parent.ERA = {
      statusbar: {
        mount: async () => {
          mounts += 1;
        },
      },
    };
    initialized();
    await frame.eraStatusbarMounted;
    expect(mounts).toBe(1);
    expect(html).toContain('ERA.ready()');
  });

  it('示例作者脚本在本楼发布后重新查询历史，不通过重新加载脚本更新历史栏', async () => {
    const html = String(planner.getEraRegexPayloads()[0]?.replace_string);
    const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)![1];
    const fields = new Map<string, { textContent: string }>();
    const state = (hp: number, revision: number) => ({
      statWithoutMeta: { era_demo: { player: { hp }, test_mode: { enabled: false } } },
      message_id: 2,
      mk: 'floor',
      revision,
    });
    let current = state(9, 12);
    let listener = (_value: ReturnType<typeof state>) => undefined;
    const frame = { eraStatusbarMounted: Promise.resolve(), addEventListener: () => undefined };
    const atMessage = vi.fn(async (id: number) => {
      expect(id).toBe(2);
      return current;
    });
    runInNewContext(script, {
      window: frame,
      document: {
        body: { dataset: {} },
        querySelector: (key: string) => {
          if (!fields.has(key)) fields.set(key, { textContent: '' });
          return fields.get(key);
        },
        querySelectorAll: () => [],
      },
      addEventListener: () => undefined,
      ERA: {
        ready: async () => current,
        get: () => current,
        subscribe: (callback: typeof listener) => {
          listener = callback;
          callback(current);
          return () => undefined;
        },
        history: { atMessage },
      },
    });
    const historical = '[data-era-demo-source="history"][data-era-demo-field="statWithoutMeta"]';
    await vi.waitFor(() => expect(fields.get(historical)?.textContent).toContain('"hp":9'));
    current = state(10, 13);
    listener(current);
    await vi.waitFor(() => expect(fields.get(historical)?.textContent).toContain('"hp":10'));
    expect(atMessage).toHaveBeenCalledTimes(2);
    expect((frame as Record<string, unknown>).__ERA_DEMO_AUTHOR_EXECUTION_COUNT__).toBe(1);
  });

  it('逐字段保持局部正则载荷和注入顺序', () => {
    const candidateRegexes = planner.getEraRegexPayloads();
    expect(candidateRegexes).toHaveLength(1);
    expect(candidateRegexes[0]).toMatchObject({
      script_name: 'ERA 状态栏模板',
      find_regex: '/<StatusPlaceHolderImpl\\/>/gsi',
      source: { user_input: false, ai_output: true },
      destination: { display: true, prompt: false },
    });
    expect(String(candidateRegexes[0]?.replace_string)).toContain('data-era-demo-source="macro"');
    expect(String(candidateRegexes[0]?.replace_string)).toContain('ERA.history.atMessage(messageId)');
    expect(String(candidateRegexes[0]?.replace_string)).toContain(
      "ERA.commit([nestedIncrement('automatic', 'message')]",
    );

    const plan = planner.planEraCharacterRegexes({
      context: character(),
      localRegexEnabled: true,
      existingRegexes: [],
    });
    expect(plan.status).toBe('ready');
    expect(plan.details.map(detail => detail.regexName)).toEqual(candidateRegexes.map(regex => regex.script_name));
    expect(plan.actions.map(action => action.regex)).toEqual(candidateRegexes);
  });

  it('只用一个固定标记判断主开场白是否已经初始化', () => {
    const block = planner.getEraDemoGreetingBlock();
    const marker = '<!-- ERA_DEMO_GREETING_V2_BEGIN -->';
    expect(block).toContain('<VariableInsert>');
    expect(block).toContain('"era_demo"');
    expect(block).toContain('<StatusPlaceHolderImpl/>');
    expect(block.match(/ERA_DEMO_GREETING_V2_BEGIN/gu)).toHaveLength(1);
    expect(block).not.toContain('ERA_DEMO_GREETING_V2_END');

    const created = planner.planEraDemoGreeting({ context: character(), firstMessage: '作者原文' });
    expect(created).toMatchObject({ status: 'created', expected: '作者原文' });
    expect(String(created.next)).toBe('作者原文\n\n' + block);
    expect(planner.planEraDemoGreeting({ context: character(), firstMessage: String(created.next) })).toMatchObject({
      status: 'unchanged',
    });
    expect(
      planner.planEraDemoGreeting({
        context: character(),
        firstMessage: `作者修改后的内容\r\n${marker}\r\n任意自定义内容`,
      }),
    ).toMatchObject({ status: 'unchanged' });
    expect(planner.planEraDemoGreeting({ context: character(), firstMessage: marker })).toMatchObject({
      status: 'unchanged',
    });
    expect(
      planner.planEraDemoGreeting({
        context: character(),
        firstMessage: '<VariableInsert>{"era_demo":{"author":true}}</VariableInsert>',
      }),
    ).toMatchObject({ status: 'created' });
    expect(planner.planEraDemoGreeting({ context: { kind: 'group-chat' }, firstMessage: '原文' })).toMatchObject({
      status: 'skipped',
    });
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
    expect(plan.details[0]).toEqual({
      regexName: 'ERA 状态栏模板',
      status: 'exists',
      compatibility: 'legacy-unmanaged',
    });
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
