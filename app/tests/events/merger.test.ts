import { describe, expect, it } from 'vitest';

import { INPUT_EVENT } from '../../src/ERA变量框架/events/catalog';
import { hasImmediateCombo, planEventBatch } from '../../src/ERA变量框架/events/merger';
import type { RawEvent } from '../../src/ERA变量框架/events/types';
import { ERA_API_EVENTS } from '../../src/ERA变量框架/utils/constants';

function rawEvent(sequence: number, type: string, occurredAt: number, args: readonly unknown[] = []): RawEvent {
  return {
    id: `event-${sequence}`,
    sequence,
    type,
    args,
    occurredAt,
  };
}

describe('事件批次规划器', () => {
  it('把明确的单人 regenerate 生成为生成前定向回退任务', () => {
    const regenerate = rawEvent(1, INPUT_EVENT.GENERATION_STARTED, 1_000, [
      'regenerate',
      { automatic_trigger: false },
      false,
    ]);

    expect(planEventBatch([regenerate])).toMatchObject([
      {
        kind: 'execute',
        task: {
          kind: 'sync',
          reason: 'swipe-regeneration',
          target: { kind: 'previous-of-latest', stopAfterTarget: true },
          context: 'latest-message',
        },
        sources: [{ event: regenerate, relation: 'primary' }],
      },
    ]);
  });

  it.each(['normal', 'continue', 'quiet', 'impersonate'])('不会把 %s 生成误判为回退', generationType => {
    const generation = rawEvent(1, INPUT_EVENT.GENERATION_STARTED, 1_000, [generationType, {}, false]);

    expect(planEventBatch([generation])).toMatchObject([
      {
        kind: 'ignore',
        events: [generation],
      },
    ]);
  });

  it('不会把 regenerate dry-run 预演误判为回退', () => {
    const dryRun = rawEvent(1, INPUT_EVENT.GENERATION_STARTED, 1_000, ['regenerate', {}, true]);

    expect(planEventBatch([dryRun])).toMatchObject([
      {
        kind: 'ignore',
        events: [dryRun],
      },
    ]);
  });

  it('在 600ms 边界内识别 swipe + generation，并生成定向回退任务', () => {
    const swipe = rawEvent(1, INPUT_EVENT.MESSAGE_SWIPED, 1_000, [12]);
    const generation = rawEvent(2, INPUT_EVENT.GENERATION_STARTED, 1_600, ['swipe', { automatic: true }, false]);

    expect(hasImmediateCombo([swipe, generation])).toBe(true);

    const steps = planEventBatch([swipe, generation]);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      kind: 'execute',
      task: {
        kind: 'sync',
        reason: 'swipe-regeneration',
        target: { kind: 'previous-of-latest', stopAfterTarget: true },
        context: 'latest-message',
      },
      sources: [
        { event: swipe, relation: 'combined' },
        { event: generation, relation: 'combined' },
      ],
    });
  });

  it('超过 600ms 时不再组成 swipe combo，并明确忽略孤立 generation', () => {
    const swipe = rawEvent(1, INPUT_EVENT.MESSAGE_SWIPED, 1_000);
    const generation = rawEvent(2, INPUT_EVENT.GENERATION_STARTED, 1_601);

    expect(hasImmediateCombo([swipe, generation])).toBe(false);

    const steps = planEventBatch([swipe, generation]);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({
      kind: 'execute',
      task: { kind: 'sync', reason: 'history-changed' },
    });
    expect(steps[1]).toMatchObject({
      kind: 'ignore',
      events: [generation],
    });
  });

  it('dry-run generation 即使位于窗口内也不会组成 swipe-regeneration', () => {
    const swipe = rawEvent(1, INPUT_EVENT.MESSAGE_SWIPED, 1_000, [12]);
    const dryRun = rawEvent(2, INPUT_EVENT.GENERATION_STARTED, 1_400, ['swipe', {}, true]);

    expect(hasImmediateCombo([swipe, dryRun])).toBe(false);
    expect(planEventBatch([swipe, dryRun])).toMatchObject([
      {
        kind: 'execute',
        task: { kind: 'sync', reason: 'history-changed' },
      },
      {
        kind: 'ignore',
        events: [dryRun],
      },
    ]);
  });

  it('dry-run 在 swipe 与真实 generation 之间保持透明，不会截断真实组合', () => {
    const swipe = rawEvent(1, INPUT_EVENT.MESSAGE_SWIPED, 1_000, [12]);
    const dryRun = rawEvent(2, INPUT_EVENT.GENERATION_STARTED, 1_200, ['swipe', {}, true]);
    const generation = rawEvent(3, INPUT_EVENT.GENERATION_STARTED, 1_400, ['swipe', {}, false]);

    expect(hasImmediateCombo([swipe, dryRun, generation])).toBe(true);
    expect(planEventBatch([swipe, dryRun, generation])).toMatchObject([
      {
        kind: 'execute',
        task: { kind: 'sync', reason: 'swipe-regeneration' },
        sources: [
          { event: swipe, relation: 'combined' },
          { event: generation, relation: 'combined' },
        ],
      },
      {
        kind: 'ignore',
        events: [dryRun],
      },
    ]);
  });

  it('在 1500ms 边界内把 edit-and-continue 翻译为领域同步任务', () => {
    const updated = rawEvent(1, INPUT_EVENT.MESSAGE_UPDATED, 10_000, [8]);
    const generation = rawEvent(2, INPUT_EVENT.GENERATION_STARTED, 11_500, ['normal', {}, false]);

    expect(hasImmediateCombo([updated, generation])).toBe(true);
    expect(planEventBatch([updated, generation])).toMatchObject([
      {
        kind: 'execute',
        task: {
          kind: 'sync',
          reason: 'edited',
          target: { kind: 'auto' },
          context: 'latest-message-with-mk',
        },
      },
    ]);
  });

  it('把相邻普通同步事件折叠为一个任务，同时保留全部来源和结算关系', () => {
    const received = rawEvent(1, INPUT_EVENT.MESSAGE_RECEIVED, 1_000, [3, 'assistant']);
    const deleted = rawEvent(2, INPUT_EVENT.MESSAGE_DELETED, 1_020, [3]);

    const steps = planEventBatch([received, deleted]);

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      kind: 'execute',
      task: {
        kind: 'sync',
        reason: 'history-changed',
        primaryEvent: deleted,
      },
      sources: [
        { event: received, relation: 'coalesced' },
        { event: deleted, relation: 'primary' },
      ],
    });
  });

  it('为孤立 starter 和未知事件生成明确的 ignored 步骤', () => {
    const starter = rawEvent(1, INPUT_EVENT.MESSAGE_UPDATED, 1_000, [5]);
    const unknown = rawEvent(2, 'future_tavern_event', 2_000, ['detail']);

    expect(planEventBatch([starter, unknown])).toMatchObject([
      { kind: 'ignore', events: [starter] },
      { kind: 'ignore', events: [unknown] },
    ]);
  });

  it('声明 API 的领域影响，写入任务要求状态提交而查询任务不要求消息上下文', () => {
    const write = rawEvent(1, ERA_API_EVENTS.UPDATE_BY_OBJECT, 1_000, [{ character: { hp: 8 } }]);
    const query = rawEvent(2, ERA_API_EVENTS.GET_CURRENT_VARS, 2_000);

    expect(planEventBatch([write, query])).toMatchObject([
      {
        kind: 'execute',
        task: {
          kind: 'api',
          intent: 'message-write',
          context: 'latest-message-with-mk',
        },
      },
      {
        kind: 'execute',
        task: {
          kind: 'api',
          intent: 'query',
          context: 'none',
        },
      },
    ]);
  });
});
