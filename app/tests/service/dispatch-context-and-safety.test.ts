const sync_commit_policy = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/base_lib/sync/sync_commit_policy.ts', import.meta.url)
    .href
);
const sync_contracts = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/base_lib/sync/sync_contracts.ts', import.meta.url)
    .href
);
import { describe, expect, it, vi } from 'vitest';

import { isEraTavernMessageContextV2, normalizeLegacySafeObjectV1 } from '../../../packages/era-contracts/index.js';

type JsonRecord = Record<string, any>;

const preparationUrl = new URL('../../../javascript_project/service/base_lib/dispatch_preparation.ts', import.meta.url)
  .href;
const transactionUrl = new URL('../../../javascript_project/service/base_lib/sync/sync_planning.ts', import.meta.url)
  .href;
const commitUrl = new URL('../../../javascript_project/service/nodes/dispatch/commit_preparation.ts', import.meta.url)
  .href;
const planMessagePreparationUrl = new URL(
  '../../../javascript_project/service/nodes/dispatch/shared_dispatch_adapters.ts',
  import.meta.url,
).href;
const readUrl = new URL('../../../javascript_project/service/nodes/dispatch/read_canonical_context.ts', import.meta.url)
  .href;
const finalizeUrl = new URL(
  '../../../javascript_project/service/nodes/dispatch/shared_dispatch_adapters.ts',
  import.meta.url,
).href;

const preparation = await import(/* @vite-ignore */ preparationUrl);
const transaction = await import(/* @vite-ignore */ transactionUrl);
const commitNode = await import(/* @vite-ignore */ commitUrl);
const planMessagePreparationNode = await import(/* @vite-ignore */ planMessagePreparationUrl);
const readNode = await import(/* @vite-ignore */ readUrl);
const finalizeNode = await import(/* @vite-ignore */ finalizeUrl);

function event(sequence = 1) {
  return {
    schemaVersion: 1,
    eventId: `event-${sequence}`,
    sequence,
    type: 'message_edited',
    occurredAt: 1_000 + sequence,
    source: 'tavern',
    args: [],
    encodedBytes: 32,
  };
}

function syncStep(
  dispatchClass: 'sync' | 'api' = 'sync',
  context = 'latest-message-with-mk',
  preparedMessages: readonly JsonRecord[] = [],
  processingMk: string | null = null,
) {
  const sourceEvent = event();
  return {
    kind: 'execute',
    stepId: 'step:sync:1',
    index: 0,
    taskRoute: 'sync',
    sourceSequences: [1],
    events: [sourceEvent],
    task: {
      id: 'task:sync:1',
      sourceEvents: [sourceEvent],
      primaryEvent: sourceEvent,
      context,
      kind: 'sync',
      reason: dispatchClass === 'api' ? 'facade-commit' : 'edited',
      target: { kind: 'auto' },
      fullRebuild: false,
    },
    sources: [{ event: sourceEvent, relation: 'primary' }],
    dispatchContext: {
      schemaVersion: 3,
      status: 'ready',
      dispatchClass,
      requirement: context,
      messages: preparedMessages,
      processingMessage: preparedMessages.at(-1) ?? null,
      processingMk,
      messageChanged: false,
      variablesChanged: false,
      failure: null,
      generationCycleIdentity: { chatId: 'test-chat', eventId: 'event-1', sourceKey: 'test-chat:agent:1' },
      floorIdentity:
        processingMk === null
          ? null
          : {
              chatId: 'test-chat',
              messageId: preparedMessages.at(-1)?.messageId,
              swipeId: preparedMessages.at(-1)?.swipeIndex ?? 0,
              mk: processingMk,
            },
      stagedMessageUpdates: [],
      agentFloorCandidate: null,
      sourceBasis: {
        identity: { characterId: 'test-card', chatId: 'test-chat', groupId: null },
        messages: preparedMessages,
      },
    },
  };
}

function updateMkStep() {
  const sourceEvent = {
    ...event(),
    type: 'message_sent',
  };
  return {
    kind: 'execute',
    stepId: 'step:update-mk:1',
    index: 0,
    taskRoute: 'update-mk',
    sourceSequences: [1],
    events: [sourceEvent],
    task: {
      id: 'task:update-mk:1',
      sourceEvents: [sourceEvent],
      primaryEvent: sourceEvent,
      context: 'latest-message-with-mk',
      kind: 'update-mk',
    },
    sources: [{ event: sourceEvent, relation: 'primary' }],
  };
}

