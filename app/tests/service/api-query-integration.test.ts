import { describe, expect, it } from 'vitest';

interface NodeModule {
  run(inputs?: unknown, params?: unknown, context?: unknown): unknown;
}

interface AsyncNodeModule {
  run(inputs?: unknown, params?: unknown, context?: unknown): Promise<unknown>;
}

type JsonRecord = Record<string, any>;

const nodeRoot = new URL('../../../javascript_project/service/nodes/api/', import.meta.url);

async function loadNode(file: string): Promise<NodeModule> {
  return (await import(/* @vite-ignore */ new URL(file, nodeRoot).href)) as NodeModule;
}

const routeApi = await loadNode('route_api.ts');
const requestWriteDone = await loadNode('request_write_done.ts');
const planForceSync = await loadNode('plan_force_sync.ts');
const routeQuery = await loadNode('route_query.ts');
const selectCurrentVars = await loadNode('select_current_vars.ts');
const selectSnapshotAtMk = await loadNode('select_snapshot_at_mk.ts');
const selectSnapshotsBetweenMks = await loadNode('select_snapshots_between_mks.ts');
const selectSnapshotAtMId = await loadNode('select_snapshot_at_mid.ts');
const selectSnapshotsBetweenMIds = await loadNode('select_snapshots_between_mids.ts');
const readQueryVariables = (await loadNode('read_query_variables.ts')) as AsyncNodeModule;
const readQueryMessages = (await loadNode('read_query_messages.ts')) as AsyncNodeModule;
const executeSnapshotQuery = await loadNode('execute_snapshot_query.ts');
const mergeQueryResult = await loadNode('merge_query_result.ts');
const mergeApiResult = await loadNode('merge_api_result.ts');

const writeEvents = [
  'era:insertByObject',
  'era:updateByObject',
  'era:insertByPath',
  'era:updateByPath',
  'era:deleteByObject',
  'era:deleteByPath',
] as const;

const queryCases = [
  ['era:getCurrentVars', undefined, 'getCurrentVars', selectCurrentVars, 'current_vars_query'],
  ['era:getSnapshotAtMk', { mk: 'mk1' }, 'getSnapshotAtMk', selectSnapshotAtMk, 'snapshot_at_mk_query'],
  [
    'era:getSnapshotsBetweenMks',
    { startMk: 'mk0', endMk: 'mk1' },
    'getSnapshotsBetweenMks',
    selectSnapshotsBetweenMks,
    'snapshots_between_mks_query',
  ],
  ['era:getSnapshotAtMId', { message_id: 1 }, 'getSnapshotAtMId', selectSnapshotAtMId, 'snapshot_at_mid_query'],
  [
    'era:getSnapshotsBetweenMIds',
    { startId: 0, endId: 1 },
    'getSnapshotsBetweenMIds',
    selectSnapshotsBetweenMIds,
    'snapshots_between_mids_query',
  ],
] as const;

function envelope(value: unknown) {
  return { value };
}

function routedStep(eventType: string, detail?: unknown, sequence = 1) {
  const transportEvent = {
    schemaVersion: 1,
    eventId: `event-${sequence}`,
    sequence,
    type: eventType,
    occurredAt: 1_000 + sequence,
    source: 'era-api',
    args: [typeof detail === 'undefined' ? { kind: 'undefined' } : { kind: 'json', value: detail }],
    encodedBytes: 64,
  };
  const write = writeEvents.includes(eventType as (typeof writeEvents)[number]);
  return {
    kind: 'execute',
    stepId: `step:${sequence}`,
    index: 0,
    taskRoute: 'api',
    sourceSequences: [sequence],
    events: [transportEvent],
    task: {
      id: `task:${eventType}:event-${sequence}`,
      sourceEvents: [transportEvent],
      primaryEvent: transportEvent,
      context: write || eventType === 'era:forceSync' ? 'latest-message-with-mk' : 'none',
      kind: 'api',
      intent: eventType === 'era:forceSync' ? 'state-sync' : write ? 'message-write' : 'query',
      eventType,
      args: transportEvent.args,
    },
    sources: [{ event: transportEvent, relation: 'primary' }],
    dispatchContext: {
      schemaVersion: 2,
      status: 'ready',
      dispatchClass: 'api',
      requirement: write || eventType === 'era:forceSync' ? 'latest-message-with-mk' : 'none',
      messages: [],
      processingMessage: null,
      processingMk: null,
      messageChanged: false,
      variablesChanged: false,
      failure: null,
    },
  };
}

