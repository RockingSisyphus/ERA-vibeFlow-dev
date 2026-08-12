import lodash from 'lodash';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  calculateAllStatsBetweenMks,
  calculateStatAt,
  calculateStatForward,
  executeSnapshotQuery,
  findLatestNewValue,
  parseEditLog,
  removeMetaFields,
  rollbackStatToMK,
  unescapeEraData,
  type EraQueryResultPayload,
  type EraSnapshotQueryInput,
  type EraSnapshotQueryType,
  type EraSnapshotVariables,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 该差分测试必须直接读取冻结的跨 root 纯函数源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/domain/snapshot_query';

interface Fixture {
  readonly variables: EraSnapshotVariables;
  readonly messages: readonly unknown[];
}

interface LegacyModules {
  readonly getStatAtMK: (mk: string) => object | null;
  readonly getStatsBetweenMKs: (
    startMk?: string,
    endMk?: string,
  ) => Array<{ readonly mk: string; readonly message_id: number; readonly stat: object }> | null;
  readonly calculateStatAt: (
    mk: string,
    selectedMks: (string | null)[],
    logs: Readonly<Record<string, unknown>>,
  ) => object;
  readonly calculateStatForward: (
    stat: object,
    startMk: string,
    targetMk: string,
    selectedMks: (string | null)[],
    logs: Readonly<Record<string, unknown>>,
  ) => object;
  readonly calculateAllStatsBetweenMks: (
    startMk: string,
    endMk: string,
    selectedMks: (string | null)[],
    logs: Readonly<Record<string, unknown>>,
  ) => Array<{ readonly mk: string; readonly message_id: number; readonly stat: object }>;
  readonly rollbackStatToMK: (
    targetMk: string | null | undefined,
    currentMk: string,
    stat: object,
    selectedMks: (string | null)[],
    logs: Readonly<Record<string, unknown>>,
  ) => object;
  readonly findLatestNewValue: (
    path: string,
    startMessageId: number,
    selectedMks: (string | null)[],
    logs: Readonly<Record<string, unknown>>,
  ) => unknown;
  readonly parseEditLog: (raw: unknown) => unknown[];
  readonly unescapeEraData: <T>(value: T) => T;
  readonly removeMetaFields: <T>(value: T) => T;
  readonly isUserMessage: (message: unknown) => boolean;
}

let activeFixture: Fixture;
let legacy: LegacyModules;

function makeFixture(): Fixture {
  const selectedMks: (string | null)[] = [null, 'mk-array', 'mk-object', null, 'mk-fenced', 'mk-ignored'];
  const editLogs: Record<string, unknown> = {
    'mk-array': [
      {
        op: 'insert',
        path: 'player',
        value_new: {
          hp: 10,
          display__DOT__name: 'Alice__SQUOTE__s',
          quoted__DQUOTE__key: '保留',
          $meta: { source: '内部' },
          nested: [{ keep: true, $hidden: '删除' }],
        },
        futureLogField: { preserved: true },
      },
    ],
    'mk-object': {
      op: 'update',
      path: 'player.hp',
      value_old: 10,
      value_new: 15,
      futureLogField: '单对象日志',
    },
    'mk-fenced': `
      \`\`\`json
      [
        {"op":"update","path":"player.hp","value_old":15,"value_new":18},
        {"op":"insert","path":"inventory[0]","value_new":{"item__DQUOTE__name":"剑"}}
      ]
      \`\`\`
    `,
    'mk-ignored': '{"op":"update","path":"player.hp","value_new":999}',
    futureLogBucket: { unknown: ['原样保留'] },
  };
  return {
    variables: {
      stat: {
        player: {
          hp: 18,
          display__DOT__name: 'Alice__SQUOTE__s',
          quoted__DQUOTE__key: '保留',
          $meta: { source: '内部' },
          nested: [{ keep: true, $hidden: '删除' }],
        },
        inventory: [{ item__DQUOTE__name: '剑' }],
        $root: '删除',
        futureStateField: { preserved: true },
      },
      meta: {
        SelectedMks: selectedMks,
        EditLogs: editLogs,
        futureMetaField: { preserved: true },
      },
    },
    messages: [
      { role: 'system', mes: '开场' },
      {
        role: 'assistant',
        mes: '<era_data>{"era-message-key"="mk-array","era-message-type"="user"}</era_data>',
      },
      {
        role: 'user',
        message: '<era_data>{"era-message-key"="mk-object","era-message-type"="assistant"}</era_data>',
      },
      { role: 'system', mes: '无 MK' },
      { role: 'user', mes: '使用 role 回退' },
      { role: 'assistant', mes: '当前消息' },
    ],
  };
}