function state(step: JsonRecord) {
  return {
    schemaVersion: 1,
    batchId: 'batch-1',
    throughSequence: 1,
    nextState: {
      schemaVersion: 1,
      collection: [],
      collectionBytes: 0,
      iteration: 1,
      consecutiveProcessingCount: 4,
      consecutiveMk: 'mk-existing',
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

function strictMessages(activeText = '正文', role = 'assistant') {
  return {
    schemaVersion: 2,
    messages: [{ schemaVersion: 1, messageId: 2, role, activeText, swipeIndex: 1 }],
  };
}

describe('统一执行前上下文', () => {
  it('preserves an Agent wrapper route while keeping the underlying dispatch class', () => {
    const step = { ...updateMkStep(), taskRoute: 'agent-generation-session' };
    const classified = preparation.classifyDispatch(step, state(step));
    expect(classified.seed.dispatchClass).toBe('update-mk');
    const finalized = finalizeNode.FinalizeDispatchContextNode({
      'era.dispatch.preparation.outcome': {
        value: preparation.buildNoHostOutcome(classified.seed),
      },
    });
    expect(finalized.prepared_task_route).toBe('agent-generation-session');
    expect(finalized.prepared_routed_step.dispatchContext.dispatchClass).toBe('update-mk');
  });

  it('context:none 不触发任何 Host 读取，latest-message 只读取消息', async () => {
    const noHostStep = syncStep('sync', 'none');
    const classified = preparation.classifyDispatch(noHostStep, state(noHostStep));
    expect(classified.route).toBe('none');
    expect(preparation.buildNoHostOutcome(classified.seed)).toMatchObject({
      status: 'ready',
      messages: [],
      messageWriteRequired: false,
      variableWriteRequired: false,
    });

    const latestStep = syncStep('sync', 'latest-message');
    const latestSeed = preparation.classifyDispatch(latestStep, state(latestStep)).seed;
    const readContext = vi.fn(async () => strictMessages());
    const readVariables = vi.fn(async () => ({ variables: {} }));
    const result = await readNode.run(
      { 'era.dispatch.seed': { value: latestSeed } },
      {},
      {
        capabilities: {
          'era.tavern.messages': { read_context: readContext },
          'era.tavern.variables': { read: readVariables },
        },
      },
    );
    expect(readContext).toHaveBeenCalledWith({
      projection: 'era-active-message-v1',
      range: '0--1',
      purpose: 'era-dispatch-prepare',
    });
    expect(readVariables).not.toHaveBeenCalled();
    const plan = preparation.planDispatchPreparation(result.canonical_dispatch_context);
    expect(plan).toMatchObject({ processingMk: null, messageUpdate: null, variableWriteRequired: false });
  });

  it('状态任务确保 MK 和占位符，但保留旧 SelectedMks 供同步事务识别 swipe 分歧', () => {
    const step = syncStep();
    const seed = preparation.classifyDispatch(step, state(step)).seed;
    const canonical = preparation.canonicalDispatchContext(
      seed,
      strictMessages('正文'),
      { variables: { ERAMetaData: { SelectedMks: ['mk-0', null], unknown: { keep: true } } } },
      { variables: { 在ai消息尾部生成特殊符号: true, 特殊符号值: '<自定义状态栏/>' } },
    );
    const plan = preparation.planDispatchPreparation(canonical);
    expect(plan.status).toBe('ready');
    expect(plan.processingMk).toMatch(/^era_mk_1001_/);
    expect(plan.messageUpdate?.content).toContain('<自定义状态栏/>');
    expect(plan.messageUpdate?.content.match(/<自定义状态栏\/>/g)).toHaveLength(1);
    expect(plan.metaUpdate.SelectedMks).toEqual(['mk-0', null]);
    expect(plan.metaUpdate.unknown).toEqual({ keep: true });
    expect(plan.variableWriteRequired).toBe(false);

    const repeated = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        seed,
        strictMessages(plan.messageUpdate?.content),
        { variables: { ERAMetaData: plan.metaUpdate } },
        { variables: { 在ai消息尾部生成特殊符号: true, 特殊符号值: '<自定义状态栏/>' } },
      ),
    );
    expect(repeated.messageWriteRequired).toBe(false);
    expect(repeated.variableWriteRequired).toBe(false);
  });

  it('生成回退保留完整三楼拓扑，不给待生成末楼补写 MK 或占位符', () => {
    const base = syncStep('sync', 'latest-message');
    const step = { ...base, task: { ...base.task, target: { kind: 'previous-of-latest' } } };
    const messages = [0, 1, 2].map(messageId => ({
      schemaVersion: 1,
      messageId,
      role: 'assistant',
      activeText: messageId === 2 ? '' : `floor ${messageId}`,
      swipeIndex: messageId === 2 ? 3 : 0,
    }));
    const plan = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        preparation.classifyDispatch(step, state(step)).seed,
        { schemaVersion: 2, messages },
        { variables: {} },
        { variables: {} },
        { characterId: 'test-card', chatId: 'test-chat', groupId: null },
      ),
    );
    expect(plan).toMatchObject({
      status: 'ready',
      messages,
      processingMk: null,
      messageUpdate: null,
      messageWriteRequired: false,
      variableWriteRequired: false,
    });
    expect(plan.sourceBasis.messages).toEqual(messages);
  });

  it('已确认的补MK更新来源依据，未提交的消息仍保留原依据', () => {
    const step = syncStep();
    const plan = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        preparation.classifyDispatch(step, state(step)).seed,
        strictMessages('用户原文'),
        { variables: {} },
        { variables: {} },
        { characterId: 'test-card', chatId: 'test-chat', groupId: null },
      ),
    );
    expect(plan.messageUpdate).not.toBeNull();
    const pending = preparation.preserveDispatchPreparation(plan);
    const uncommitted = preparation.dispatchContextOf(pending);
    expect(uncommitted.sourceBasis.messages).toEqual(plan.sourceBasis.messages);
    expect(uncommitted.stagedMessageUpdates).toHaveLength(1);
    const committed = preparation.dispatchContextOf({ ...pending, messageChanged: true });
    expect(committed.sourceBasis.messages.at(-1).activeText).toBe(plan.messageUpdate.content);
    expect(committed.stagedMessageUpdates).toEqual([]);
    expect(plan.sourceBasis.messages.at(-1).activeText).toBe('用户原文');
  });

  it('零消息只允许同步任务继续准备为空终态', () => {
    const sync = syncStep();
    const syncSeed = preparation.classifyDispatch(sync, state(sync)).seed;
    const syncPlan = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        syncSeed,
        { schemaVersion: 2, messages: [] },
        { variables: { ERAMetaData: { SelectedMks: ['old-mk'] } } },
        { variables: {} },
        { characterId: 'test-card', chatId: 'test-chat', groupId: null },
      ),
    );
    expect(syncPlan).toMatchObject({
      status: 'ready',
      messages: [],
      processingMessage: null,
      processingMk: null,
      messageWriteRequired: false,
      variableWriteRequired: false,
    });

    const update = updateMkStep();
    const updateSeed = preparation.classifyDispatch(update, state(update)).seed;
    const rejected = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        updateSeed,
        { schemaVersion: 2, messages: [] },
        { variables: {} },
        { variables: {} },
      ),
    );
    expect(rejected).toMatchObject({ status: 'failed', failure: { code: 'ERA_DISPATCH_EMPTY_CHAT' } });
  });

  it.each([
    ['api', 'state-sync', 'ready'],
    ['api', 'message-write', 'failed'],
    ['update-mk', undefined, 'failed'],
  ])('空历史 %s/%s 按真实任务意图准备为 %s', (kind, intent, expected) => {
    const base = syncStep();
    const step = { ...base, task: { ...base.task, kind, intent } };
    const seed = preparation.classifyDispatch(step, state(step)).seed;
    const plan = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        seed,
        { schemaVersion: 2, messages: [] },
        { variables: { ERAMetaData: { SelectedMks: ['old-mk'] } } },
        { variables: {} },
        { characterId: 'test-card', chatId: 'test-chat', groupId: null },
      ),
    );
    expect(plan.status).toBe(expected);
    expect(plan.messageWriteRequired).toBe(false);
    expect(plan.variableWriteRequired).toBe(false);
    expect(plan.processingMk).toBeNull();
    if (expected === 'failed') expect(plan.failure.code).toBe('ERA_DISPATCH_EMPTY_CHAT');
    else {
      expect(plan.metaUpdate.SelectedMks).toEqual(['old-mk']);
      const dispatchContext = preparation.dispatchContextOf(preparation.preserveDispatchPreparation(plan));
      // Facade.sync forwards this exact prepared context to the existing sync transaction.
      const routed = { ...base, dispatchContext };
      const work = transaction.planSyncWork({
        schemaVersion: 1,
        step: routed,
        consecutive: sync_contracts.consecutiveFacts(state(routed)),
        status: 'ready',
        messagesRaw: { schemaVersion: 2, messages: [] },
        variablesRaw: {
          stat_data: { stale: true },
          statFunc: { stale: { params: [], expr: '1' } },
          ERAMetaData: { SelectedMks: ['old-mk'], EditLogs: { 'old-mk': [] }, FunctionEditLogs: { 'old-mk': [] } },
        },
        failure: null,
      });
      expect(work.failure).toBeNull();
      expect(work.disposition).toBe('commit');
      expect(sync_commit_policy.buildSyncCommitRequest(work)).toMatchObject({
        messageWrites: [],
        stat: {},
        statFunc: {},
        meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
      });
    }
  });

  it('仅 update-mk 任务在准备阶段拥有 SelectedMks 提交权', () => {
    const step = updateMkStep();
    const seed = preparation.classifyDispatch(step, state(step)).seed;
    const plan = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        seed,
        strictMessages('用户正文', 'user'),
        { variables: { ERAMetaData: { SelectedMks: ['mk-0', null], unknown: { keep: true } } } },
        { variables: {} },
      ),
    );
    expect(plan.status).toBe('ready');
    expect(plan.processingMk).toMatch(/^era_mk_1001_/);
    expect(plan.variableWriteRequired).toBe(true);
    expect(plan.metaUpdate.SelectedMks).toEqual(['mk-0', null, plan.processingMk]);
    expect(plan.metaUpdate.unknown).toEqual({ keep: true });
  });

  it('占位符关闭时不新增也不删除历史值，用户消息从不追加占位符', () => {
    const step = syncStep();
    const seed = preparation.classifyDispatch(step, state(step)).seed;
    const off = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        seed,
        strictMessages('正文\n<历史占位符/>'),
        { variables: { ERAMetaData: {} } },
        { variables: { 在ai消息尾部生成特殊符号: false, 特殊符号值: '<新占位符/>' } },
      ),
    );
    expect(off.messageUpdate?.content).toContain('<历史占位符/>');
    expect(off.messageUpdate?.content).not.toContain('<新占位符/>');

    const user = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        seed,
        strictMessages('用户正文', 'user'),
        { variables: { ERAMetaData: {} } },
        { variables: { 在ai消息尾部生成特殊符号: true, 特殊符号值: '<状态栏/>' } },
      ),
    );
    expect(user.messageUpdate?.content).not.toContain('<状态栏/>');
  });

  it('预提交部分写入与未知确认均升级为 fatal', async () => {
    const updateStep = updateMkStep();
    const updateSeed = preparation.classifyDispatch(updateStep, state(updateStep)).seed;
    const updatePlan = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        updateSeed,
        strictMessages(),
        { variables: { ERAMetaData: {} } },
        { variables: {} },
      ),
    );
    await expect(
      commitNode.run(
        { 'era.dispatch.preparation.plan': { value: updatePlan } },
        {},
        {
          capabilities: {
            'era.tavern.messages': { update_content: async () => ({ status: 'committed' }) },
            'era.tavern.variables': { commit: async () => Promise.reject(new Error('变量提交失败')) },
          },
        },
      ),
    ).rejects.toThrow('ERA_DISPATCH_PARTIAL_COMMIT');

    const syncStepValue = syncStep();
    const syncSeed = preparation.classifyDispatch(syncStepValue, state(syncStepValue)).seed;
    const syncPlan = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        syncSeed,
        strictMessages(),
        { variables: { ERAMetaData: {} } },
        { variables: {} },
      ),
    );

    await expect(
      commitNode.run(
        { 'era.dispatch.preparation.plan': { value: syncPlan } },
        {},
        {
          capabilities: {
            'era.tavern.messages': { update_content: async () => ({ status: 'unknown' }) },
            'era.tavern.variables': { commit: async () => ({ status: 'committed' }) },
          },
        },
      ),
    ).rejects.toThrow('ERA_DISPATCH_MESSAGE_COMMIT_UNKNOWN');
  });
});

