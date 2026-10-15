import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../native-tavern/native-fixture.mjs';
import { EVENT_CATALOG } from '../../src/ERA变量框架/events/catalog';
import { mountEraPresentation } from '../../src/ERA变量框架/index';
vi.hoisted(() => {
  vi.stubGlobal('$', () => {});
});
import { requestEraService } from '../../src/ERA变量框架/service/client';
const view = vi.hoisted(() => ({ order: [] as string[], active: { macro: 0, ui: 0, dom: 0, api: 0 }, mounts: 0 }));
vi.mock('../../src/ERA变量框架/macro/parser', () => ({
  startEraMacroSubsystem: () => {
    view.order.push('macro.start');
    view.active.macro++;
    return () => {
      view.order.push('macro.stop');
      view.active.macro--;
    };
  },
}));
vi.mock('../../src/ERA变量框架/ui', () => ({
  startEraUi: () => {
    view.order.push('ui.start');
    view.active.ui++;
    view.mounts++;
    return {
      stop: () => {
        view.order.push('ui.stop');
        view.active.ui--;
      },
    };
  },
}));
vi.mock('../../src/ERA变量框架/ui/external-statusbar', () => ({
  startExternalStatusbar: () => {
    view.active.dom++;
    return () => {
      view.active.dom--;
    };
  },
}));
vi.mock('../../src/ERA变量框架/service/single-floor-runtime', () => ({ startSingleFloor: () => () => {} }));
vi.mock('../../src/ERA变量框架/service/statusbar-runtime', () => ({ createEraStatusbarRuntime: () => ({}) }));
vi.mock('../../src/ERA变量框架/utils/era_data', () => ({ initEraSettings: () => view.order.push('settings.refresh') }));
vi.mock('../../src/ERA变量框架/service/public-api', () => ({
  installEraPublicApi: () => {
    view.order.push('api.install');
    view.active.api++;
    return () => {
      view.active.api--;
    };
  },
}));
const owners: any[] = [];
const hold = () => Promise.withResolvers<void>();
function awaitAbort(signal: AbortSignal) {
  return signal.aborted
    ? Promise.resolve()
    : new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
}
async function start(holdStartup?: ReturnType<typeof hold>, failure?: ReturnType<typeof hold>, signal?: AbortSignal) {
  const owner = await fixture(
    async (_inputs: object, { signal, capabilities }: any) => {
      view.order.push('workflow');
      capabilities['era.tavern.startup_gate'].activate({ route: 'allow' });
      const port = capabilities['vibeflow.port'];
      const event = (await port.receive({ port: 'era.service.in' })).value;
      expect(event.type).toBe('app_ready');
      view.order.push('app_ready');
      if (holdStartup) await Promise.race([holdStartup.promise, awaitAbort(signal)]);
      if (signal.aborted) return;
      port.send({
        port: 'era.service.out',
        value: {
          schemaVersion: 1,
          frameId: 'startup',
          kind: 'batch-result',
          throughSequence: event.sequence,
          settlements: [
            {
              eventId: event.eventId,
              sequence: event.sequence,
              status: 'completed',
              taskId: 'startup',
              relation: 'primary',
            },
          ],
          notifications: [],
          diagnostics: [],
          fatal: false,
        },
      });
      if (failure) await Promise.race([failure.promise, awaitAbort(signal)]);
      else await awaitAbort(signal);
    },
    { eventDefinitions: [...EVENT_CATALOG.values()], onActivated: mountEraPresentation, signal },
  );
  owners.push(owner);
  return owner;
}
async function unload(owner: any) {
  owner.page.dispatchEvent(new Event('pagehide'));
  await owner.work;
}
function listeners(owner: any) {
  return [...owner.handlers.values()].reduce((n: number, items: any) => n + items.size, 0);
}
beforeEach(() => {
  view.order = [];
  view.active = { macro: 0, ui: 0, dom: 0, api: 0 };
  view.mounts = 0;
});
afterEach(async () => {
  for (const owner of owners.splice(0)) {
    owner.page.dispatchEvent(new Event('pagehide'));
    await owner.work.catch(() => {});
  }
  vi.restoreAllMocks();
});

