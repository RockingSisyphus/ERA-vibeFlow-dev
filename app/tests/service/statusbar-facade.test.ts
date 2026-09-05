import { describe, expect, it, vi } from 'vitest';
import type { EraFacade, EraPublicState } from '../../src/ERA变量框架/service/public-api';
import { createPendingStatusbarFacade } from '../../src/ERA变量框架/service/statusbar-facade';

vi.mock('../../src/ERA变量框架/service/public-state', () => ({
  projectPublicState: () => ({ status: 'loading', message_id: null }),
}));

describe('statusbar pending Facade', () => {
  it('holds ERA-dependent work, keeps local identity and forwards force after binding', async () => {
    const latest = { message_id: 10, status: 'ready' } as EraPublicState;
    const floor = { message_id: 2, status: 'ready' } as EraPublicState;
    const top = { get: vi.fn(() => latest), commit: vi.fn(), history: {}, statusbar: {} } as unknown as EraFacade;
    const pending = createPendingStatusbarFacade(top);
    const listener = vi.fn();
    const unsubscribe = pending.facade.subscribe(listener);
    const continued = vi.fn();
    const ready = pending.facade.ready({ force: true }).then(continued);
    await Promise.resolve();
    expect(continued).not.toHaveBeenCalled();
    expect(pending.facade.get()).toMatchObject({ status: 'loading', message_id: null });
    await expect(pending.facade.commit([])).rejects.toThrow('ERA_STATUSBAR_NOT_READY');
    expect(top.get).not.toHaveBeenCalled();
    expect(top.commit).not.toHaveBeenCalled();
    const cleanup = vi.fn();
    const local = {
      ...top,
      get: vi.fn(() => floor),
      ready: vi.fn(async () => floor),
      subscribe: vi.fn(() => cleanup),
      commit: vi.fn(async () => ({ messageId: 2 })),
    } as unknown as EraFacade;
    pending.bind(local);
    await ready;
    expect(continued).toHaveBeenCalledWith(floor);
    expect(local.ready).toHaveBeenCalledWith({ force: true });
    expect(pending.facade.get()).toBe(floor);
    await pending.facade.commit([]);
    expect(local.commit).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('rejects pending readiness on unload and leaves stale references unusable', async () => {
    const pending = createPendingStatusbarFacade({} as EraFacade);
    const ready = pending.facade.ready();
    const rejection = expect(ready).rejects.toThrow('FRAME_CLOSED');
    pending.dispose();
    await rejection;
    await expect(pending.facade.commit([])).rejects.toThrow('FRAME_CLOSED');
    expect(pending.facade.get().status).toBe('loading');
  });
});
