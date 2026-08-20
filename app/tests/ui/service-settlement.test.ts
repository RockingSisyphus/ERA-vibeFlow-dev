import { describe, expect, it, vi } from 'vitest';

import type { EraAdmissionResult, EraSettlement } from '../../src/ERA变量框架/service/types';
import { awaitUiSettlement } from '../../src/ERA变量框架/ui/utils/service-settlement';

function accepted(done: Promise<EraSettlement>): EraAdmissionResult {
  return {
    accepted: true,
    eventId: 'event-1',
    sequence: 1,
    done,
    waitThrough: async () => ({ throughSequence: 1, outcomes: [], hasFailures: false }),
  };
}

describe('ERA UI receipt settlement boundary', () => {
  it('only resolves a completed receipt', async () => {
    await expect(
      awaitUiSettlement(accepted(Promise.resolve({ eventId: 'event-1', sequence: 1, status: 'completed' })), '测试'),
    ).resolves.toMatchObject({ status: 'completed' });
  });

  it.each(['ignored', 'failed', 'cancelled'] as const)('rejects a %s receipt', async status => {
    await expect(
      awaitUiSettlement(accepted(Promise.resolve({ eventId: 'event-1', sequence: 1, status })), '测试'),
    ).rejects.toThrow(`${status}`);
  });

  it('rejects admission before it waits for a receipt', async () => {
    await expect(
      awaitUiSettlement({ accepted: false, code: 'ERA_QUEUE_FULL', message: '队列已满' }, '测试'),
    ).rejects.toMatchObject({
      name: 'UiServiceSettlementError',
      message: 'ERA_QUEUE_FULL: 队列已满',
    });
  });

  it('times out without changing the late receipt promise', async () => {
    vi.useFakeTimers();
    let settle!: (value: EraSettlement) => void;
    const done = new Promise<EraSettlement>(resolve => {
      settle = resolve;
    });
    const waiting = awaitUiSettlement(accepted(done), '测试', 30);
    const timedOut = expect(waiting).rejects.toThrow('测试等待 ERA 服务结算超时。');
    await vi.advanceTimersByTimeAsync(30);
    await timedOut;
    settle({ eventId: 'event-1', sequence: 1, status: 'completed' });
    await expect(done).resolves.toMatchObject({ status: 'completed' });
    vi.useRealTimers();
  });
});