function route(eventType: string, detail?: unknown, sequence = 1): JsonRecord {
  return routeApi.run({
    'era.step.request.routed': envelope(routedStep(eventType, detail, sequence)),
    'era.batch.execution.state': envelope({ schemaVersion: 1, batchId: `test-batch-${sequence}` }),
  }) as JsonRecord;
}

function fakeCapabilities(counters: JsonRecord, failVariables = false) {
  const sidecarId = 'era_chat_query-12345678';
  const record = {
    schemaVersion: 2,
    sidecarId,
    owner: { characterId: 'card-query', groupId: null, chatId: 'chat-query' },
    revision: 1,
    state: {
      statData: { player: { hp: 100 } },
      eraMeta: {
        SelectedMks: ['mk0', 'mk1'],
        EditLogs: {
          mk0: [{ op: 'insert', path: 'player', value_new: { hp: 50 } }],
          mk1: [{ op: 'update', path: 'player.hp', value_old: 50, value_new: 100 }],
        },
      },
    },
  };
  return {
    'era.tavern.variables': {
      read: async () => {
        counters.variableReads += 1;
        if (failVariables) throw new Error('变量读取故障');
        return {
          stat_data: { player: { hp: 100 } },
          ERAMetaData: {
            SelectedMks: ['mk0', 'mk1'],
            EditLogs: {
              mk0: [{ op: 'insert', path: 'player', value_new: { hp: 50 } }],
              mk1: [{ op: 'update', path: 'player.hp', value_old: 50, value_new: 100 }],
            },
          },
        };
      },
      commit: async () => {
        counters.commits += 1;
        throw new Error('只读测试禁止 variables.commit');
      },
    },
    'era.tavern.sidecar': {
      read_current: async () => {
        counters.variableReads += 1;
        if (failVariables) throw new Error('变量读取故障');
        return { identity: structuredClone(record.owner), meta: { SidecarId: sidecarId }, stat: null };
      },
      read_record: async () => {
        counters.variableReads += 1;
        if (failVariables) throw new Error('变量读取故障');
        return { status: 'found', sidecarId, record: structuredClone(record) };
      },
    },
    'era.tavern.messages': {
      read_context: async (input: JsonRecord) => {
        counters.messageReads += 1;
        expect(input.projection).toBe('era-active-message-v1');
        return {
          schemaVersion: 2,
          messages: [
            { schemaVersion: 1, messageId: 0, role: 'user', activeText: '用户', swipeIndex: null },
            { schemaVersion: 1, messageId: 1, role: 'assistant', activeText: '助手', swipeIndex: null },
          ],
        };
      },
      update_content: async () => {
        counters.messageUpdates += 1;
        throw new Error('只读测试禁止 messages.update_content');
      },
      refresh: async () => {
        counters.refreshes += 1;
        throw new Error('只读测试禁止 messages.refresh');
      },
    },
  };
}

async function executeQueryCase(
  eventType: string,
  detail: unknown,
  selector: NodeModule,
  selectorOutput: string,
  counters: JsonRecord,
  failVariables = false,
): Promise<JsonRecord> {
  const api = route(eventType, detail);
  const queryRoute = routeQuery.run({ 'era.api.request': envelope(api.api_request) }) as JsonRecord;
  const selected = selector.run({ 'era.api.query.request': envelope(queryRoute.query_request) }) as JsonRecord;
  const capabilities = fakeCapabilities(counters, failVariables);
  const variables = (await readQueryVariables.run(
    { 'era.api.query.request': envelope(selected[selectorOutput]) },
    {},
    { capabilities },
  )) as JsonRecord;
  const messages = (await readQueryMessages.run({}, {}, { capabilities })) as JsonRecord;
  const executed = executeSnapshotQuery.run({
    'era.api.query.request': envelope(selected[selectorOutput]),
    'era.tavern.variables.read.result': envelope(variables.query_variables_raw),
    'era.tavern.messages.read_context.outcome': envelope(messages.query_messages_raw),
  }) as JsonRecord;
  const queryResult = mergeQueryResult.run({
    'era.task.result': envelope(executed.snapshot_query_task_result),
  }) as JsonRecord;
  return mergeApiResult.run({
    'era.task.result.merged': envelope(queryResult.query_api_result),
  }) as JsonRecord;
}

