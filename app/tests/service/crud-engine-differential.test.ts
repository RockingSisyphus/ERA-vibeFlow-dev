import lodash from 'lodash';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  applyDelete,
  applyEdit,
  applyInsert,
  applyMessageCommands,
  escapeEraData,
  mergeReplaceArray,
  parseJsonl,
  parseMessageCommands,
  sanitizeArrays,
  type EraApplyMessageCommandsInput,
  type EraCrudCommand,
  type EraCrudResult,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 差分测试必须直接读取跨 root 的 VibeFlow 纯函数源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/domain/crud_engine';

interface LegacyCrudResult {
  readonly finalStat: unknown;
  readonly editLog: readonly unknown[];
}

interface LegacyModules {
  readonly parseCommands: (content: string, toSimplified?: boolean) => EraCrudCommand[];
  readonly insert: (blocks: readonly unknown[], stat: unknown) => Promise<LegacyCrudResult>;
  readonly edit: (
    blocks: readonly unknown[],
    messageId: number,
    stat: unknown,
    meta: Readonly<Record<string, unknown>>,
  ) => Promise<LegacyCrudResult>;
  readonly remove: (blocks: readonly unknown[], stat: unknown) => Promise<LegacyCrudResult>;
  readonly applyMessage: (
    content: string,
    messageId: number,
    stat: unknown,
    meta: Readonly<Record<string, unknown>>,
    toSimplified?: boolean,
  ) => Promise<LegacyCrudResult>;
  readonly parseJsonl: (source: string) => unknown[];
  readonly escapeEraData: <T>(value: T) => T;
  readonly sanitizeArrays: (value: unknown) => unknown;
  readonly mergeReplaceArray: (base: unknown, patch: unknown) => unknown;
}

let legacy: LegacyModules;

function historyMeta(): Readonly<Record<string, unknown>> {
  return {
    SelectedMks: [null, 'mk-history', null],
    EditLogs: {
      'mk-history': [
        { op: 'insert', path: 'hero.hp', value_new: 7, future: '保留' },
        {
          op: 'insert',
          path: 'hero.profile',
          value_new: { level: 2, title: '旧称号' },
        },
      ],
      futureBucket: { untouched: true },
    },
    futureMeta: { untouched: true },
  };
}

function messageWithCommands(body: string, messageId = 2) {
  return {
    message_id: messageId,
    role: 'assistant',
    mes: `${body}\n<era_data>{"era-message-key"="mk-current","era-message-type"="assistant"}</era_data>`,
  };
}

async function expectInsertEqual(blocks: readonly unknown[], stat: unknown) {
  const expected = await legacy.insert(blocks, stat);
  const actual = applyInsert(blocks, stat);
  expect(actual).toEqual(expected);
  return actual;
}

async function expectEditEqual(
  blocks: readonly unknown[],
  stat: unknown,
  messageId = 2,
  meta: Readonly<Record<string, unknown>> = historyMeta(),
) {
  const expected = await legacy.edit(blocks, messageId, stat, meta);
  const actual = applyEdit(blocks, stat, { messageId, meta });
  expect(actual).toEqual(expected);
  return actual;
}

async function expectDeleteEqual(blocks: readonly unknown[], stat: unknown) {
  const expected = await legacy.remove(blocks, stat);
  const actual = applyDelete(blocks, stat);
  expect(actual).toEqual(expected);
  return actual;
}

