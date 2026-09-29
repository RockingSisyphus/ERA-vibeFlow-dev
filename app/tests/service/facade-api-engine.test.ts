import { unescapeEraData } from '../../../javascript_project/service/base_lib/domain/snapshot_query';
import { parseMessageCommands } from '../../../javascript_project/service/base_lib/domain/commands/crud_engine';
import { describe, expect, it } from 'vitest';
import { run as appliedReceipt } from '../../../javascript_project/service/nodes/api/return_applied_receipt';

import {
  buildAppend,
  buildTransaction,
  inspectWindow,
  recheckWindow,
  validateCommit,
} from '../../../javascript_project/service/base_lib/facade_api_engine';

const identity = {
  characterId: 'character.png',
  groupId: null,
  chatId: 'chat-1',
  scriptId: 'era-script',
  lifecycleToken: 7,
};

function execution(scopeWindow: any = { token: null, messageAdmission: null, branchAdmission: null }) {
  return {
    schemaVersion: 1,
    nextState: {
      schemaVersion: 1,
      collection: [],
      collectionBytes: 0,
      iteration: 0,
      consecutiveProcessingCount: 0,
      consecutiveMk: null,
      timerToken: null,
      scopeWindow,
    },
  } as any;
}

function messages(latest = '正文', earlier = '') {
  return {
    schemaVersion: 2,
    messages: [
      { schemaVersion: 1, messageId: 0, role: 'assistant', activeText: earlier, swipeIndex: 0 },
      { schemaVersion: 1, messageId: 1, role: 'assistant', activeText: latest, swipeIndex: 0 },
    ],
  };
}

function request(scope: unknown = 'message', operations: unknown = [{ edit: { time: { $expr: 'time+10' } } }]) {
  return {
    task: {
      kind: 'api',
      id: 'task-1',
      eventType: 'era.facade.commit',
      args: [],
      sourceEvents: [],
      primaryEvent: { eventId: 'event-1', sequence: 1, type: 'era.facade.commit', source: 'era-api', args: [] },
    },
    sources: [
      {
        relation: 'primary',
        event: { eventId: 'event-1', sequence: 1, type: 'era.facade.commit', source: 'era-api', args: [] },
      },
    ],
    dispatchContext: {},
    detail: { scope, operations, windowToken: 7 },
  };
}

function statusbarSource(messageId = 0) {
  return {
    kind: 'managed-statusbar-v2',
    pageEpoch: 'page-1',
    instanceId: 'instance-1',
    characterId: 'character.png',
    groupId: null,
    chatId: 'chat-1',
    messageId,
    mk: `mk-${messageId}`,
    swipeId: 0,
    iframeName: `TH-message--${messageId}--0`,
  };
}

