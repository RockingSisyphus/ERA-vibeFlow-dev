import { afterEach, describe, it, expect, vi } from 'vitest';
import { subscriptionRegistry } from '../native-tavern/subscription-fixture.mjs';
const registries: Awaited<ReturnType<typeof subscriptionRegistry>>[] = [];
afterEach(async () => {
  for (const registry of registries.splice(0)) await registry.dispose();
});
async function registryFor(onError: (error: unknown) => void) {
  const registry = await subscriptionRegistry(onError);
  registries.push(registry);
  return registry;
}
import type {
  EraGenerationCompletion,
  EraGenerationEvent,
  GenerationSubscriptionStop,
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
    const registry = await registryFor(error);
    const held = gate();
    const called: string[] = [];
    registry.subscribe(async (e: EraGenerationEvent) => {
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
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(called).toEqual(['first']);
    held.release();
    expect(await done).toBe(true);
    expect(called).toEqual(['first', 'second']);
    expect(error).toHaveBeenCalledOnce();
  });
  it('cancels a stalled callback without starting later callbacks', async () => {
    const registry = await registryFor(vi.fn());
    let signal!: AbortSignal;
    const later = vi.fn();
    registry.subscribe((e: EraGenerationEvent) => {
      signal = e.signal;
      return registry.hold();
    });
    registry.subscribe(later);
    const done = registry.publish(completion);
    await new Promise(resolve => setTimeout(resolve, 0));
    registry.cancel();
    expect(await done).toBe(false);
    expect(signal.aborted).toBe(true);
    expect(later).not.toHaveBeenCalled();
  });
  it('explicitly unsubscribing releases its wait and allows the others to continue', async () => {
    const registry = await registryFor(vi.fn());
    const later = vi.fn();
    const stop = registry.subscribe(() => registry.hold());
    registry.subscribe(later);
    const done = registry.publish(completion);
    await new Promise(resolve => setTimeout(resolve, 0));
    stop();
    expect(await done).toBe(true);
    expect(later).toHaveBeenCalledOnce();
    registry.clear();
    await registry.publish(completion);
    expect(later).toHaveBeenCalledOnce();
  });
  it('disposing a managed iframe invalidates the generation waiting on it', async () => {
    const registry = await registryFor(vi.fn());
    const later = vi.fn();
    const stop = registry.subscribe(() => registry.hold()) as GenerationSubscriptionStop;
    registry.subscribe(later);
    const done = registry.publish(completion);
    await new Promise(resolve => setTimeout(resolve, 0));
    stop.cancelPending!();
    expect(await done).toBe(false);
    expect(later).not.toHaveBeenCalled();
  });
});