function selectedMksOf(fixture: Fixture): (string | null)[] {
  return fixture.variables.meta.SelectedMks as (string | null)[];
}

function editLogsOf(fixture: Fixture): Record<string, unknown> {
  return fixture.variables.meta.EditLogs as Record<string, unknown>;
}

function legacyItem(fixture: Fixture, mk: string, messageId: number, stat: object) {
  const message = fixture.messages[messageId];
  return {
    mk,
    message_id: messageId,
    is_user: message ? legacy.isUserMessage(message) : false,
    stat: legacy.unescapeEraData(stat),
    statWithoutMeta: legacy.unescapeEraData(legacy.removeMetaFields(stat)),
  };
}

function legacyResult(queryType: EraSnapshotQueryType, request: unknown, fixture: Fixture): unknown {
  activeFixture = fixture;
  const selectedMks = selectedMksOf(fixture);
  switch (queryType) {
    case 'getCurrentVars': {
      try {
        const messageId = selectedMks.length - 1;
        const mk = selectedMks[messageId] || '';
        return legacyItem(fixture, mk, messageId, fixture.variables.stat as object);
      } catch (error) {
        return { error: `获取当前变量时发生错误: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
    case 'getSnapshotAtMk': {
      try {
        const mk = request && typeof request === 'object' ? (request as Record<string, unknown>).mk : undefined;
        if (!mk) throw new Error('请求缺少 "mk" 参数。');
        const stat = legacy.getStatAtMK(String(mk));
        if (stat) return legacyItem(fixture, String(mk), selectedMks.indexOf(String(mk)), stat);
        return { error: `找不到 MK "${String(mk)}" 对应的快照。`, stat: null };
      } catch (error) {
        return { error: `获取快照时发生错误: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
    case 'getSnapshotsBetweenMks': {
      try {
        const detail = request && typeof request === 'object' ? (request as Record<string, unknown>) : {};
        const results = legacy.getStatsBetweenMKs(
          detail.startMk as string | undefined,
          detail.endMk as string | undefined,
        );
        return results ? results.map(item => legacyItem(fixture, item.mk, item.message_id, item.stat)) : [];
      } catch (error) {
        return { error: `获取批量快照时发生错误: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
    case 'getSnapshotAtMId': {
      try {
        const messageId =
          request && typeof request === 'object' ? (request as Record<string, unknown>).message_id : undefined;
        if (typeof messageId !== 'number') throw new Error('请求缺少 "message_id" 参数或类型不正确。');
        if (messageId < 0 || messageId >= selectedMks.length) {
          throw new Error(`Message ID ${messageId} 超出范围 [0, ${selectedMks.length - 1}]。`);
        }
        const mk = selectedMks[messageId];
        if (!mk) return { error: `Message ID ${messageId} 处没有找到有效的 MK。`, stat: null };
        const stat = legacy.getStatAtMK(mk);
        if (stat) return legacyItem(fixture, mk, messageId, stat);
        return {
          error: `获取快照失败，MK: ${mk} (来自 Message ID: ${messageId})。可能该快照已被清理。`,
          stat: null,
        };
      } catch (error) {
        return { error: `获取快照时发生错误: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
    case 'getSnapshotsBetweenMIds': {
      try {
        const detail = request && typeof request === 'object' ? (request as Record<string, unknown>) : {};
        const startIndex = (detail.startId as number | null | undefined) ?? 0;
        const endIndex = (detail.endId as number | null | undefined) ?? selectedMks.length - 1;
        if (startIndex > endIndex || startIndex < 0 || endIndex >= selectedMks.length) {
          throw new Error(`ID 范围 [${startIndex}, ${endIndex}] 无效或超出范围 [0, ${selectedMks.length - 1}]。`);
        }
        const startMk = selectedMks[startIndex];
        const endMk = selectedMks[endIndex];
        if (!startMk || !endMk) throw new Error('指定的 ID 范围内没有找到有效的起始或结束 MK。');
        const results = legacy.getStatsBetweenMKs(startMk, endMk);
        return results ? results.map(item => legacyItem(fixture, item.mk, item.message_id, item.stat)) : [];
      } catch (error) {
        return { error: `获取批量快照时发生错误: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
  }
}

function legacyPayload(queryType: EraSnapshotQueryType, request: unknown, fixture: Fixture): EraQueryResultPayload {
  activeFixture = fixture;
  return {
    queryType,
    request,
    result: legacyResult(queryType, request, fixture),
    selectedMks: selectedMksOf(fixture),
    editLogs: editLogsOf(fixture),
  };
}

function runNew(queryType: EraSnapshotQueryType, request: unknown, fixture: Fixture) {
  const input: EraSnapshotQueryInput = {
    queryType,
    request,
    variables: fixture.variables,
    messageContext: { messages: fixture.messages },
  };
  return executeSnapshotQuery(input);
}

beforeAll(async () => {
  const globals = globalThis as unknown as {
    _: typeof lodash;
    getVariables: () => unknown;
  };
  globals._ = lodash;
  globals.getVariables = () => ({
    ERAMetaData: activeFixture.variables.meta,
    stat_data: activeFixture.variables.stat,
  });

  const [snapshot, timetravel, data, eraData, message] = await Promise.all([
    import('../../src/ERA变量框架/core/snapshot'),
    import('../../src/ERA变量框架/core/timetravel'),
    import('../../src/ERA变量框架/utils/data'),
    import('../../src/ERA变量框架/utils/era_data'),
    import('../../src/ERA变量框架/utils/message'),
  ]);
  legacy = {
    getStatAtMK: snapshot.getStatAtMK,
    getStatsBetweenMKs: snapshot.getStatsBetweenMKs,
    calculateStatAt: (mk, selectedMks, logs) =>
      timetravel.calculateStatAt(mk, selectedMks, logs as Record<string, string>),
    calculateStatForward: (stat, startMk, targetMk, selectedMks, logs) =>
      timetravel.calculateStatForward(stat, startMk, targetMk, selectedMks, logs as Record<string, string>),
    calculateAllStatsBetweenMks: (startMk, endMk, selectedMks, logs) =>
      timetravel.calculateAllStatsBetweenMks(startMk, endMk, selectedMks, logs as Record<string, string>),
    rollbackStatToMK: (targetMk, currentMk, stat, selectedMks, logs) =>
      timetravel.rollbackStatToMK(targetMk, currentMk, stat, selectedMks, logs as Record<string, string>),
    findLatestNewValue: (path, startMessageId, selectedMks, logs) =>
      timetravel.findLatestNewValue(path, startMessageId, selectedMks, logs as Record<string, string>),
    parseEditLog: data.parseEditLog,
    unescapeEraData: data.unescapeEraData,
    removeMetaFields: eraData.removeMetaFields,
    isUserMessage: message.isUserMessage,
  };
});

describe('ERA 快照查询冻结基线差分', () => {
  it.each<readonly [EraSnapshotQueryType, unknown]>([
    ['getCurrentVars', { correlation: 'current', unknownRequestField: true }],
    ['getSnapshotAtMk', { mk: 'mk-array', unknownRequestField: ['保留'] }],
    ['getSnapshotsBetweenMks', { startMk: 'mk-array', endMk: 'mk-ignored' }],
    ['getSnapshotAtMId', { message_id: 2 }],
    ['getSnapshotsBetweenMIds', { startId: 1, endId: 5 }],
  ])('%s 成功路径与冻结候选逐字段相等', (queryType, request) => {
    const fixture = makeFixture();
    expect(runNew(queryType, request, fixture)).toEqual(legacyPayload(queryType, request, fixture));
  });

  it('保留 null 稀疏 SelectedMks、未知字段和原始 EditLogs 形状', () => {
    const fixture = makeFixture();
    const output = runNew('getCurrentVars', { token: 'shape' }, fixture) as EraQueryResultPayload;

    expect(output.selectedMks).toEqual([null, 'mk-array', 'mk-object', null, 'mk-fenced', 'mk-ignored']);
    expect(output.editLogs).toEqual(fixture.variables.meta.EditLogs);
    expect((output.result as { stat: Record<string, unknown> }).stat).toMatchObject({
      futureStateField: { preserved: true },
    });
  });

  it('反转义键和值，并递归移除对象和数组中的美元前缀字段', () => {
    const fixture = makeFixture();
    const output = runNew('getSnapshotAtMk', { mk: 'mk-array' }, fixture) as EraQueryResultPayload;
    const result = output.result as { stat: Record<string, unknown>; statWithoutMeta: Record<string, unknown> };
    const player = result.stat.player as Record<string, unknown>;
    const cleanPlayer = result.statWithoutMeta.player as Record<string, unknown>;

    expect(player).toMatchObject({
      hp: 10,
      'display.name': "Alice's",
      'quoted"key': '保留',
      $meta: { source: '内部' },
    });
    expect(cleanPlayer).not.toHaveProperty('$meta');
    expect((cleanPlayer.nested as Array<Record<string, unknown>>)[0]).toEqual({ keep: true });
  });

  it('数组、单对象、fenced 数组字符串均参与重放，JSON 对象字符串保持被忽略', () => {
    const fixture = makeFixture();
    const cases = [
      ['mk-array', 10],
      ['mk-object', 15],
      ['mk-fenced', 18],
      ['mk-ignored', 18],
    ] as const;

    for (const [mk, hp] of cases) {
      const output = runNew('getSnapshotAtMk', { mk }, fixture) as EraQueryResultPayload;
      expect((output.result as { stat: { player: { hp: number } } }).stat.player.hp).toBe(hp);
      expect(output).toEqual(legacyPayload('getSnapshotAtMk', { mk }, fixture));
    }
  });

  it.each<readonly [EraSnapshotQueryType, unknown]>([
    ['getSnapshotAtMk', {}],
    ['getSnapshotAtMk', { mk: 'missing' }],
    ['getSnapshotsBetweenMks', { startMk: 'missing', endMk: 'mk-fenced' }],
    ['getSnapshotsBetweenMks', { startMk: 'mk-fenced', endMk: 'mk-array' }],
    ['getSnapshotAtMId', { message_id: 3 }],
    ['getSnapshotAtMId', { message_id: 99 }],
    ['getSnapshotAtMId', { message_id: '2' }],
    ['getSnapshotsBetweenMIds', { startId: 3, endId: 5 }],
    ['getSnapshotsBetweenMIds', { startId: 5, endId: 1 }],
    ['getSnapshotsBetweenMIds', { startId: 1, endId: 99 }],
  ])('%s 无效参数或范围保持候选错误/空数组语义', (queryType, request) => {
    const fixture = makeFixture();
    expect(runNew(queryType, request, fixture)).toEqual(legacyPayload(queryType, request, fixture));
  });

  it('time-travel、最近新值和日志解析直接与冻结纯函数差分', () => {
    const fixture = makeFixture();
    activeFixture = fixture;
    const selectedMks = selectedMksOf(fixture);
    const logs = editLogsOf(fixture);
    const finalLegacy = legacy.calculateStatAt('mk-ignored', selectedMks, logs);

    expect(calculateStatAt('mk-ignored', selectedMks, logs)).toEqual(finalLegacy);
    expect(calculateAllStatsBetweenMks('mk-array', 'mk-ignored', selectedMks, logs)).toEqual(
      legacy.calculateAllStatsBetweenMks('mk-array', 'mk-ignored', selectedMks, logs),
    );
    expect(
      calculateStatForward(
        legacy.calculateStatAt('mk-array', selectedMks, logs),
        'mk-array',
        'mk-fenced',
        selectedMks,
        logs,
      ),
    ).toEqual(
      legacy.calculateStatForward(
        legacy.calculateStatAt('mk-array', selectedMks, logs),
        'mk-array',
        'mk-fenced',
        selectedMks,
        logs,
      ),
    );
    expect(rollbackStatToMK('mk-array', 'mk-ignored', finalLegacy, selectedMks, logs)).toEqual(
      legacy.rollbackStatToMK('mk-array', 'mk-ignored', finalLegacy, selectedMks, logs),
    );
    expect(findLatestNewValue('player.hp', selectedMks.length, selectedMks, logs)).toEqual(
      legacy.findLatestNewValue('player.hp', selectedMks.length, selectedMks, logs),
    );
    for (const raw of [logs['mk-array'], logs['mk-object'], logs['mk-fenced'], logs['mk-ignored'], null]) {
      expect(parseEditLog(raw)).toEqual(legacy.parseEditLog(raw));
    }
  });

  it('纯查询不修改变量、消息、request 或 EditLogs', () => {
    const fixture = makeFixture();
    const request = { startMk: 'mk-array', endMk: 'mk-ignored', nested: { untouched: true } };
    const before = JSON.stringify({ fixture, request });

    runNew('getSnapshotsBetweenMks', request, fixture);

    expect(JSON.stringify({ fixture, request })).toBe(before);
    expect(unescapeEraData(fixture.variables.stat)).toEqual(legacy.unescapeEraData(fixture.variables.stat));
    expect(removeMetaFields(fixture.variables.stat)).toEqual(legacy.removeMetaFields(fixture.variables.stat));
  });
});