describe('VibeFlow Service API 二级路由与只读查询', () => {
  it('显式覆盖 13 个公开 API，写入进入真实事务且 forceSync 形成共享同步步骤', () => {
    for (const eventType of writeEvents) {
      const routed = route(eventType, { marker: eventType });
      expect(routed.api_route).toBe('write');
      expect(routed.api_request.task.args[0]).toEqual({ kind: 'json', value: { marker: eventType } });
      expect(routed.api_request.sources[0]).toMatchObject({ relation: 'primary', event: { type: eventType } });
    }
    for (const [eventType] of queryCases) expect(route(eventType).api_route).toBe('query');

    const replay = route('era:requestWriteDone');
    expect(replay.api_route).toBe('request-write-done');
    const replayResult = requestWriteDone.run({ 'era.api.request': envelope(replay.api_request) }) as JsonRecord;
    expect(replayResult.request_write_done_result).toMatchObject({
      status: 'no-op',
      notifications: [{ type: 'era:internal:replayWriteDone', args: [] }],
    });
    expect(replayResult.request_write_done_result.settlements[0].status).toBe('completed');

    const force = route('era:forceSync', { mode: 'rollbackTo', message_id: 1 });
    expect(force.api_route).toBe('force-sync');
    const forcePlan = planForceSync.run({
      'era.api.request': envelope(force.api_request),
      'era.tavern.messages.read_context.outcome': envelope({
        schemaVersion: 2,
        messages: [
          { schemaVersion: 1, messageId: 0, role: 'user', activeText: '用户', swipeIndex: null },
          { schemaVersion: 1, messageId: 1, role: 'assistant', activeText: '助手', swipeIndex: null },
        ],
      }),
    }) as JsonRecord;
    expect(forcePlan.force_sync_route).toBe('sync');
    expect(forcePlan.force_sync_step).toMatchObject({
      taskRoute: 'sync',
      task: { reason: 'manual', target: { kind: 'message', messageId: 1, stopAfterTarget: true } },
    });
  });

  it('五类查询均产生 completed settlement 与候选 era:queryResult，且零写入', async () => {
    const counters = { variableReads: 0, messageReads: 0, commits: 0, messageUpdates: 0, refreshes: 0 };
    for (const [eventType, detail, queryType, selector, output] of queryCases) {
      const result = await executeQueryCase(eventType, detail, selector, output, counters);
      expect(result.api_task_result.status).toBe('committed');
      expect(result.api_task_result.settlements[0].status).toBe('completed');
      expect(result.api_task_result.notifications).toHaveLength(1);
      const notification = result.api_task_result.notifications[0];
      expect(notification.type).toBe('era:queryResult');
      expect(notification.args[0].kind).toBe('json');
      expect(notification.args[0].value.queryType).toBe(queryType);
      expect(notification.args[0].value.result).toBeDefined();
    }
    expect(counters).toEqual({ variableReads: 10, messageReads: 5, commits: 0, messageUpdates: 0, refreshes: 0 });
  });

  it('候选参数错误和 Capability 读取错误仍以 queryResult payload 返回，不写入', async () => {
    const counters = { variableReads: 0, messageReads: 0, commits: 0, messageUpdates: 0, refreshes: 0 };
    const missingMk = await executeQueryCase(
      'era:getSnapshotAtMk',
      undefined,
      selectSnapshotAtMk,
      'snapshot_at_mk_query',
      counters,
    );
    expect(missingMk.api_task_result.settlements[0].status).toBe('completed');
    expect(missingMk.api_task_result.notifications[0].args[0].value.result.error).toContain('缺少 "mk" 参数');

    const readFailure = await executeQueryCase(
      'era:getCurrentVars',
      undefined,
      selectCurrentVars,
      'current_vars_query',
      counters,
      true,
    );
    expect(readFailure.api_task_result.settlements[0].status).toBe('completed');
    expect(readFailure.api_task_result.notifications[0].args[0].value.result.error).toContain('变量读取故障');
    expect(counters.commits).toBe(0);
    expect(counters.messageUpdates).toBe(0);
    expect(counters.refreshes).toBe(0);
  });
});