describe('严格 DTO、安全对象与 API 状态策略', () => {
  it('严格消息 DTO 拒绝 Date、附件及额外宿主字段', () => {
    expect(isEraTavernMessageContextV2(strictMessages())).toBe(true);
    expect(
      isEraTavernMessageContextV2({
        schemaVersion: 2,
        messages: [
          {
            ...strictMessages().messages[0],
            sendDate: new Date(),
            attachments: [{ url: 'asset://forbidden' }],
          },
        ],
      }),
    ).toBe(false);
  });

  it('legacy-safe-object 安全提升 __proto__ 字段，显式字段优先且不污染原型', () => {
    const payload: Record<string, unknown> = Object.create(null);
    Object.defineProperty(payload, '__proto__', {
      enumerable: true,
      value: { promoted: 1, explicit: '旧值' },
    });
    payload.explicit = '显式值';
    Object.defineProperty(payload, 'constructor', { enumerable: true, value: { keep: true } });
    Object.defineProperty(payload, 'prototype', { enumerable: true, value: '普通数据' });
    const normalized = normalizeLegacySafeObjectV1(payload);
    expect(Object.getPrototypeOf(normalized)).toBeNull();
    expect(normalized).toMatchObject({
      promoted: 1,
      explicit: '显式值',
      constructor: { keep: true },
      prototype: '普通数据',
    });
    expect(({} as Record<string, unknown>).promoted).toBeUndefined();
  });

  it('legacy-safe-object 拒绝循环、访问器、函数、Symbol 与非有限数值', () => {
    const circular: JsonRecord = {};
    circular.self = circular;
    expect(() => normalizeLegacySafeObjectV1(circular)).toThrow('循环引用');
    const accessor = {};
    Object.defineProperty(accessor, 'value', { enumerable: true, get: () => 1 });
    expect(() => normalizeLegacySafeObjectV1(accessor)).toThrow('不允许访问器');
    expect(() => normalizeLegacySafeObjectV1({ fn: () => undefined })).toThrow('不可移植值');
    expect(() => normalizeLegacySafeObjectV1({ [Symbol('key')]: 1 })).toThrow('Symbol');
    expect(() => normalizeLegacySafeObjectV1({ value: Number.POSITIVE_INFINITY })).toThrow('非有限数值');
  });

  it('所有 API 同步公开计数固定为 1，且前后 carry 完全不变', () => {
    const mkBlock = '<era_data>{"era-message-key"="mk-existing","era-message-type"="assistant"}</era_data>';
    const variables = {
      stat_data: { hp: 10 },
      ERAMetaData: { SelectedMks: ['mk-existing'], EditLogs: { 'mk-existing': [] } },
    };
    const messages = {
      schemaVersion: 2,
      messages: [{ schemaVersion: 1, messageId: 0, role: 'assistant', activeText: mkBlock, swipeIndex: null }],
    };
    const apiStep = syncStep('api', 'latest-message-with-mk', messages.messages, 'mk-existing');
    const apiWork = transaction.planSyncWork({
      schemaVersion: 1,
      step: apiStep,
      consecutive: sync_contracts.consecutiveFacts(state(apiStep)),
      status: 'ready',
      messagesRaw: messages,
      variablesRaw: variables,
      failure: null,
    });
    expect(apiWork.payload).toMatchObject({ consecutiveProcessingCount: 1, actions: { api: true } });
    expect(apiWork.plan?.nextConsecutiveState).toEqual({ mk: 'mk-existing', count: 4 });

    const normalStep = syncStep('sync', 'latest-message-with-mk', messages.messages, 'mk-existing');
    const normalWork = transaction.planSyncWork({
      schemaVersion: 1,
      step: normalStep,
      consecutive: sync_contracts.consecutiveFacts(state(normalStep)),
      status: 'ready',
      messagesRaw: messages,
      variablesRaw: variables,
      failure: null,
    });
    expect(normalWork.payload?.consecutiveProcessingCount).toBe(5);
    expect(normalWork.plan?.nextConsecutiveState).toEqual({ mk: 'mk-existing', count: 5 });
  });

  it('零消息同步构造无消息身份的真实状态提交', () => {
    const step = syncStep('sync', 'latest-message-with-mk', [], null);
    const work = transaction.planSyncWork({
      schemaVersion: 1,
      step,
      consecutive: sync_contracts.consecutiveFacts(state(step)),
      status: 'ready',
      messagesRaw: { schemaVersion: 2, messages: [] },
      variablesRaw: {
        stat_data: { stale: true },
        statFunc: { stale: { params: [], expr: '1' } },
        ERAMetaData: {
          SelectedMks: ['old-mk'],
          EditLogs: { 'old-mk': [] },
          FunctionEditLogs: { 'old-mk': [] },
        },
      },
      failure: null,
    });
    expect(work.failure).toBeNull();
    expect(work).toMatchObject({
      disposition: 'commit',
      payload: null,
      plan: {
        status: 'recalculated',
        committed: true,
        stat: {},
        statFunc: {},
        meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
      },
    });
    const request = sync_commit_policy.buildSyncCommitRequest(work);
    expect(request).toMatchObject({
      payload: null,
      messageWrites: [],
      stat: {},
      statFunc: {},
      meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
    });
    expect(sync_commit_policy.validateSyncCommitEnvelope({ mode: 'commit', request })).toMatchObject({
      route: 'valid',
    });
  });

  it('swipe 新 MK 不预提交消息，由同步事务原子写入并撤销 A、应用 B', async () => {
    const keyBlock = (mk: string) => `<era_data>{"era-message-key"="${mk}","era-message-type"="assistant"}</era_data>`;
    const rawMessages = [
      {
        schemaVersion: 1,
        messageId: 0,
        role: 'assistant',
        activeText: `起始消息\n${keyBlock('mk-0')}`,
        swipeIndex: null,
      },
      {
        schemaVersion: 1,
        messageId: 1,
        role: 'assistant',
        activeText: '<VariableInsert>{"ui_swipe":{"branch":"B"}}</VariableInsert>',
        swipeIndex: 1,
      },
    ];
    const variables = {
      stat_data: { ui_swipe: { branch: 'A' } },
      ERAMetaData: {
        SelectedMks: ['mk-0', 'mk-a'],
        EditLogs: {
          'mk-0': [],
          'mk-a': [{ op: 'insert', path: 'ui_swipe', value_new: { branch: 'A' } }],
        },
      },
    };
    const step = syncStep();
    const seed = preparation.classifyDispatch(step, state(step)).seed;
    const canonical = preparation.canonicalDispatchContext(
      seed,
      { schemaVersion: 2, messages: rawMessages },
      { variables },
      { variables: {} },
      { characterId: 'test-card', chatId: 'test-chat', groupId: null },
    );
    const plan = preparation.planDispatchPreparation(canonical);
    expect(plan.processingMk).toMatch(/^era_mk_1001_/);
    expect(plan.metaUpdate.SelectedMks).toEqual(['mk-0', 'mk-a']);
    expect(plan.variableWriteRequired).toBe(false);
    const routed = planMessagePreparationNode.PlanMessagePreparationNode(
      { 'era.dispatch.canonical_context': { value: canonical } },
      {},
    );
    expect(routed).toMatchObject({ precommit_route: 'no-op' });
    const dispatchContext = preparation.dispatchContextOf(preparation.preserveDispatchPreparation(plan));
    const routedStep = { ...step, dispatchContext };
    const work = transaction.planSyncWork({
      schemaVersion: 1,
      step: routedStep,
      consecutive: sync_contracts.consecutiveFacts(state(routedStep)),
      status: 'ready',
      messagesRaw: { schemaVersion: 2, messages: dispatchContext.messages },
      variablesRaw: variables,
      failure: null,
    });
    expect(work.disposition).toBe('commit');
    expect(work.plan).toMatchObject({
      status: 'recalculated',
      divergence: { type: 'FULL_RECALC', recalcId: 1, cause: 'divergence' },
      stat: { ui_swipe: { branch: 'B' } },
      rollback: { applied: true, fromMk: 'mk-a', toMk: 'mk-0' },
    });
    expect(work.plan?.meta.SelectedMks).toEqual(['mk-0', plan.processingMk]);
    expect((work.plan?.meta.EditLogs as JsonRecord)[String(plan.processingMk)]).toEqual([
      { op: 'insert', path: 'ui_swipe', value_new: { branch: 'B' } },
    ]);
    const request = sync_commit_policy.buildSyncCommitRequest(work);
    expect(request).toMatchObject({
      schemaVersion: 2,
      messageWrites: [
        {
          messageId: 1,
          content: expect.stringContaining(String(plan.processingMk)),
        },
      ],
      meta: { SelectedMks: ['mk-0', plan.processingMk] },
    });
  });

  it('最终楼层候选只在消息、processing、SelectedMks 与双日志使用同一 MK 时允许提交', () => {
    const mk = 'era_mk_atomic_floor';
    const content = [
      '原子楼层正文',
      '<VariableInsert>{"hero":{"hp":9}}</VariableInsert>',
      `<era_data>{"era-message-key"="${mk}","era-message-type"="assistant"}</era_data>`,
      '<StatusPlaceHolderImpl/>',
    ].join('\n');
    const message = {
      schemaVersion: 1,
      messageId: 0,
      role: 'assistant',
      activeText: content,
      swipeIndex: 0,
    };
    const step: JsonRecord = syncStep('sync', 'latest-message-with-mk', [message], mk);
    step.dispatchContext = {
      ...step.dispatchContext,
      schemaVersion: 3,
      generationCycleIdentity: {
        chatId: 'chat-atomic-floor',
        eventId: 'event-1',
        sourceKey: 'chat-atomic-floor:agent:1',
      },
      floorIdentity: {
        chatId: 'chat-atomic-floor',
        messageId: 0,
        swipeId: 0,
        mk,
      },
      stagedMessageUpdates: [{ messageId: 0, content }],
      agentFloorCandidate: {
        messageId: 0,
        swipeId: 0,
        mk,
        content,
        extra: { era_agent: { schemaVersion: 1, status: 'settled' } },
        terminalStatus: 'settled',
        requiresInitialPresentation: true,
      },
    };
    const work = transaction.planSyncWork({
      schemaVersion: 1,
      step,
      consecutive: sync_contracts.consecutiveFacts(state(step)),
      status: 'ready',
      messagesRaw: { schemaVersion: 2, messages: [message] },
      variablesRaw: {
        stat_data: {},
        statFunc: {},
        ERAMetaData: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
      },
      failure: null,
    });
    const request = sync_commit_policy.buildSyncCommitRequest(work);
    expect(sync_commit_policy.validateSyncCommitEnvelope({ mode: 'commit', request })).toMatchObject({
      route: 'valid',
    });
    expect(request).toMatchObject({
      schemaVersion: 2,
      floorIdentity: { messageId: 0, swipeId: 0, mk },
      agentFloorCandidate: { messageId: 0, swipeId: 0, mk },
      meta: {
        SelectedMks: [mk],
        EditLogs: { [mk]: expect.any(Array) },
        FunctionEditLogs: { [mk]: expect.any(Array) },
      },
      messageWrites: [{ messageId: 0, content, extra: expect.any(Object) }],
    });

    const mismatched = {
      ...request,
      messageWrites: [
        {
          ...request.messageWrites[0],
          content: request.messageWrites[0].content.replace(mk, 'era_mk_wrong_floor'),
        },
      ],
    };
    expect(sync_commit_policy.validateSyncCommitEnvelope({ mode: 'commit', request: mismatched })).toMatchObject({
      route: 'failed',
      failure: { failure: { code: 'ERA_FLOOR_IDENTITY_MISMATCH' } },
    });
  });
});

