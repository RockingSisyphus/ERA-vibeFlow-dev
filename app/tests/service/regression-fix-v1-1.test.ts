import { describe, expect, it, vi } from 'vitest';

import { cloneEraPortableJsonV1, normalizeLegacySafeObjectV1 } from '../../../packages/era-contracts/index.js';

const transaction = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/base_lib/sync_transaction.ts', import.meta.url).href
);
const preparePostCommit = await import(
  /* @vite-ignore */ new URL(
    '../../../javascript_project/service/nodes/api/prepare_post_commit_context.ts',
    import.meta.url,
  ).href
);
const readCommitted = await import(
  /* @vite-ignore */ new URL(
    '../../../javascript_project/service/nodes/api/read_committed_messages.ts',
    import.meta.url,
  ).href
);
const buildSyncStep = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/nodes/api/build_api_sync_step.ts', import.meta.url)
    .href
);
const buildPostCommitFailure = await import(
  /* @vite-ignore */ new URL(
    '../../../javascript_project/service/nodes/api/build_post_commit_context_failure.ts',
    import.meta.url,
  ).href
);
const finalizeApiWrite = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/nodes/api/finalize_api_write.ts', import.meta.url)
    .href
);

type JsonRecord = Record<string, any>;

function envelope(value: unknown) {
  return { value };
}

function sourceEvent(sequence = 1) {
  return {
    schemaVersion: 1,
    eventId: `event-${sequence}`,
    sequence,
    type: 'era:insertByObject',
    occurredAt: 1_000 + sequence,
    source: 'era-api',
    args: [],
    encodedBytes: 32,
  } as const;
}

function strictMessage(messageId: number, activeText: string) {
  return {
    schemaVersion: 1,
    messageId,
    role: 'assistant',
    activeText,
    swipeIndex: null,
  } as const;
}

function dispatchContext(messages: readonly JsonRecord[], processingMk: string) {
  return {
    schemaVersion: 2,
    status: 'ready',
    dispatchClass: 'api',
    requirement: 'latest-message-with-mk',
    messages,
    processingMessage: messages.at(-1),
    processingMk,
    messageChanged: false,
    variablesChanged: false,
    failure: null,
  } as const;
}

function apiStep(messages: readonly JsonRecord[], processingMk: string) {
  const event = sourceEvent();
  return {
    kind: 'execute',
    stepId: 'step:api-write',
    index: 0,
    taskRoute: 'sync',
    sourceSequences: [event.sequence],
    events: [event],
    task: {
      id: 'task:api-write',
      sourceEvents: [event],
      primaryEvent: event,
      context: 'latest-message-with-mk',
      kind: 'sync',
      reason: 'api-write',
      target: { kind: 'auto' },
      fullRebuild: false,
    },
    sources: [{ event, relation: 'primary' }],
    dispatchContext: dispatchContext(messages, processingMk),
  } as const;
}

function batchState(step: JsonRecord) {
  return {
    schemaVersion: 1,
    batchId: 'batch-regression',
    throughSequence: 1,
    nextState: {
      schemaVersion: 1,
      collection: [],
      collectionBytes: 0,
      iteration: 1,
      consecutiveProcessingCount: 7,
      consecutiveMk: 'carry-before-api',
      timerToken: null,
    },
    sources: [{ eventId: 'event-1', sequence: 1 }],
    steps: [step],
    index: 0,
    settlements: [],
    notifications: [],
    diagnostics: [],
    fatal: false,
    coverageError: null,
  };
}

function postCommitFixture() {
  const before = '正文\n<era_data>{"era-message-key"="mk-api","era-message-type"="assistant"}</era_data>';
  const after = `${before}\n<VariableInsert>{"hp":10}</VariableInsert>`;
  const message = strictMessage(4, before);
  const event = sourceEvent();
  const apiTask = {
    id: 'task:api',
    sourceEvents: [event],
    primaryEvent: event,
    context: 'latest-message-with-mk',
    kind: 'api',
    intent: 'message-write',
    eventType: 'era:insertByObject',
    args: [],
  } as const;
  const carried = {
    task: apiTask,
    sources: [{ event, relation: 'primary' }],
    dispatchContext: dispatchContext([message], 'mk-api'),
  };
  const appendResult = {
    status: 'committed',
    request: {
      request: carried,
      plan: { messageId: 4, newContent: after },
    },
  };
  return { before, after, message, appendResult };
}