describe('ERA 即时 Scope Facade 纯领域链', () => {
  it('应用回执携带本轮表达式诊断，不推迟到防抖落盘才报告', () => {
    const inspected = inspectWindow(request(), execution(), identity, messages());
    const result = appliedReceipt(
      {
        'era.sync.block.step.state.next': {
          value: {
            apiContext: buildAppend(buildTransaction((validateCommit(inspected) as any).context)),
            work: {
              disposition: 'commit',
              step: { kind: 'execute', task: request().task },
              plan: {
                diagnostics: [{ code: 'ERA_EDIT_TARGET_NOT_NUMERIC', message: 'invalid target (hp)', messageIndex: 1 }],
              },
            },
          },
        },
      },
      {},
      {
        capabilities: {
          'era.tavern.sidecar': { read_working: () => ({ working: null }) },
          'era.lifecycle.admission': { schedule: () => ({ status: 'scheduled' }) },
        },
      },
    ).facade_commit_result;
    expect(result.diagnostics).toEqual([
      { code: 'ERA_EDIT_TARGET_NOT_NUMERIC', message: 'invalid target (hp)（消息索引 1）', sequence: 1 },
    ]);
  });
  it('应用失败保留正式错误DTO，不附加导致服务停止的layer字段', () => {
    const inspected = inspectWindow(request(), execution(), identity, messages());
    const failed = { code: 'ERA_TEST_APPLY_FAILED', message: 'original reason', category: 'domain', retryable: false };
    const result = appliedReceipt(
      {
        'era.sync.block.step.state.next': {
          value: {
            apiContext: inspected,
            work: { disposition: 'failed', failure: failed },
          },
        },
      },
      {},
      {},
    ).facade_commit_result;
    expect(result.settlements[0]).toEqual({ eventId: 'event-1', sequence: 1, status: 'failed', error: failed });
  });
  it('每次调用只生成一个短 era_tx，保留六类操作的原始顺序', () => {
    const inspected = inspectWindow(
      request('message', [
        { insert: { a: 1 } },
        { edit: { a: { $expr: 'a+1' } } },
        { functionInsert: { f: { params: ['x'], expr: 'x+1' } } },
        { functionDelete: { f: {} } },
      ]),
      execution(),
      identity,
      messages(),
    );
    const validated = validateCommit(inspected) as any;
    expect(validated.route).toBe('commit');
    const transaction = buildTransaction(validated.context) as any;
    expect(transaction.transaction).toBe(
      '<era_tx s="m"><VariableInsert>{"a":1}</VariableInsert>' +
        '<VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit>' +
        '<FunctionInsert>{"f":{"params":["x"],"expr":"x+1"}}</FunctionInsert>' +
        '<FunctionDelete>{"f":{}}</FunctionDelete></era_tx>',
    );
    const append = buildAppend(transaction) as any;
    expect(append.capabilityInput).toMatchObject({ messageId: 1, refresh: 'none' });
    expect(append.committedContent).toContain('\n<era_tx s="m">');
  });

  it('同一窗口沿用首次准入；下一窗口发现 message 标记后整轮 skipped', () => {
    const first = inspectWindow(request(), execution(), identity, messages());
    expect(validateCommit(first)).toMatchObject({ route: 'commit' });

    const sameWindow = inspectWindow(
      request(),
      execution({ token: 7, messageId: 1, messageAdmission: true, branchAdmission: true }),
      identity,
      messages('正文\n<era_tx s="m"><VariableEdit>{"a":2}</VariableEdit></era_tx>'),
    );
    expect(validateCommit(sameWindow)).toMatchObject({ route: 'commit' });

    const nextIdentity = { ...identity, lifecycleToken: 8 };
    const nextRequest = request() as any;
    nextRequest.detail.windowToken = 8;
    const nextWindow = inspectWindow(
      nextRequest,
      execution({ token: 7, messageAdmission: true, branchAdmission: true }),
      nextIdentity,
      messages('正文\n<era_tx s="m"><VariableEdit>{"a":2}</VariableEdit></era_tx>'),
    );
    expect(validateCommit(nextWindow)).toMatchObject({ route: 'skipped' });
  });

  it('branch 扫描当前活动分支，always 永远准入，edit scope 被拒绝', () => {
    const branchText = '<era_tx s="b"><VariableEdit>{"ready":true}</VariableEdit></era_tx>';
    expect(
      validateCommit(inspectWindow(request('branch'), execution(), identity, messages('正文', branchText))),
    ).toMatchObject({ route: 'skipped' });
    expect(
      validateCommit(inspectWindow(request('always'), execution(), identity, messages('正文', branchText))),
    ).toMatchObject({ route: 'commit' });
    expect(validateCommit(inspectWindow(request('edit'), execution(), identity, messages()))).toMatchObject({
      route: 'failed',
      error: { code: 'ERA_API_SCOPE_INVALID' },
    });
  });

  it('FIFO 等待期间窗口变化会在写入前失败，不产生旧楼层追加计划', () => {
    const inspected = inspectWindow(request(), execution(), identity, messages());
    const validated = validateCommit(inspected) as any;
    const append = buildAppend(buildTransaction(validated.context)) as any;
    expect(recheckWindow(append, { ...identity, lifecycleToken: 8 })).toMatchObject({
      route: 'changed',
      error: { code: 'ERA_API_WINDOW_CHANGED' },
    });
  });

  it('托管状态栏提交精确写入来源历史楼，来源失效时不回退最新楼', () => {
    const source = statusbarSource(0);
    const fromFloor = request() as any;
    fromFloor.detail.sourceContext = source;
    const inspected = inspectWindow(
      fromFloor,
      execution(),
      { ...identity, statusbarSource: source },
      messages('末楼', '历史楼'),
    );
    const validated = validateCommit(inspected) as any;
    expect(validated).toMatchObject({ route: 'commit', context: { latest: { messageId: 0, activeText: '历史楼' } } });
    expect(buildAppend(buildTransaction(validated.context))).toMatchObject({
      messageId: 0,
      capabilityInput: { messageId: 0, refresh: 'none', projectTechnicalBlocks: false },
    });

    expect(validateCommit(inspectWindow(fromFloor, execution(), identity, messages('末楼', '历史楼')))).toMatchObject({
      route: 'failed',
      error: { code: 'ERA_API_STATUSBAR_SOURCE_INVALID' },
    });
  });

  it('操作必须是非空数组、单键且仅允许六类名称', () => {
    expect(validateCommit(inspectWindow(request('message', []), execution(), identity, messages()))).toMatchObject({
      route: 'failed',
      error: { code: 'ERA_API_COMMIT_INVALID' },
    });
    expect(
      validateCommit(inspectWindow(request('message', [{ edit: {}, delete: {} }]), execution(), identity, messages())),
    ).toMatchObject({ route: 'failed', error: { code: 'ERA_API_COMMIT_INVALID' } });
    expect(
      validateCommit(inspectWindow(request('message', [{ update: { a: 1 } }]), execution(), identity, messages())),
    ).toMatchObject({ route: 'failed', error: { code: 'ERA_API_COMMIT_INVALID' } });
  });
});

it('ordinary API records round-trip literal command tags without truncating JSON', () => {
  const payload = {
    note: '<VariableEdit>{"hp":0}</VariableEdit>',
    call: '<EraFCall name="missing"/>',
    nested: ['<era_data>', '</VariableInsert>'],
  };
  const result = buildTransaction({ scope: 'always', operations: [{ name: 'insert', payload }] });
  const commands = parseMessageCommands({ content: result.transaction });
  expect(commands).toHaveLength(1);
  expect(unescapeEraData(commands[0].data)).toEqual([payload]);
});
