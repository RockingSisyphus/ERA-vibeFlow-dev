import { describe, expect, it, vi } from 'vitest';

import { isEraTavernMessageContextV2, normalizeLegacySafeObjectV1 } from '../../../packages/era-contracts/index.js';

type JsonRecord = Record<string, any>;

const preparationUrl = new URL('../../../javascript_project/service/base_lib/dispatch_preparation.ts', import.meta.url)
  .href;
const transactionUrl = new URL('../../../javascript_project/service/base_lib/sync_transaction.ts', import.meta.url)
  .href;
const commitUrl = new URL('../../../javascript_project/service/nodes/dispatch/commit_preparation.ts', import.meta.url)
  .href;
const readUrl = new URL('../../../javascript_project/service/nodes/dispatch/read_canonical_context.ts', import.meta.url)
  .href;

const preparation = await import(/* @vite-ignore */ preparationUrl);
const transaction = await import(/* @vite-ignore */ transactionUrl);
const commitNode = await import(/* @vite-ignore */ commitUrl);
const readNode = await import(/* @vite-ignore */ readUrl);

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
      reason: dispatchClass === 'api' ? 'api-write' : 'edited',
      target: { kind: 'auto' },
      fullRebuild: false,
    },
    sources: [{ event: sourceEvent, relation: 'primary' }],
    dispatchContext: {
      schemaVersion: 2,
      status: 'ready',
      dispatchClass,
      requirement: context,
      messages: preparedMessages,
      processingMessage: preparedMessages.at(-1) ?? null,
      processingMk,
      messageChanged: false,
      variablesChanged: false,
      failure: null,
    },
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
      range: '0-{{lastMessageId}}',
      purpose: 'era-dispatch-prepare',
    });
    expect(readVariables).not.toHaveBeenCalled();
    const plan = preparation.planDispatchPreparation(result.canonical_dispatch_context);
    expect(plan).toMatchObject({ processingMk: null, messageUpdate: null, variableWriteRequired: false });
  });

  it('with-mk 一次性确保 MK、保留 null 位置并幂等追加自定义占位符', () => {
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
    expect(plan.metaUpdate.SelectedMks).toEqual(['mk-0', null, plan.processingMk]);
    expect(plan.metaUpdate.unknown).toEqual({ keep: true });

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
    const step = syncStep();
    const seed = preparation.classifyDispatch(step, state(step)).seed;
    const plan = preparation.planDispatchPreparation(
      preparation.canonicalDispatchContext(
        seed,
        strictMessages(),
        { variables: { ERAMetaData: {} } },
        { variables: {} },
      ),
    );
    await expect(
      commitNode.run(
        { 'era.dispatch.preparation.plan': { value: plan } },
        {},
        {
          capabilities: {
            'era.tavern.messages': { update_content: async () => ({ status: 'committed' }) },
            'era.tavern.variables': { commit: async () => Promise.reject(new Error('变量提交失败')) },
          },
        },
      ),
    ).rejects.toThrow('ERA_DISPATCH_PARTIAL_COMMIT');

    await expect(
      commitNode.run(
        { 'era.dispatch.preparation.plan': { value: plan } },
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
      state: state(apiStep),
      status: 'ready',
      messagesRaw: messages,
      variablesRaw: variables,
      failure: null,
    });
    expect(apiWork.payload).toMatchObject({ consecutiveProcessingCount: 1, actions: { api: true, apiWrite: true } });
    expect(apiWork.plan?.nextConsecutiveState).toEqual({ mk: 'mk-existing', count: 4 });

    const normalStep = syncStep('sync', 'latest-message-with-mk', messages.messages, 'mk-existing');
    const normalWork = transaction.planSyncWork({
      schemaVersion: 1,
      step: normalStep,
      state: state(normalStep),
      status: 'ready',
      messagesRaw: messages,
      variablesRaw: variables,
      failure: null,
    });
    expect(normalWork.payload?.consecutiveProcessingCount).toBe(5);
    expect(normalWork.plan?.nextConsecutiveState).toEqual({ mk: 'mk-existing', count: 5 });
  });
});
