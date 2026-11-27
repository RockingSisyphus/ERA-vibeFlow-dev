import { readExpected } from './frozen-behavior-fixture';
import reference from './fixtures/snapshot-query-reference.json';
const expectedBehavior = readExpected(reference);
import { describe, expect, it } from 'vitest';

import {
  calculateAllStatsBetweenMks,
  calculateStatAt,
  calculateStatForward,
  executeSnapshotQuery,
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
} from '../../../javascript_project/service/base_lib/snapshot/snapshot_query';
import {
  projectFloorSnapshot,
  projectFloorSnapshots,
} from '../../../javascript_project/service/base_lib/snapshot/floor_snapshot';

interface Fixture {
  readonly variables: EraSnapshotVariables;
  readonly messages: readonly unknown[];
}

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

function expectedPayload(queryType: EraSnapshotQueryType, request: unknown, fixture: Fixture): any {
  return expectedBehavior.payload(queryType, request, fixture);
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

describe('ERA 快照查询公开行为回归', () => {
  it.each<readonly [EraSnapshotQueryType, unknown]>([
    ['getCurrentVars', { correlation: 'current', unknownRequestField: true }],
    ['getSnapshotAtMk', { mk: 'mk-array', unknownRequestField: ['保留'] }],
    ['getSnapshotsBetweenMks', { startMk: 'mk-array', endMk: 'mk-ignored' }],
    ['getSnapshotAtMId', { message_id: 2 }],
    ['getSnapshotsBetweenMIds', { startId: 1, endId: 5 }],
  ])('%s 成功路径与冻结结果逐字段相等', (queryType, request) => {
    const fixture = makeFixture();
    expect(runNew(queryType, request, fixture)).toEqual(expectedPayload(queryType, request, fixture));
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
      expect(output).toEqual(expectedPayload('getSnapshotAtMk', { mk }, fixture));
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
    expect(runNew(queryType, request, fixture)).toEqual(expectedPayload(queryType, request, fixture));
  });

  it('time-travel、最近新值和日志解析直接与冻结行为结果比较', () => {
    const fixture = makeFixture();
    const selectedMks = selectedMksOf(fixture);
    const logs = editLogsOf(fixture);
    const finalExpected = expectedBehavior.calculateStatAt('mk-ignored', selectedMks, logs);

    expect(calculateStatAt('mk-ignored', selectedMks, logs)).toEqual(finalExpected);
    expect(calculateAllStatsBetweenMks('mk-array', 'mk-ignored', selectedMks, logs)).toEqual(
      expectedBehavior.calculateAllStatsBetweenMks('mk-array', 'mk-ignored', selectedMks, logs),
    );
    expect(
      calculateStatForward(
        expectedBehavior.calculateStatAt('mk-array', selectedMks, logs),
        'mk-array',
        'mk-fenced',
        selectedMks,
        logs,
      ),
    ).toEqual(
      expectedBehavior.calculateStatForward(
        expectedBehavior.calculateStatAt('mk-array', selectedMks, logs),
        'mk-array',
        'mk-fenced',
        selectedMks,
        logs,
      ),
    );
    expect(rollbackStatToMK('mk-array', 'mk-ignored', finalExpected, selectedMks, logs)).toEqual(
      expectedBehavior.rollbackStatToMK('mk-array', 'mk-ignored', finalExpected, selectedMks, logs),
    );
    for (const raw of [logs['mk-array'], logs['mk-object'], logs['mk-fenced'], logs['mk-ignored'], null]) {
      expect(parseEditLog(raw)).toEqual(expectedBehavior.parseEditLog(raw));
    }
  });

  it('纯查询不修改变量、消息、request 或 EditLogs', () => {
    const fixture = makeFixture();
    const request = { startMk: 'mk-array', endMk: 'mk-ignored', nested: { untouched: true } };
    const before = JSON.stringify({ fixture, request });

    runNew('getSnapshotsBetweenMks', request, fixture);

    expect(JSON.stringify({ fixture, request })).toBe(before);
    expect(unescapeEraData(fixture.variables.stat)).toEqual(expectedBehavior.unescapeEraData(fixture.variables.stat));
    expect(removeMetaFields(fixture.variables.stat)).toEqual(expectedBehavior.removeMetaFields(fixture.variables.stat));
  });

  it('最近多个状态栏由最新状态一次逆向投影变量与函数，不生成额外楼层快照', () => {
    const meta = {
      SelectedMks: ['mk-0', 'mk-1', 'mk-2', 'mk-3', 'mk-4'],
      EditLogs: {
        'mk-0': [{ op: 'insert', path: 'hp', value_new: 10 }],
        'mk-1': [{ op: 'update', path: 'hp', value_old: 10, value_new: 20 }],
        'mk-2': [{ op: 'insert', path: 'flag', value_new: true }],
        'mk-3': [{ op: 'update', path: 'hp', value_old: 20, value_new: 30 }],
        'mk-4': [{ op: 'delete', path: 'flag', value_old: true }],
      },
      FunctionEditLogs: {
        'mk-0': [{ op: 'insert', name: 'f', value_new: { params: ['x'], expr: 'x+1' } }],
        'mk-3': [
          {
            op: 'update',
            name: 'f',
            value_old: { params: ['x'], expr: 'x+1' },
            value_new: { params: ['x'], expr: 'x+2' },
          },
        ],
      },
    };
    const input = {
      stat: { hp: 30 },
      statFunc: { f: { params: ['x'], expr: 'x+2' } },
      meta,
    };

    const recent = projectFloorSnapshots({ ...input, messageIds: [2, 3, 4] });
    expect(recent).toEqual([
      { messageId: 2, mk: 'mk-2', stat: { hp: 20, flag: true }, statFunc: { f: { params: ['x'], expr: 'x+1' } } },
      { messageId: 3, mk: 'mk-3', stat: { hp: 30, flag: true }, statFunc: { f: { params: ['x'], expr: 'x+2' } } },
      { messageId: 4, mk: 'mk-4', stat: { hp: 30 }, statFunc: { f: { params: ['x'], expr: 'x+2' } } },
    ]);
    expect(recent).toHaveLength(3);
    expect(projectFloorSnapshot({ ...input, messageId: 3 })).toEqual(recent[1]);
  });

  it('10,000 楼日志只返回请求的最近三个投影，不生成全量快照集', () => {
    const floorCount = 10_000;
    const selectedMks = Array.from({ length: floorCount }, (_, index) => `mk-${index}`);
    const editLogs = Object.fromEntries(
      selectedMks.map((mk, index) => [
        mk,
        [
          index === 0
            ? { op: 'insert', path: 'counter', value_new: 0 }
            : { op: 'update', path: 'counter', value_old: index - 1, value_new: index },
        ],
      ]),
    );
    const input = {
      stat: { counter: floorCount - 1 },
      statFunc: {},
      meta: { SelectedMks: selectedMks, EditLogs: editLogs, FunctionEditLogs: {} },
    };
    const before = JSON.stringify(input);
    const result = projectFloorSnapshots({
      ...input,
      messageIds: [floorCount - 3, floorCount - 2, floorCount - 1],
    });

    expect(result).toHaveLength(3);
    expect(result.map(item => item.messageId)).toEqual([9997, 9998, 9999]);
    expect(result.map(item => (item.stat as { counter: number }).counter)).toEqual([9997, 9998, 9999]);
    expect(JSON.stringify(input)).toBe(before);
    expect(result).not.toHaveProperty('snapshots');
  });
});