describe('contracts 1.4 统一安全 JSON codec', () => {
  it('递归提升 __proto__、保留普通保留键、规范化数组并且不污染原型', () => {
    const nested: JsonRecord = Object.create(null);
    Object.defineProperty(nested, '__proto__', { enumerable: true, value: { deep: 2, explicit: '旧值' } });
    nested.explicit = '显式值';
    const root: JsonRecord = Object.create(null);
    Object.defineProperty(root, '__proto__', { enumerable: true, value: { bounded: 1 } });
    Object.defineProperty(root, 'constructor', { enumerable: true, value: { bounded: 2 } });
    Object.defineProperty(root, 'prototype', { enumerable: true, value: { bounded: 3 } });
    root.nested = nested;
    const sparse: unknown[] = [];
    sparse.length = 3;
    sparse[1] = undefined;
    sparse[2] = { omitted: undefined, keep: true };
    root.array = sparse;
    const cloned = cloneEraPortableJsonV1(root) as JsonRecord;
    expect(Object.getPrototypeOf(cloned)).toBeNull();
    expect(cloned).toMatchObject({
      bounded: 1,
      constructor: { bounded: 2 },
      prototype: { bounded: 3 },
      nested: { deep: 2, explicit: '显式值' },
      array: [null, null, { keep: true }],
    });
    expect(cloned.array[2]).not.toHaveProperty('omitted');
    expect(({} as JsonRecord).bounded).toBeUndefined();
    expect(() => normalizeLegacySafeObjectV1({ value: undefined })).toThrow('undefined');
  });
});

describe('提交后消息上下文', () => {
  it('重新读取严格快照，并保留 API 进入 dispatcher 时的 processing 身份', async () => {
    const fixture = postCommitFixture();
    const readContext = vi.fn(async () => ({
      schemaVersion: 2,
      messages: [strictMessage(4, fixture.after)],
    }));
    const read = await readCommitted.run(
      { 'era.api.write.append.result': envelope(fixture.appendResult) },
      {},
      { capabilities: { 'era.tavern.messages': { read_context: readContext } } },
    );
    expect(readContext).toHaveBeenCalledWith({
      projection: 'era-active-message-v1',
      range: '0-{{lastMessageId}}',
      purpose: 'era-api-post-commit-read',
    });
    const prepared = preparePostCommit.run({
      'era.api.write.append.result': envelope(fixture.appendResult),
      'era.tavern.messages.read_context.outcome': envelope(read.committed_messages_raw),
    });
    expect(prepared.post_commit_context_route).toBe('ready');
    expect(prepared.post_commit_sync_context.dispatchContext.messages[0].activeText).toBe(fixture.after);
    expect(prepared.post_commit_sync_context.dispatchContext.processingMessage.activeText).toBe(fixture.before);
    expect(prepared.post_commit_sync_context.dispatchContext.processingMk).toBe('mk-api');
    const routed = buildSyncStep.run({
      'era.api.write.post_commit.context': envelope(prepared.post_commit_sync_context),
    });
    expect(routed.routed_step.dispatchContext.messages[0].activeText).toBe(fixture.after);
    expect(routed.routed_step.dispatchContext.processingMk).toBe('mk-api');
  });

  it.each([
    ['读取失败', { ok: false, error: { code: 'READ_FAILED', message: '读取失败' } }],
    ['目标缺失', { ok: true, value: { schemaVersion: 2, messages: [] } }],
    ['目标重复', { ok: true, value: { schemaVersion: 2, messages: [strictMessage(4, 'x'), strictMessage(4, 'x')] } }],
    ['文本不一致', { ok: true, value: { schemaVersion: 2, messages: [strictMessage(4, '不一致')] } }],
  ])('%s 时恰好一次失败结算、无成功通知并升级 fatal', (_name, outcome) => {
    const fixture = postCommitFixture();
    const prepared = preparePostCommit.run({
      'era.api.write.append.result': envelope(fixture.appendResult),
      'era.tavern.messages.read_context.outcome': envelope(outcome),
    });
    expect(prepared.post_commit_context_route).toBe('fatal');
    const task = buildPostCommitFailure.run({
      'era.api.write.post_commit.failure': envelope(prepared.post_commit_context_failure),
    });
    expect(task.post_commit_context_task_result.settlements).toHaveLength(1);
    expect(task.post_commit_context_task_result.notifications).toEqual([]);
    const final = finalizeApiWrite.run({
      'era.task.result': envelope(task.post_commit_context_task_result),
    });
    expect(final.api_write_success_result.status).toBe('fatal');
    expect(final.api_write_success_result.settlements).toHaveLength(1);
    expect(final.api_write_success_result.notifications).toEqual([]);
  });
});