beforeAll(async () => {
  const globals = globalThis as unknown as {
    _: typeof lodash;
    SillyTavern: { name1: string; name2: string };
  };
  globals._ = lodash;
  globals.SillyTavern = { name1: '测试用户', name2: '测试角色' };

  const [message, insert, update, remove, patcher, data] = await Promise.all([
    import('../../src/ERA变量框架/utils/message'),
    import('../../src/ERA变量框架/core/crud/insert/insert'),
    import('../../src/ERA变量框架/core/crud/update'),
    import('../../src/ERA变量框架/core/crud/delete'),
    import('../../src/ERA变量框架/core/crud/patcher'),
    import('../../src/ERA变量框架/utils/data'),
  ]);

  legacy = {
    parseCommands: (content, toSimplified = false) =>
      message.extractAndParseCommands(messageWithCommands(content), toSimplified),
    insert: (blocks, stat) => insert.processInsertBlocks([...blocks], stat),
    edit: (blocks, messageId, stat, meta) => update.processEditBlocks([...blocks], messageId, stat, meta),
    remove: (blocks, stat) => remove.processDeleteBlocks([...blocks], stat),
    applyMessage: async (content, messageId, stat, meta, toSimplified = false) => {
      const result = await patcher.ApplyVarChangeForMessage(messageWithCommands(content, messageId), stat, meta, {
        繁体转简体: toSimplified,
      });
      return { finalStat: result.finalStat, editLog: result.finalEditLog };
    },
    parseJsonl: data.parseJsonl,
    escapeEraData: data.escapeEraData,
    sanitizeArrays: data.sanitizeArrays,
    mergeReplaceArray: data.mergeReplaceArray,
  };
});

