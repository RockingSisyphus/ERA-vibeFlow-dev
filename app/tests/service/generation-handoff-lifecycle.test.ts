import { afterEach, expect, it, vi } from 'vitest';
import {
  cancelGenerationWaitForEvent,
  dispatchGenerationHandoff,
  generationHandoffs,
} from '../../src/ERA变量框架/service/generation-handoff-host';
import { generationSubscriptions } from '../../src/ERA变量框架/service/generation-subscriptions';
import type { EraPreparedNotification } from '../../src/ERA变量框架/service/types';

afterEach(() => {
  generationHandoffs.cancel();
  generationSubscriptions.clear();
});

it.each([
  ['chat_id_changed', ['other-chat']],
  ['message_swiped', [5]],
  ['generation_started', ['regenerate']],
  ['message_sent', [6]],
] as const)('%s releases a stalled handoff without enqueueing its obsolete continuation', async (type, args) => {
  let signal: AbortSignal | undefined;
  let finishAuthor!: () => void;
  generationSubscriptions.subscribe(event => {
    signal = event.signal;
    return new Promise<void>(resolve => {
      finishAuthor = resolve;
    });
  });
  const later = vi.fn();
  generationSubscriptions.subscribe(later);
  generationHandoffs.open('old-stage');
  const waiting = generationHandoffs.wait('old-stage');
  const enqueue = vi.fn();
  const done = dispatchGenerationHandoff(
    {
      args: [{ completionId: 'old-stage', executionId: 'old-cycle', stage: 'planning', result: { plan: {} } }],
    } as unknown as EraPreparedNotification,
    new AbortController().signal,
    enqueue,
  );
  await Promise.resolve();
  expect(signal?.aborted).toBe(false);
  // The native normal-generation event is part of this same cycle.
  cancelGenerationWaitForEvent('generation_started', ['normal']);
  expect(generationHandoffs.has('old-stage')).toBe(true);
  cancelGenerationWaitForEvent(type, args);
  expect(await waiting).toBeNull();
  await done;
  expect(signal?.aborted).toBe(true);
  expect(later).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
  finishAuthor();
  await Promise.resolve();
  expect(enqueue).not.toHaveBeenCalled();
});