describe('MK 唯一权威与保留键状态语义', () => {
  it('损坏的首个 era_data 不会覆盖准备阶段已经生成的 processing MK', () => {
    const processingMk = 'era_mk_1001_prepared';
    const text = [
      '正文',
      '<era_data>{"era-message-key"="broken"}</era_data>',
      `<era_data>{"era-message-key"="${processingMk}","era-message-type"="assistant"}</era_data>`,
    ].join('\n');
    const messages = [strictMessage(0, text)];
    const step = apiStep(messages, processingMk);
    const work = transaction.planSyncWork({
      schemaVersion: 1,
      step,
      state: batchState(step),
      status: 'ready',
      messagesRaw: { schemaVersion: 2, messages },
      variablesRaw: { stat_data: {}, ERAMetaData: { SelectedMks: [processingMk], EditLogs: {} } },
      failure: null,
    });
    expect(work.disposition).toBe('commit');
    expect(work.payload).toMatchObject({ mk: processingMk, consecutiveProcessingCount: 1, is_user: false });
    expect(work.plan?.meta.SelectedMks[0]).toBe(processingMk);
    expect(work.plan?.nextConsecutiveState).toEqual({ mk: 'carry-before-api', count: 7 });
  });

  it('AI 指令中的三类保留键安全进入状态、EditLog 和 writeDone', () => {
    const mk = 'mk-bounded';
    const command =
      '<VariableInsert>{"__proto__":{"bounded":1},"constructor":{"bounded":2},"prototype":{"bounded":3}}</VariableInsert>';
    const text = `${command}\n<era_data>{"era-message-key"="${mk}","era-message-type"="assistant"}</era_data>`;
    const messages = [strictMessage(0, text)];
    const step = apiStep(messages, mk);
    const work = transaction.planSyncWork({
      schemaVersion: 1,
      step,
      state: batchState(step),
      status: 'ready',
      messagesRaw: { schemaVersion: 2, messages },
      variablesRaw: { stat_data: {}, ERAMetaData: { SelectedMks: [], EditLogs: {} } },
      failure: null,
    });
    expect(work.disposition).toBe('commit');
    expect(work.plan?.stat).toMatchObject({
      bounded: 1,
      constructor: { bounded: 2 },
      prototype: { bounded: 3 },
    });
    const request = transaction.buildSyncCommitRequest(work);
    const committed = transaction.buildSyncCommittedResult({
      ...request,
      status: 'committed',
      confirmedMessageWrites: request.messageWrites.length,
      variablesCommitted: true,
      failure: null,
    });
    const payload = committed.notifications[0].args[0].value as JsonRecord;
    expect(payload.mk).toBe(mk);
    expect(payload.stat).toMatchObject({
      bounded: 1,
      constructor: { bounded: 2 },
      prototype: { bounded: 3 },
    });
    expect(payload.editLogs[mk]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'bounded', value_new: 1 }),
        expect.objectContaining({ path: 'constructor', value_new: { bounded: 2 } }),
        expect.objectContaining({ path: 'prototype', value_new: { bounded: 3 } }),
      ]),
    );
    expect(({} as JsonRecord).bounded).toBeUndefined();
  });

  it('无效 processing MK 在任何 Capability 写入前形成普通合同失败', () => {
    const message = strictMessage(0, '正文');
    const step = apiStep([message], 'mk-valid') as JsonRecord;
    step.dispatchContext = { ...step.dispatchContext, processingMk: null };
    const request = {
      mode: 'commit',
      request: {
        schemaVersion: 1,
        step,
        plan: { status: 'recalculated', nextConsecutiveState: { mk: null, count: 1 } },
        payload: { mk: '', message_id: 0, is_user: false, actions: {}, consecutiveProcessingCount: 1 },
        messageWrites: [],
        stat: {},
        meta: {},
      },
    };
    const validated = transaction.validateSyncCommitEnvelope(request);
    expect(validated.route).toBe('failed');
    if (validated.route !== 'failed') throw new Error('预期合同失败');
    const result = transaction.buildSyncContractFailureResult(validated.failure);
    expect(result.status).toBe('failed');
    expect(result.settlements).toHaveLength(1);
    expect(result.notifications).toEqual([]);
    expect(result).not.toHaveProperty('stateUpdate');
  });
});
