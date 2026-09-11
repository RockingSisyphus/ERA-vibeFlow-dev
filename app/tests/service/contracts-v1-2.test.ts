import { describe, expect, it } from 'vitest';

interface ContractsModule {
  isEraTavernMessageV1(value: unknown): boolean;
  isEraTavernMessageContextV2(value: unknown): boolean;
  isEraDispatchContextV2(value: unknown): boolean;
  isEraDomainTaskV1(value: unknown): boolean;
  isEraPlannedSourceV1(value: unknown): boolean;
  isEraPlannedStepV1(value: unknown): boolean;
  isEraTaskResultV1(value: unknown): boolean;
  isEraTaskStateUpdateV1(value: unknown): boolean;
}

const contractsUrl = new URL('../../../packages/era-contracts/index.js', import.meta.url).href;
const contracts = (await import(/* @vite-ignore */ contractsUrl)) as ContractsModule;

function transportEvent(type = 'era.ui.update_settings') {
  return {
    schemaVersion: 1,
    eventId: 'event-1',
    sequence: 1,
    type,
    occurredAt: 1_000,
    source: 'ui',
    args: [{ kind: 'json', value: { enabled: true } }],
    encodedBytes: 32,
  } as const;
}

function initializeTask() {
  const event = transportEvent();
  return {
    id: 'task:settings:event-1',
    sourceEvents: [event],
    primaryEvent: event,
    context: 'none',
    kind: 'initialize',
    operation: 'settings-update',
    args: event.args,
  } as const;
}

