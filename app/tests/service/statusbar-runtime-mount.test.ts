import { describe, expect, it, vi } from 'vitest';
import type { EraFacade } from '../../src/ERA变量框架/service/public-api';
import { createEraStatusbarRuntime } from '../../src/ERA变量框架/service/statusbar-runtime';

const published = vi.hoisted(() => ({
  listener: () => undefined,
  selected: ['mk-0'] as string[],
  project: vi.fn(() => []),
}));
vi.mock('@era/vibeflow-floor-snapshot', () => ({ projectFloorSnapshots: published.project }));
vi.mock('../../src/ERA变量框架/utils/era_data', () => ({ settings: { value: {} } }));
vi.mock('../../src/ERA变量框架/service/public-state', () => ({
  projectPublicState: () => ({ status: 'loading' }),
  selectedMks: () => published.selected,
  currentTavernIdentityMatches: () => true,
}));
vi.mock('../../src/ERA变量框架/service/statusbar-runtime-support', () => ({
  projectionKey: () => 'current',
  managedStatusbarMessageIds: () => [0, 2],
  activeStatusbarMessageIds: () => new Set([0, 2]),
}));
vi.mock('../../src/ERA变量框架/service/statusbar-identity', () => ({}));
vi.mock('../../src/ERA变量框架/service/sidecar-runtime-snapshot', () => ({
  readActiveSidecarRuntimeSnapshot: () => ({ eraMeta: {}, statData: {}, statFunc: {} }),
  subscribeSidecarRuntimeSnapshot: (listener: () => undefined) => {
    published.listener = listener;
    return () => undefined;
  },
}));
vi.mock('../../src/ERA变量框架/service/statusbar-mount', () => ({
  waitForStatusbarRoot: (_frame: Window, signal: AbortSignal) =>
    new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
}));

describe('statusbar document lifecycle', () => {
  it('projects only published floors while a newly rendered floor is still awaiting its first commit', () => {
    const runtime = createEraStatusbarRuntime({} as EraFacade, vi.fn());
    published.project.mockClear();
    published.listener();
    expect(published.project).toHaveBeenLastCalledWith(expect.objectContaining({ messageIds: [0] }));
    published.selected = ['mk-0', 'mk-1', 'mk-2'];
    published.listener();
    expect(published.project).toHaveBeenLastCalledWith(expect.objectContaining({ messageIds: [0, 2] }));
    runtime.stop();
  });
  it('deduplicates one document but reinstalls the local facade when the same WindowProxy reloads', async () => {
    const runtime = createEraStatusbarRuntime({} as EraFacade, vi.fn());
    const proxy = Object.assign(new EventTarget(), { document: {}, ERA: undefined as EraFacade | undefined });
    const first = runtime.mount(proxy as unknown as Window);
    const facade = proxy.ERA;
    expect(facade).toBeDefined();
    expect(runtime.mount(proxy as unknown as Window)).toBe(first);

    // Browser navigation retains its WindowProxy but replaces both document and JavaScript globals.
    proxy.document = {};
    Object.defineProperty(proxy, 'ERA', { value: undefined, configurable: true });
    const second = runtime.mount(proxy as unknown as Window);
    expect(second).not.toBe(first);
    expect(proxy.ERA).toBeDefined();
    expect(proxy.ERA).not.toBe(facade);
    const stopped = Promise.all([
      expect(first).rejects.toThrow('RUNTIME_UNAVAILABLE'),
      expect(second).rejects.toThrow('RUNTIME_UNAVAILABLE'),
    ]);
    runtime.stop();
    await stopped;
  });
});