describe('同步阶段输入归属', () => {
  it('Node 边界只投影连续事实，规划请求不携带批次和存储编排字段', async () => {
    const readSync = await import(
      /* @vite-ignore */ new URL('../../../javascript_project/service/nodes/sync/read_sync_context.ts', import.meta.url)
        .href
    );
    const { prepareSyncPlanningInput } =
      await import('../../../javascript_project/service/base_lib/sync/sync_planning');
    const step = { ...syncStep(), dispatchContext: { status: 'ready', messages: [] } };
    const batch = state(step);
    const stored = { SidecarId: 'fixture' };
    const read = await readSync.run(
      {
        'era.step.request.routed': { value: step },
        'era.batch.execution.state': { value: batch },
      },
      {},
      { capabilities: { 'era.tavern.sidecar': { read_current: async () => stored } } },
    );
    expect(read.sync_context.consecutive).toEqual({ mk: 'mk-existing', count: 4 });
    expect(read.sync_context).not.toHaveProperty('state');
    batch.nextState.consecutiveProcessingCount = 99;
    const request = prepareSyncPlanningInput({ ...read.sync_context, sidecarBinding: { temporary: true } } as any);
    expect(request.consecutive).toEqual({ mk: 'mk-existing', count: 4 });
    expect(Object.keys(request).sort()).toEqual([
      'consecutive',
      'failure',
      'messagesRaw',
      'status',
      'step',
      'variablesRaw',
    ]);
  });
});
