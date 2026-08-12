import { describe, expect, it } from 'vitest';

import { INPUT_EVENT } from '../../src/ERA变量框架/events/catalog';
import { createEventHandler, type EventSchedulerPort } from '../../src/ERA变量框架/events/scheduler';
import type { WaitThroughResult } from '../../src/ERA变量框架/events/types';

function createPort(waitResult: WaitThroughResult = { throughSequence: 1, outcomes: [], hasFailures: false }) {
  const enqueued: Array<{ type: string; args: readonly unknown[] }> = [];
  const waitedSequences: number[] = [];
  let nextSequence = 1;

  const port: EventSchedulerPort = {
    enqueue(type, args = []) {
      const sequence = nextSequence++;
      enqueued.push({ type, args });
      return {
        eventId: `event:${sequence}`,
        sequence,
        done: Promise.resolve({ status: 'ignored', reason: '监听器策略测试' }),
      };
    },
    async waitThrough(sequence) {
      waitedSequences.push(sequence);
      return { ...waitResult, throughSequence: sequence };
    },
  };

  return { port, enqueued, waitedSequences };
}

describe('酒馆事件监听策略', () => {
  it('detached 事件保留全部参数并同步返回 undefined', () => {
    const { port, enqueued, waitedSequences } = createPort();
    const handler = createEventHandler(port, INPUT_EVENT.MESSAGE_SWIPED);
    const args = [12, { source: 'button' }, '额外参数'] as const;

    const returned = handler(...args);

    expect(returned).toBeUndefined();
    expect(enqueued).toEqual([{ type: INPUT_EVENT.MESSAGE_SWIPED, args }]);
    expect(waitedSequences).toEqual([]);
  });

  it('真实 GENERATION_STARTED 返回生成栅栏 Promise，并在结算后调用回调', async () => {
    const result: WaitThroughResult = {
      throughSequence: 1,
      outcomes: [],
      hasFailures: true,
    };
    const { port, enqueued, waitedSequences } = createPort(result);
    const settledResults: WaitThroughResult[] = [];
    const handler = createEventHandler(port, INPUT_EVENT.GENERATION_STARTED, {
      onBarrierSettled: settled => {
        settledResults.push(settled);
      },
    });
    const args = ['swipe', { automatic: true }, false] as const;

    const returned = handler(...args);

    expect(returned).toBeInstanceOf(Promise);
    await returned;
    expect(enqueued).toEqual([{ type: INPUT_EVENT.GENERATION_STARTED, args }]);
    expect(waitedSequences).toEqual([1]);
    expect(settledResults).toEqual([{ ...result, throughSequence: 1 }]);
  });

  it('dry-run GENERATION_STARTED 仍完整入队，但不阻塞酒馆', () => {
    const { port, enqueued, waitedSequences } = createPort();
    const handler = createEventHandler(port, INPUT_EVENT.GENERATION_STARTED);
    const args = ['normal', { quiet_prompt: 'preview' }, true] as const;

    const returned = handler(...args);

    expect(returned).toBeUndefined();
    expect(enqueued).toEqual([{ type: INPUT_EVENT.GENERATION_STARTED, args }]);
    expect(waitedSequences).toEqual([]);
  });
});