describe('角色卡单次原生入口与展示资源归属', () => {
  it.each(['pagehide', 'owner-cancel'] as const)('初始化回执等待中%s后旧续体不晚挂载或影响新实例', async mode => {
    const pending = hold(),
      controller = new AbortController();
    const old = await start(pending, undefined, controller.signal);
    await vi.waitFor(() => expect(view.order).toContain('app_ready'));
    const oldStopped = old.work.catch(() => {});
    if (mode === 'pagehide') old.page.dispatchEvent(new Event('pagehide'));
    else controller.abort();
    await oldStopped;
    expect(listeners(old)).toBe(0);
    expect(view.active).toEqual({ macro: 0, ui: 0, dom: 0, api: 0 });
    const current = await start();
    await vi.waitFor(() => expect(view.active.ui).toBe(1));
    pending.resolve();
    await Promise.resolve();
    expect(view.mounts).toBe(1);
    expect(view.active).toEqual({ macro: 1, ui: 1, dom: 1, api: 1 });
    expect(listeners(current)).toBe(14);
  });
  it('按workflow、初始化回执、宏、UI顺序启动，卸载再加载10次不增长资源', async () => {
    for (let index = 0; index < 10; index++) {
      const owner = await start();
      await vi.waitFor(() => expect(view.active.ui).toBe(1));
      expect(listeners(owner)).toBe(14);
      expect(view.active).toEqual({ macro: 1, ui: 1, dom: 1, api: 1 });
      await unload(owner);
      expect(owner.disposed()).toBe(1);
      expect(listeners(owner)).toBe(0);
      expect(view.active).toEqual({ macro: 0, ui: 0, dom: 0, api: 0 });
    }
    expect(view.order.slice(0, 6)).toEqual([
      'workflow',
      'api.install',
      'app_ready',
      'settings.refresh',
      'macro.start',
      'ui.start',
    ]);
    expect(view.mounts).toBe(10);
    expect(requestEraService('era.ui.after_stop')).toMatchObject({
      accepted: false,
      code: 'ERA_APP_SERVICE_UNAVAILABLE',
    });
    expect(globalThis).not.toHaveProperty('__ERA_VIBEFLOW_SERVICE_ADAPTER__');
    expect(globalThis).not.toHaveProperty('__ERA_VIBEFLOW_APP_RUNTIME__');
  });
  it('pagehide在一秒内完成实际收尾，重复卸载不重复释放展示', async () => {
    const owner = await start();
    await vi.waitFor(() => expect(view.active.ui).toBe(1));
    const started = performance.now();
    owner.page.dispatchEvent(new Event('pagehide'));
    expect(view.active).toEqual({ macro: 0, ui: 0, dom: 0, api: 0 });
    await owner.work;
    await unload(owner);
    expect(performance.now() - started).toBeLessThanOrEqual(1000);
    expect(owner.disposed()).toBe(1);
    expect(listeners(owner)).toBe(0);
    expect(view.active).toEqual({ macro: 0, ui: 0, dom: 0, api: 0 });
  });
  it('主Service意外失败由原生父流程收敛全部任务和展示资源', async () => {
    const failure = hold(),
      owner = await start(undefined, failure);
    await vi.waitFor(() => expect(view.active.ui).toBe(1));
    const stopped = expect(owner.work).rejects.toBeDefined();
    failure.reject(new Error('永久workflow崩溃'));
    await stopped;
    expect(owner.disposed()).toBe(1);
    expect(listeners(owner)).toBe(0);
    expect(view.active).toEqual({ macro: 0, ui: 0, dom: 0, api: 0 });
    expect(requestEraService('after-fatal')).toMatchObject({ accepted: false, code: 'ERA_APP_SERVICE_UNAVAILABLE' });
  });
});