describe('ERA contracts 1.4 canonical DTO', () => {
  it('严格消息投影只接受五个固定字段与第二版上下文', () => {
    const message = {
      schemaVersion: 1,
      messageId: 7,
      role: 'assistant',
      activeText: '当前 swipe 文本',
      swipeIndex: 2,
    } as const;
    expect(contracts.isEraTavernMessageV1(message)).toBe(true);
    expect(contracts.isEraTavernMessageContextV2({ schemaVersion: 2, messages: [message] })).toBe(true);
    expect(contracts.isEraTavernMessageV1({ ...message, sendDate: new Date() })).toBe(false);
    expect(contracts.isEraTavernMessageV1({ ...message, messageId: -1 })).toBe(false);
    expect(contracts.isEraTavernMessageContextV2({ schemaVersion: 1, messages: [message] })).toBe(false);
  });

  it('派发上下文 V2 分离消息快照与不可变 processing 身份', () => {
    const message = {
      schemaVersion: 1,
      messageId: 7,
      role: 'assistant',
      activeText: '当前文本',
      swipeIndex: null,
    } as const;
    const context = {
      schemaVersion: 2,
      status: 'ready',
      dispatchClass: 'sync',
      requirement: 'latest-message-with-mk',
      messages: [message],
      processingMessage: message,
      processingMk: 'mk-7',
      messageChanged: false,
      variablesChanged: false,
      failure: null,
    } as const;
    expect(contracts.isEraDispatchContextV2(context)).toBe(true);
    expect(contracts.isEraDispatchContextV2({ ...context, schemaVersion: 1 })).toBe(false);
    expect(contracts.isEraDispatchContextV2({ ...context, processingMk: null })).toBe(false);

    const emptySync = {
      ...context,
      dispatchClass: 'sync',
      messages: [],
      processingMessage: null,
      processingMk: null,
    };
    expect(contracts.isEraDispatchContextV2(emptySync)).toBe(true);
    // Facade.sync retains the api class; preparation checks state-sync versus message-write.
    expect(contracts.isEraDispatchContextV2({ ...emptySync, dispatchClass: 'api' })).toBe(true);
    expect(contracts.isEraDispatchContextV2({ ...emptySync, dispatchClass: 'update-mk' })).toBe(false);
    expect(contracts.isEraDispatchContextV2({ ...emptySync, processingMk: 'forged-mk' })).toBe(false);
  });

  it('严格接受完整 execute 任务/来源并拒绝 task、route 或 source 降格', () => {
    const task = initializeTask();
    const source = { event: task.primaryEvent, relation: 'primary' } as const;
    const step = {
      kind: 'execute',
      stepId: 'step:task:settings:event-1',
      index: 0,
      taskRoute: 'initialize',
      sourceSequences: [1],
      events: [task.primaryEvent],
      task,
      sources: [source],
    } as const;
    expect(contracts.isEraDomainTaskV1(task)).toBe(true);
    expect(contracts.isEraPlannedSourceV1(source)).toBe(true);
    expect(contracts.isEraPlannedStepV1(step)).toBe(true);
    expect(contracts.isEraPlannedStepV1({ ...step, taskRoute: 'sync' })).toBe(false);
    expect(contracts.isEraPlannedStepV1({ ...step, task: undefined })).toBe(false);
    expect(
      contracts.isEraPlannedStepV1({
        ...step,
        sources: [{ ...source, relation: 'coalesced', event: { ...source.event, sequence: 2 } }],
      }),
    ).toBe(false);
  });

  it('显式接受携带原因的 ignore 步骤，不再把它降格为 sync', () => {
    const event = transportEvent('era.service.collection_timer');
    const timerEvent = { ...event, source: 'timer', args: [{ kind: 'json', value: 'timer-1' }] } as const;
    const step = {
      kind: 'ignore',
      stepId: 'step:timer:1:event-1',
      index: 0,
      taskRoute: 'ignore',
      sourceSequences: [1],
      events: [timerEvent],
      reason: '内部定时器只关闭窗口',
    } as const;
    expect(contracts.isEraPlannedStepV1(step)).toBe(true);
    expect(contracts.isEraPlannedStepV1({ ...step, taskRoute: 'sync' })).toBe(false);
    expect(contracts.isEraPlannedStepV1({ ...step, reason: '' })).toBe(false);
  });

  it('stateUpdate 只承载易失计数字段，任务结果不要求也不允许持久版本字段', () => {
    const stateUpdate = { consecutiveMk: 'mk-1', consecutiveProcessingCount: 2 } as const;
    expect(contracts.isEraTaskStateUpdateV1(stateUpdate)).toBe(true);
    expect(contracts.isEraTaskStateUpdateV1({ consecutiveMk: 'mk-1' })).toBe(false);
    expect(
      contracts.isEraTaskResultV1({
        status: 'committed',
        settlements: [],
        notifications: [],
        diagnostics: [],
        stateUpdate,
      }),
    ).toBe(true);
    expect(
      contracts.isEraTaskResultV1({
        status: 'committed',
        settlements: [],
        notifications: [],
        diagnostics: [],
        stateUpdate: { ...stateUpdate, schemaVersion: 1 },
      }),
    ).toBe(false);
  });

  it('stateUpdate 可选携带块游标：合法游标通过，越界或多余键拒绝', () => {
    const cursor = {
      messageId: 7,
      mk: 'mk-7',
      blockIndex: 2,
      stat: { hp: 70 },
      statFunc: {},
      resolvedCallIds: ['c1'],
      done: false,
    };
    const base = { consecutiveMk: 'mk-1', consecutiveProcessingCount: 2 } as const;

    // 游标是可选的：不携带时形状不变（真机历史状态里没有它）。
    expect(contracts.isEraTaskStateUpdateV1(base)).toBe(true);
    expect(contracts.isEraTaskStateUpdateV1({ ...base, syncCursor: cursor })).toBe(true);
    expect(contracts.isEraTaskStateUpdateV1({ ...base, syncCursor: null })).toBe(true);

    // 非法游标必须被拒，否则宿主会把坏游标写进服务状态。
    expect(contracts.isEraTaskStateUpdateV1({ ...base, syncCursor: { ...cursor, mk: '' } })).toBe(false);
    expect(contracts.isEraTaskStateUpdateV1({ ...base, syncCursor: { ...cursor, blockIndex: -1 } })).toBe(false);
    expect(contracts.isEraTaskStateUpdateV1({ ...base, syncCursor: { ...cursor, unexpected: true } })).toBe(false);
    expect(
      contracts.isEraTaskStateUpdateV1({
        ...base,
        syncCursor: { ...cursor, resolvedCallIds: [''] },
      }),
    ).toBe(false);
  });
});
