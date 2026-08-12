import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INPUT_EVENT } from '../../src/ERA变量框架/events/catalog';
import { requestEraService } from '../../src/ERA变量框架/service/client';
import {
  ERA_ADAPTER_GLOBAL_KEY,
  ERA_RUNTIME_GLOBAL_KEY,
  startEraApplication,
  type EraAppRuntime,
  type EraApplicationDependencies,
  type EraPageLifecycleTarget,
} from '../../src/ERA变量框架/service/lifecycle';
import { ERA_TAVERN_LISTENER_COUNT, TavernEraServiceAdapter } from '../../src/ERA变量框架/service/tavern-adapter';
import type { EraAdmissionResult, EraRuntimeAdapter, EraWorkflowHost } from '../../src/ERA变量框架/service/types';

type EventHandler = (...args: unknown[]) => unknown;

class FakePageTarget implements EraPageLifecycleTarget {
  private readonly listeners = new Set<() => void>();

  addEventListener(_type: 'pagehide', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'pagehide', listener: () => void): void {
    this.listeners.delete(listener);
  }

  dispatchPagehide(): void {
    for (const listener of [...this.listeners]) listener();
  }

  get count(): number {
    return this.listeners.size;
  }
}

class FakeEventRegistry {
  private readonly listeners = new Map<string, Set<EventHandler>>();

  add(type: string, handler: EventHandler) {
    const values = this.listeners.get(type) ?? new Set<EventHandler>();
    values.add(handler);
    this.listeners.set(type, values);
    return { stop: () => this.remove(type, handler) };
  }

  remove(type: string, handler: EventHandler): void {
    const values = this.listeners.get(type);
    values?.delete(handler);
    if (values?.size === 0) this.listeners.delete(type);
  }

  get count(): number {
    return [...this.listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0);
  }
}

class FakeWorkflowHost implements EraWorkflowHost {
  started = false;
  stopCount = 0;
  private unsubscribe: (() => void) | null = null;
  private resolveService: (() => void) | null = null;
  private rejectService: ((error: unknown) => void) | null = null;

  constructor(
    private readonly adapter: EraRuntimeAdapter,
    private readonly order: string[],
  ) {}

  async start(): Promise<void> {
    this.order.push('host.start');
    this.unsubscribe = this.adapter.subscribe(event => {
      this.order.push(`event:${event.type}`);
      return {
        accepted: true,
        eventId: `fake:${event.type}`,
        sequence: 1,
        done: Promise.resolve({
          eventId: `fake:${event.type}`,
          sequence: 1,
          status: 'completed',
        }),
        waitThrough: async () => ({ throughSequence: 1, outcomes: [], hasFailures: false }),
      };
    });
    this.started = true;
  }

  runWorkflowAsync(): Promise<unknown> {
    this.order.push('host.run');
    return new Promise<void>((resolve, reject) => {
      this.resolveService = resolve;
      this.rejectService = reject;
    });
  }

  async stop(): Promise<void> {
    this.order.push('host.stop');
    this.stopCount += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.started = false;
    this.resolveService?.();
  }

  fail(error: unknown): void {
    this.rejectService?.(error);
  }
}

interface Fixture {
  readonly dependencies: EraApplicationDependencies;
  readonly events: FakeEventRegistry;
  readonly globals: Record<string, unknown>;
  readonly hosts: FakeWorkflowHost[];
  readonly order: string[];
  readonly page: FakePageTarget;
  readonly fatals: unknown[];
  readonly warnings: unknown[];
  readonly active: { macro: number; ui: number; dom: number };
}

function createFixture(): Fixture {
  const globals: Record<string, unknown> = {};
  const page = new FakePageTarget();
  const order: string[] = [];
  const fatals: unknown[] = [];
  const warnings: unknown[] = [];
  const hosts: FakeWorkflowHost[] = [];
  const active = { macro: 0, ui: 0, dom: 0 };
  let currentAdapter: EraRuntimeAdapter | null = null;

  const dependencies: EraApplicationDependencies = {
    globals,
    pageTarget: page,
    startupEventType: INPUT_EVENT.APP_READY,
    createAdapter: options => {
      order.push('adapter.create');
      const adapter = new TavernEraServiceAdapter(options);
      const originalStopAccepting = adapter.stopAccepting.bind(adapter);
      adapter.stopAccepting = () => {
        order.push('adapter.stopAccepting');
        originalStopAccepting();
      };
      currentAdapter = adapter;
      return adapter;
    },
    createHost: () => {
      order.push('host.create');
      if (!currentAdapter) throw new Error('必须先创建 adapter。');
      const host = new FakeWorkflowHost(currentAdapter, order);
      hosts.push(host);
      return host;
    },
    startMacro: () => {
      order.push('macro.start');
      active.macro += 1;
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        order.push('macro.stop');
        active.macro -= 1;
      };
    },
    startUi: () => {
      order.push('ui.start');
      active.ui += 1;
      active.dom += 1;
      let stopped = false;
      return {
        mounted: true,
        stop: () => {
          if (stopped) return;
          stopped = true;
          order.push('ui.stop');
          active.ui -= 1;
          active.dom -= 1;
        },
      };
    },
    refreshSettings: () => order.push('settings.refresh'),
    dispatchSettingsUpdated: () => order.push('settings.dispatch'),
    warnAdmission: (result: EraAdmissionResult, label: string) => {
      if (!result.accepted) warnings.push({ label, result });
    },
    warnStop: error => warnings.push(error),
    reportFatal: error => {
      order.push('fatal');
      fatals.push(error);
    },
  };

  return { dependencies, events: new FakeEventRegistry(), globals, hosts, order, page, fatals, warnings, active };
}

