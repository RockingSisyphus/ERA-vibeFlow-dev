// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mountExternalFrame } from '../../src/ERA变量框架/service/external-statusbar-frame';
import { subscriptionRegistry } from '../native-tavern/subscription-fixture.mjs';
const registries: Awaited<ReturnType<typeof subscriptionRegistry>>[] = [];
afterEach(async () => {
  for (const registry of registries.splice(0)) await registry.dispose();
});
import type { EraFacade } from '../../src/ERA变量框架/service/public-api';

afterEach(() => document.body.replaceChildren());

it.each(['stop', 'pagehide'] as const)(
  'external iframe %s cancels its awaited generation and releases subscriptions',
  async close => {
    const registry = await subscriptionRegistry(vi.fn());
    registries.push(registry);
    const era = {
      generation: { subscribe: registry.subscribe.bind(registry) },
      get: () => ({ status: 'loading' }),
      subscribe: () => () => undefined,
    } as unknown as EraFacade;
    const container = document.createElement('div');
    document.body.append(container);
    const instance = mountExternalFrame(
      container,
      '<p>author content</p>',
      { era, helper: {}, getContext: () => ({}), macros: text => text },
      vi.fn(),
    );
    const local = (instance.frame.contentWindow as unknown as { ERA: EraFacade }).ERA;
    let signal: AbortSignal | undefined;
    const entered = vi.fn();
    local.generation.subscribe(event => {
      signal = event.signal;
      entered();
      return registry.hold();
    });
    const later = vi.fn();
    registry.subscribe(later);
    const completion = {
      executionId: 'e',
      completionId: 'p',
      trigger: 'initial',
      chatKey: 'chat',
      stage: 'planning' as const,
      result: { plan: {}, functionResults: [] },
    };
    const pending = registry.publish(completion);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(entered).toHaveBeenCalledOnce();
    if (close === 'stop') instance.stop();
    else instance.frame.contentWindow!.dispatchEvent(new Event('pagehide'));
    expect(await pending).toBe(false);
    expect(signal?.aborted).toBe(true);
    expect(later).not.toHaveBeenCalled();
    await registry.publish({ ...completion, completionId: 'next' });
    expect(entered).toHaveBeenCalledOnce();
    expect(later).toHaveBeenCalledOnce();
    expect(() => local.generation.subscribe(() => undefined)).toThrow('ERA_EXTERNAL_INSTANCE_DISPOSED');
    instance.stop();
  },
);