describe('ERA 纯 CRUD 引擎冻结基线差分', () => {
  it('按原位置解析混合三标签、JSONL、注释与代码围栏', () => {
    const content = `
      <VariableEdit>
      {"hero":{"hp":11}} // 行注释
      {"hero":{"title":"https://example.com/a//b"}}
      </VariableEdit>
      <VariableThink>{"不会":"进入"}</VariableThink>
      <VariableInsert>
      \`\`\`json
      {"hero":{"name":"A.B's \\"称号\\""}}
      \`\`\`
      </VariableInsert>
      <VariableDelete><!-- 块注释 -->{"hero":{"obsolete":{}}}</VariableDelete>
    `;

    const actual = parseMessageCommands({ content });
    expect(actual).toEqual(legacy.parseCommands(content));
    expect(actual.map(command => command.type)).toEqual(['edit', 'insert', 'delete']);
    expect(actual[1]?.data).toEqual([{ hero: { name: 'A__DOT__B__SQUOTE__s __DQUOTE__称号__DQUOTE__' } }]);
  });

  it('无效、空白、嵌套冲突标签保持跳过语义', () => {
    const content = `
      <VariableInsert>not-json</VariableInsert>
      <VariableEdit>   </VariableEdit>
      <VariableInsert>{"ok":1}<VariableDelete>{"bad":{}}</VariableDelete></VariableInsert>
      <VariableDelete>{"missing":{}}</VariableDelete>
    `;
    expect(parseMessageCommands({ content })).toEqual(legacy.parseCommands(content));
  });

  it('繁体转简体在解析前处理键和值，并与 opencc-js 冻结实现一致', () => {
    const content = '<VariableInsert>{"角色":{"體力":10,"地點":"臺灣","標籤":"劍士"}}</VariableInsert>';
    const actual = parseMessageCommands({ content, traditionalToSimplified: true });

    expect(actual).toEqual(legacy.parseCommands(content, true));
    expect(actual).toEqual([
      {
        type: 'insert',
        data: [{ 角色: { 体力: 10, 地点: '台湾', 标签: '剑士' } }],
      },
    ]);
  });

  it('JSONL 注释状态机保留字符串中的 URL，并与冻结工具逐项相等', () => {
    const source = `
      // leading
      {"url":"https://example.com/a//b","note":"/* literal */"}
      /* between */
      {"value":2} <!-- trailing -->
    `;
    expect(parseJsonl(source)).toEqual(legacy.parseJsonl(source));
    expect(parseJsonl(source)).toEqual([{ url: 'https://example.com/a//b', note: '/* literal */' }, { value: 2 }]);
  });

  it('转义、数组净化和数组覆盖式合并直接与冻结工具差分', () => {
    const value = {
      'a.b': `x"y'z`,
      array: [{ nested: true }, null, [1, 2], 'plain'],
    };
    const base = { nested: { left: 1 }, array: [1, 2], unknown: { keep: true } };
    const patch = { nested: { right: 2 }, array: [3, null] };

    expect(escapeEraData(value)).toEqual(legacy.escapeEraData(value));
    expect(sanitizeArrays(value)).toEqual(legacy.sanitizeArrays(value));
    expect(mergeReplaceArray(base, patch)).toEqual(legacy.mergeReplaceArray(base, patch));
  });

  it('Insert 原子插入、递归补充和同消息顺序保持一致', async () => {
    const stat = { hero: { hp: 10 }, untouched: { future: true } };
    const blocks = [
      { hero: { hp: 99, name: 'Alice' }, inventory: { slots: 2 } },
      { hero: { title: 'Knight' }, inventory: { extra: true } },
    ];
    const result = await expectInsertEqual(blocks, stat);

    expect(result.finalStat).toEqual({
      hero: { hp: 10, name: 'Alice', title: 'Knight' },
      inventory: { slots: 2, extra: true },
      untouched: { future: true },
    });
    expect(result.editLog.map(log => log.path)).toEqual(['hero.name', 'inventory', 'hero.title', 'inventory.extra']);
  });

  it('Insert 模板、数组整体覆盖和数组元素字符串化保持一致', async () => {
    const stat = {
      group: {
        $template: {
          hp: 10,
          tags: ['default'],
          profile: { rank: 'novice', flags: ['base'] },
        },
      },
    };
    const blocks = [
      {
        group: {
          alice: {
            hp: 15,
            tags: ['specific', null, { marker: true }],
            profile: { flags: ['patch'] },
          },
        },
      },
    ];
    const result = await expectInsertEqual(blocks, stat);
    const alice = (result.finalStat as { group: { alice: Record<string, unknown> } }).group.alice;

    expect(alice).toEqual({
      hp: 15,
      tags: ['specific', null, '{"marker":true}'],
      profile: { rank: 'novice', flags: ['patch'] },
    });
  });

  it('unInsertAble all/self 保护及 meta-only 解锁路径保持一致', async () => {
    const stat = {
      lockedAll: { $meta: { unInsertAble: 'all' }, existing: {} },
      lockedSelf: { $meta: { unInsertAble: 'self' }, existing: {} },
    };
    const blocks = [
      {
        lockedAll: { rejected: 1 },
        lockedSelf: { rejected: 1, existing: { deep: 2 }, $meta: { note: 'ok' } },
      },
      { lockedAll: { $meta: { note: 'meta-only' } } },
    ];
    const result = await expectInsertEqual(blocks, stat);

    expect(result.finalStat).toEqual({
      lockedAll: {
        $meta: { unInsertAble: 'all', note: 'meta-only' },
        existing: {},
      },
      lockedSelf: {
        $meta: { unInsertAble: 'self', note: 'ok' },
        existing: { deep: 2 },
      },
    });
  });

  it('Edit 只写已有路径、记录同值意图并执行数组净化', async () => {
    const stat = {
      hero: {
        hp: 10,
        title: 'old',
        array: [{ old: true }, null],
      },
      futureState: { untouched: true },
    };
    const blocks = [
      {
        hero: {
          hp: 10,
          title: 'new',
          missing: 'skip',
          array: [{ next: true }, null, [1, 2]],
        },
      },
    ];
    const result = await expectEditEqual(blocks, stat);

    expect((result.finalStat as { hero: Record<string, unknown> }).hero).toEqual({
      hp: 10,
      title: 'new',
      array: ['{"next":true}', null, '[1,2]'],
    });
    expect(result.editLog.map(log => log.path)).toEqual(['hero.hp', 'hero.title', 'hero.array']);
    expect(result.editLog[0]).toMatchObject({ op: 'update', value_old: 7, value_new: 10 });
  });

  it('Edit 从父级历史 value_new 追溯旧值', async () => {
    const stat = { hero: { profile: { level: 3, title: 'current' } } };
    const result = await expectEditEqual([{ hero: { profile: { title: 'next' } } }], stat);

    expect(result.editLog).toEqual([
      {
        op: 'update',
        path: 'hero.profile.title',
        value_old: '旧称号',
        value_new: 'next',
      },
    ]);
  });

  it('updatable=false 阻止子树更新，显式 true 同批解除并允许其余更新', async () => {
    const stat = { locked: { $meta: { updatable: false }, hp: 5 } };
    const blocks = [{ locked: { hp: 6 } }, { locked: { $meta: { updatable: true }, hp: 7 } }];
    const result = await expectEditEqual(blocks, stat);

    expect(result.finalStat).toEqual({ locked: { $meta: { updatable: true }, hp: 7 } });
    expect(result.editLog.map(log => log.path)).toEqual(['locked.$meta.updatable', 'locked.hp']);
  });

  it('Delete 保持 necessary self/children/all 保护层级', async () => {
    const stat = {
      self: { $meta: { necessary: 'self' }, value: 1 },
      children: { $meta: { necessary: 'children' }, direct: 1, branch: { leaf: 2 } },
      all: { $meta: { necessary: 'all' }, value: 3 },
      free: { value: 4 },
    };
    const blocks = [
      {
        self: {},
        children: { direct: {}, branch: { leaf: {} } },
        all: { value: {} },
        free: { value: {} },
      },
    ];
    const result = await expectDeleteEqual(blocks, stat);

    expect(result.finalStat).toEqual({
      self: { $meta: { necessary: 'self' }, value: 1 },
      children: { $meta: { necessary: 'children' }, direct: 1, branch: {} },
      all: { $meta: { necessary: 'all' }, value: 3 },
      free: {},
    });
    expect(result.editLog.map(log => log.path)).toEqual(['children.branch.leaf', 'free.value']);
  });

  it('Delete 可精确删除 necessary 或整个 $meta 后再执行后续删除', async () => {
    const stat = {
      node: { $meta: { necessary: 'all', future: true }, value: 1 },
      other: { $meta: { necessary: 'self' }, value: 2 },
    };
    const blocks = [
      { node: { $meta: { necessary: {} } }, other: { $meta: {} } },
      { node: { value: {} }, other: {} },
    ];
    const result = await expectDeleteEqual(blocks, stat);

    expect(result.finalStat).toEqual({ node: { $meta: { future: true } } });
    expect(result.editLog.map(log => log.path)).toEqual(['node.$meta.necessary', 'other.$meta', 'node.value', 'other']);
  });

  it('完整消息严格按 Insert → Edit → Delete 的实际出现顺序执行', async () => {
    const content = `
      <VariableInsert>{"hero":{"hp":10,"title":"temp","unknown":{"keep":true}}}</VariableInsert>
      <VariableEdit>{"hero":{"hp":12}}</VariableEdit>
      <VariableDelete>{"hero":{"title":{}}}</VariableDelete>
      <VariableInsert>{"hero":{"afterDelete":"yes"}}</VariableInsert>
    `;
    const initialStat = { preexisting: { untouched: true } };
    const input: EraApplyMessageCommandsInput = {
      content,
      messageId: 2,
      initialStat,
      meta: historyMeta(),
    };
    const expected = await legacy.applyMessage(content, 2, initialStat, historyMeta());
    const actual = applyMessageCommands(input);

    expect({ finalStat: actual.finalStat, editLog: actual.editLog }).toEqual(expected);
    expect(actual.commands.map(command => command.type)).toEqual(['insert', 'edit', 'delete', 'insert']);
    expect(actual.finalStat).toEqual({
      preexisting: { untouched: true },
      hero: { hp: 12, unknown: { keep: true }, afterDelete: 'yes' },
    });
  });

  it('完整消息繁转简路径与冻结 ApplyVarChangeForMessage 一致', async () => {
    const content = `
      <VariableInsert>{"角色":{"體力":10,"稱號":"劍士"}}</VariableInsert>
      <VariableEdit>{"角色":{"體力":11}}</VariableEdit>
    `;
    const input: EraApplyMessageCommandsInput = {
      content,
      messageId: 2,
      initialStat: {},
      meta: historyMeta(),
      traditionalToSimplified: true,
    };
    const actual = applyMessageCommands(input);
    const expected = await legacy.applyMessage(content, 2, {}, historyMeta(), true);

    expect({ finalStat: actual.finalStat, editLog: actual.editLog }).toEqual(expected);
    expect(actual.finalStat).toEqual({ 角色: { 体力: 11, 称号: '剑士' } });
  });

  it('完整消息将点号、双引号与单引号键值转义后再执行', async () => {
    const content = String.raw`<VariableInsert>{"profile.data":{"quote\"key":"A.B's \"title\""}}</VariableInsert>`;
    const input: EraApplyMessageCommandsInput = {
      content,
      messageId: 2,
      initialStat: {},
      meta: historyMeta(),
    };
    const actual = applyMessageCommands(input);
    const expected = await legacy.applyMessage(content, 2, {}, historyMeta());

    expect({ finalStat: actual.finalStat, editLog: actual.editLog }).toEqual(expected);
    expect(actual.finalStat).toEqual({
      profile__DOT__data: {
        quote__DQUOTE__key: 'A__DOT__B__SQUOTE__s __DQUOTE__title__DQUOTE__',
      },
    });
  });

  it('保护、空命令与异常形状不抛出且保持候选结果', async () => {
    const malformedBlocks: readonly unknown[] = [null, [], {}, 'string', 7];
    const stat = { stable: { value: 1 }, array: [1, null, 3] };

    await expectInsertEqual(malformedBlocks, stat);
    await expectEditEqual(malformedBlocks, stat);
    await expectDeleteEqual(malformedBlocks, stat);
    expect(applyMessageCommands({ content: 'no commands', messageId: 2, initialStat: stat, meta: {} })).toEqual({
      finalStat: stat,
      editLog: [],
      commands: [],
    });
  });

  it('所有公开纯 API 都不修改输入、未知字段与数组 null 位置', async () => {
    const stat = {
      known: { value: 1 },
      futureState: { deep: ['x', null, { untouched: true }] },
    };
    const meta = historyMeta();
    const blocks = [{ known: { value: 2 } }];
    const input = {
      content: '<VariableEdit>{"known":{"value":2}}</VariableEdit>',
      messageId: 2,
      initialStat: stat,
      meta,
    };
    const before = JSON.stringify({ stat, meta, blocks, input });

    applyInsert(blocks, stat);
    applyEdit(blocks, stat, { messageId: 2, meta });
    applyDelete([{ missing: {} }], stat);
    applyMessageCommands(input);

    expect(JSON.stringify({ stat, meta, blocks, input })).toBe(before);
    const actual = await expectEditEqual(blocks, stat, 2, meta);
    expect(actual.finalStat).toMatchObject({
      futureState: { deep: ['x', null, { untouched: true }] },
    });
  });

  it('各公开操作返回 JSON 可序列化结果', () => {
    const result: EraCrudResult = applyInsert([{ a: { b: [1, null, { c: true }] } }], {});
    const messageResult = applyMessageCommands({
      content: '<VariableInsert>{"x":1}</VariableInsert>',
      messageId: 0,
      initialStat: {},
      meta: {},
    });

    expect(() => JSON.stringify(result)).not.toThrow();
    expect(() => JSON.stringify(messageResult)).not.toThrow();
  });
});
