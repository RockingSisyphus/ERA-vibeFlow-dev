import { describe, it, expect, vi } from 'vitest';
import {
  GenerationSubscriptions,
  type EraGenerationCompletion,
  type GenerationSubscriptionStop,
} from '../../src/ERA变量框架/service/generation-subscriptions';
const completion: EraGenerationCompletion = {
  executionId: 'e',
  completionId: 'e:planning',
  trigger: 'initial',
  chatKey: 'chat',
  stage: 'planning',
  result: { plan: { hp: 14 } },
};
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}
describe('generation stage subscriptions', () => {
  it('awaits in registration order, filters stages and continues after rejection', async () => {
    const error = vi.fn();
    const registry = new GenerationSubscriptions(error);
    const held = gate();
    const called: string[] = [];
    registry.subscribe(async e => {
      expect(Object.isFrozen(e.result)).toBe(true);
      called.push('first');
      await held.promise;
      throw Error('author');
    });
    registry.subscribe(() => {
      called.push('second');
    });
    registry.subscribe(
      () => {
        called.push('wrong stage');
      },
      { stages: ['story'] },
    );
    const done = registry.publish(completion);
    await Promise.resolve();
    expect(called).toEqual(['first']);
    held.release();
    expect(await done).toBe(true);
    expect(called).toEqual(['first', 'second']);
    expect(error).toHaveBeenCalledOnce();
  });
  it('cancels a stalled callback without starting later callbacks', async () => {
    const registry = new GenerationSubscriptions(vi.fn());
    let signal!: AbortSignal;
    const later = vi.fn();
    registry.subscribe(e => {
      signal = e.signal;
      return new Promise(() => {});
    });
    registry.subscribe(later);
    const done = registry.publish(completion);
    await Promise.resolve();
    registry.cancel();
    expect(await done).toBe(false);
    expect(signal.aborted).toBe(true);
    expect(later).not.toHaveBeenCalled();
  });
  it('explicitly unsubscribing releases its wait and allows the others to continue', async () => {
    const registry = new GenerationSubscriptions(vi.fn());
    const later = vi.fn();
    const stop = registry.subscribe(() => new Promise(() => {}));
    registry.subscribe(later);
    const done = registry.publish(completion);
    await Promise.resolve();
    stop();
    expect(await done).toBe(true);
    expect(later).toHaveBeenCalledOnce();
    registry.clear();
    await registry.publish(completion);
    expect(later).toHaveBeenCalledOnce();
  });
  it('disposing a managed iframe invalidates the generation waiting on it', async () => {
    const registry = new GenerationSubscriptions(vi.fn());
    const later = vi.fn();
    const stop = registry.subscribe(() => new Promise(() => {})) as GenerationSubscriptionStop;
    registry.subscribe(later);
    const done = registry.publish(completion);
    await Promise.resolve();
    stop.cancelPending!();
    expect(await done).toBe(false);
    expect(later).not.toHaveBeenCalled();
  });
});