describe('ERA 生产生命周期', () => {
  let fixture: Fixture;
  let runtime: EraAppRuntime | null;

  beforeEach(() => {
    fixture = createFixture();
    runtime = null;
    vi.stubGlobal('eventOn', (type: string, handler: EventHandler) => fixture.events.add(type, handler));
    vi.stubGlobal('eventMakeFirst', (type: string, handler: EventHandler) => fixture.events.add(type, handler));
    vi.stubGlobal('eventMakeLast', (type: string, handler: EventHandler) => fixture.events.add(type, handler));
    vi.stubGlobal('eventRemoveListener', (type: string, handler: EventHandler) => fixture.events.remove(type, handler));
    vi.stubGlobal('getButtonEvent', (name: string) => `era-button:${name}`);
  });

  afterEach(async () => {
    await runtime?.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('按 Host → workflow → 初始化 → 宏 → UI 顺序启动，热重载 10 次不增长资源', async () => {
    for (let index = 0; index < 10; index += 1) {
      runtime = await startEraApplication(fixture.dependencies);
      expect(fixture.events.count).toBe(ERA_TAVERN_LISTENER_COUNT);
      expect(fixture.page.count).toBe(1);
      expect(fixture.active).toEqual({ macro: 1, ui: 1, dom: 1 });
    }

    const firstStart = [
      fixture.order.indexOf('host.create'),
      fixture.order.indexOf('host.start'),
      fixture.order.indexOf('host.run'),
      fixture.order.indexOf(`event:${INPUT_EVENT.APP_READY}`),
      fixture.order.indexOf('settings.refresh'),
      fixture.order.indexOf('macro.start'),
      fixture.order.indexOf('ui.start'),
    ];
    expect(firstStart.every(index => index >= 0)).toBe(true);
    expect(firstStart).toEqual([...firstStart].sort((left, right) => left - right));
    expect(fixture.hosts).toHaveLength(10);
    expect(fixture.hosts.slice(0, -1).every(host => host.stopCount === 1)).toBe(true);
    const activeRuntime = runtime;
    if (!activeRuntime) throw new Error('ERA 热重载后没有活动运行时。');
    expect(fixture.globals[ERA_ADAPTER_GLOBAL_KEY]).toBe(activeRuntime.adapter);
    expect(fixture.globals[ERA_RUNTIME_GLOBAL_KEY]).toBe(activeRuntime);

    await activeRuntime.stop();
    expect(fixture.hosts.every(host => host.stopCount === 1)).toBe(true);
    expect(fixture.events.count).toBe(0);
    expect(fixture.page.count).toBe(0);
    expect(fixture.active).toEqual({ macro: 0, ui: 0, dom: 0 });
    expect(requestEraService('era.ui.after_stop')).toMatchObject({
      accepted: false,
      code: 'ERA_APP_SERVICE_UNAVAILABLE',
    });
    expect(fixture.globals).not.toHaveProperty(ERA_ADAPTER_GLOBAL_KEY);
    expect(fixture.globals).not.toHaveProperty(ERA_RUNTIME_GLOBAL_KEY);

    const stopTail = fixture.order.slice(-4);
    expect(stopTail).toEqual(['adapter.stopAccepting', 'macro.stop', 'ui.stop', 'host.stop']);
  });

  it('pagehide 执行同一幂等停止，不留监听、宏或 UI', async () => {
    runtime = await startEraApplication(fixture.dependencies);
    const startedAt = performance.now();
    fixture.page.dispatchPagehide();
    await runtime.stop();
    const elapsedMs = performance.now() - startedAt;

    expect(elapsedMs).toBeLessThanOrEqual(1_000);
    expect(fixture.page.count).toBe(0);
    expect(fixture.events.count).toBe(0);
    expect(fixture.active).toEqual({ macro: 0, ui: 0, dom: 0 });
    expect(fixture.hosts[0]?.stopCount).toBe(1);
  });

  it('永久 workflow 非预期 reject 立即停止接纳并收敛全部生命周期', async () => {
    runtime = await startEraApplication(fixture.dependencies);
    const failure = new Error('永久 workflow 崩溃');
    fixture.hosts[0]?.fail(failure);

    await vi.waitFor(() => expect(fixture.fatals).toEqual([failure]));
    expect(runtime.adapter.enqueue('after-fatal', 'ui', [])).toMatchObject({
      accepted: false,
      code: 'ERA_APP_SERVICE_UNAVAILABLE',
    });
    await runtime.stop();

    expect(fixture.hosts[0]?.stopCount).toBe(1);
    expect(fixture.events.count).toBe(0);
    expect(fixture.page.count).toBe(0);
    expect(fixture.active).toEqual({ macro: 0, ui: 0, dom: 0 });
    expect(fixture.globals).not.toHaveProperty(ERA_RUNTIME_GLOBAL_KEY);
  });
});
