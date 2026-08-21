import { describe, expect, it } from 'vitest';

import {
  createHostExtension,
  ERA_INTERNAL_REPLAY_WRITE_DONE_NOTIFICATION_TYPE,
  ERA_WRITE_DONE_NOTIFICATION_TYPE,
  type EraAdmissionResult,
  type EraInboundEvent,
  type EraPreparedNotification,
  type EraTavernClock,
  type EraTavernHostAdapter,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Host 差分测试必须直接读取跨 root 的扩展源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/host_extensions/service_host';

class FakeClock implements EraTavernClock {
  private nowValue = 1_000;
  private nextHandle = 1;
  private readonly tasks = new Map<number, { readonly dueAt: number; readonly callback: () => void }>();

  now(): number {
    return this.nowValue;
  }

  setTimeout(callback: () => void, delayMs: number): unknown {
    const handle = this.nextHandle++;
    this.tasks.set(handle, {
      dueAt: this.nowValue + Math.max(0, delayMs),
      callback,
    });
    return handle;
  }

  clearTimeout(handle: unknown): void {
    if (typeof handle === 'number') this.tasks.delete(handle);
  }

  advance(milliseconds: number): void {
    const target = this.nowValue + milliseconds;
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.dueAt <= target)
        .sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
      if (!next) break;
      const [handle, task] = next;
      this.tasks.delete(handle);
      this.nowValue = task.dueAt;
      task.callback();
    }
    this.nowValue = target;
  }
}

class FakeAdapter implements EraTavernHostAdapter {
  readonly clock = new FakeClock();
  readonly warnings: Array<{
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }> = [];
  readonly notifications: EraPreparedNotification[] = [];
  readonly lifecycleOrder: string[] = [];
  sidecarPromptClearCount = 0;

  private listener: ((event: EraInboundEvent) => EraAdmissionResult) | null = null;
  notificationImplementation: (notification: EraPreparedNotification, signal: AbortSignal) => void | Promise<void> =
    () => undefined;

  readonly variables = {
    read: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    commit: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
  };

  readonly messages = {
    read_context: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    update_content: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    refresh: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
  };

  readonly worldbook = {
    read: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    create: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    bind: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    replace_entries: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
  };

  readonly regex = {
    read: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    upsert: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
  };

  readonly identity = {
    read: (input: Readonly<Record<string, unknown>>) => ({ ...input }),
  };

  readonly sidecar = {
    read_current: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    read_record: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    write_record: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    commit_metadata: async (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    create_id: () => ({ sidecarId: 'era_chat_fake-id' }),
    present_prompt: (input: Readonly<Record<string, unknown>>) => ({ ...input }),
    clear_prompt: (input: Readonly<Record<string, unknown>>) => {
      this.sidecarPromptClearCount += 1;
      return { ...input };
    },
  };

  subscribe(listener: (event: EraInboundEvent) => EraAdmissionResult): () => void {
    if (this.listener) throw new Error('重复注册 fake listener');
    this.listener = listener;
    this.lifecycleOrder.push('start');
    return () => {
      if (!this.listener) return;
      this.listener = null;
      this.lifecycleOrder.push('stop');
    };
  }

  emit(event: EraInboundEvent): EraAdmissionResult {
    if (!this.listener) throw new Error('fake listener 尚未注册');
    return this.listener(event);
  }

  notify(notification: EraPreparedNotification, context: { readonly signal: AbortSignal }): void | Promise<void> {
    this.notifications.push(notification);
    this.lifecycleOrder.push(`notify:${notification.type}`);
    return this.notificationImplementation(notification, context.signal);
  }

  warn(message: string, details?: Readonly<Record<string, unknown>>): void {
    this.warnings.push({ message, details });
  }

  get listenerCount(): number {
    return this.listener ? 1 : 0;
  }
}

function createFixture(
  adapter = new FakeAdapter(),
  limits: {
    readonly max_fifo_events?: number;
    readonly max_fifo_bytes?: number;
    readonly max_event_bytes?: number;
    readonly max_host_refs_per_event?: number;
  } = {},
) {
  const controller = new AbortController();
  const host = createHostExtension({
    extensionId: 'era.tavern.service_host',
    config: {
      ports: {
        inbound: 'era.service.in',
        outbound: 'era.service.out',
      },
      limits: {
        max_event_bytes: limits.max_event_bytes ?? 262_144,
        max_fifo_events: limits.max_fifo_events ?? 256,
        max_fifo_bytes: limits.max_fifo_bytes ?? 8_388_608,
        max_host_refs_per_event: limits.max_host_refs_per_event ?? 32,
      },
      barrier_watchdog_ms: 5,
    },
    signal: controller.signal,
    adapter,
  });
  return { adapter, controller, host };
}

function assertAccepted(result: EraAdmissionResult) {
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error(result.message);
  return result;
}

function ignoredBatch(
  frameId: string,
  admission: { readonly eventId: string; readonly sequence: number },
  notifications: readonly unknown[] = [],
) {
  return {
    schemaVersion: 1,
    frameId,
    kind: 'batch-result',
    throughSequence: admission.sequence,
    settlements: [
      {
        eventId: admission.eventId,
        sequence: admission.sequence,
        status: 'ignored',
        reason: 'G3 受控空业务结算',
      },
    ],
    notifications,
    diagnostics: [],
    fatal: false,
  } as const;
}

function fatalBatch(
  frameId: string,
  admission: { readonly eventId: string; readonly sequence: number },
  notifications: readonly unknown[] = [],
) {
  return {
    ...ignoredBatch(frameId, admission, notifications),
    fatal: true,
  } as const;
}

describe('ERA 服务 Host Extension 核心', () => {
  it('import/create 无监听副作用，start 与 stop 均幂等', async () => {
    const { adapter, host } = createFixture();

    expect(adapter.listenerCount).toBe(0);
    expect(host.diagnostics.snapshot()).toMatchObject({
      started: false,
      accepted: 0,
      pendingReceipts: 0,
      timers: 0,
      hostRefs: 0,
      notifications: 0,
      portWaiters: 0,
    });

    host.start();
    host.start();
    expect(adapter.listenerCount).toBe(1);

    await host.stop();
    await host.stop();
    expect(adapter.listenerCount).toBe(0);
    expect(adapter.lifecycleOrder).toEqual(['start', 'stop']);
    expect(adapter.sidecarPromptClearCount).toBe(1);
  });

  it('无损编码 tagged args，并严格保持结算先于通知启动', async () => {
    const { adapter, host } = createFixture();
    host.start();
    const callback = () => '宿主对象';
    const crossRealmLike = Object.assign(Object.create(null) as Record<string, unknown>, {
      iframeDetail: { counter: 1 },
    });
    const receive = host.capabilities['vibeflow.port'].receive({
      port: 'era.service.in',
    });
    const admission = assertAccepted(
      adapter.emit({
        type: 'message_received',
        source: 'tavern',
        args: [{ nested: [1, null] }, undefined, callback, crossRealmLike],
        receipt: {
          settle: () => adapter.lifecycleOrder.push('settle'),
        },
      }),
    );
    const received = (await receive).value;

    expect(received.sequence).toBe(1);
    expect(received.args).toEqual([
      { kind: 'json', value: { nested: [1, null] } },
      { kind: 'undefined' },
      {
        kind: 'host-ref',
        token: 'era.tavern.service_host:event:1:ref:1',
        refKind: 'function',
      },
      { kind: 'json', value: { iframeDetail: { counter: 1 } } },
    ]);
    expect(host.diagnostics.snapshot()).toMatchObject({
      accepted: 1,
      pendingReceipts: 1,
      hostRefs: 1,
      queueBytes: 0,
    });

    const notificationArg = received.args[2];
    host.capabilities['vibeflow.port'].send({
      port: 'era.service.out',
      value: ignoredBatch('batch:1', admission, [{ type: 'era:test', args: [notificationArg] }]),
    });

    await expect(admission.done).resolves.toMatchObject({
      status: 'ignored',
      sequence: 1,
    });
    expect(adapter.lifecycleOrder.slice(-2)).toEqual(['settle', 'notify:era:test']);
    expect(adapter.notifications[0]?.args[0]).toBe(callback);
    expect(host.diagnostics.snapshot()).toMatchObject({
      settled: 1,
      pendingReceipts: 0,
      hostRefs: 0,
    });

    await host.stop();
  });

  it('同 frameId 同内容重放为 no-op，异内容重放报协议冲突', async () => {
    const { adapter, host } = createFixture();
    host.start();
    const admission = assertAccepted(adapter.emit({ type: 'manual_sync', source: 'ui', args: [] }));
    const frame = ignoredBatch('batch:idempotent', admission, [{ type: 'era:test', args: [] }]);

    host.capabilities['vibeflow.port'].send({
      port: 'era.service.out',
      value: frame,
    });
    host.capabilities['vibeflow.port'].send({
      port: 'era.service.out',
      value: frame,
    });
    expect(adapter.notifications).toHaveLength(1);

    expect(() =>
      host.capabilities['vibeflow.port'].send({
        port: 'era.service.out',
        value: { ...frame, fatal: true },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'ERA_HOST_FRAME_CONFLICT',
      }),
    );

    await host.stop();
  });

  it('致命批次先结算再锁存，阻止回执重入、挂起 Port 与 Capability 继续', async () => {
    const { adapter, host } = createFixture();
    adapter.variables.read = () => new Promise<never>(() => undefined);
    host.start();
    const port = host.capabilities['vibeflow.port'];
    const pendingCapability = host.capabilities['era.tavern.variables'].read({
      purpose: 'fatal-race',
    });
    const pendingCapabilityAssertion = expect(pendingCapability).rejects.toMatchObject({
      code: 'ERA_HOST_FATAL',
    });
    let reentrantAdmission: EraAdmissionResult | undefined;
    const receive = port.receive({ port: 'era.service.in' });
    const admission = assertAccepted(
      adapter.emit({
        type: 'fatal-source',
        source: 'ui',
        args: [],
        receipt: {
          settle: () => {
            adapter.lifecycleOrder.push('settle:fatal');
            reentrantAdmission = adapter.emit({
              type: 'receipt-reentrant',
              source: 'ui',
              args: [],
            });
          },
        },
      }),
    );
    await receive;
    const pendingReceive = port.receive({ port: 'era.service.in' });
    const pendingReceiveAssertion = expect(pendingReceive).rejects.toMatchObject({
      code: 'ERA_HOST_FATAL',
    });
    const frame = fatalBatch('batch:fatal', admission, [{ type: 'era:test', args: [] }]);

    port.send({ port: 'era.service.out', value: frame });

    await expect(admission.done).resolves.toMatchObject({ status: 'ignored' });
    await pendingReceiveAssertion;
    await pendingCapabilityAssertion;
    expect(reentrantAdmission).toMatchObject({
      accepted: false,
      code: 'ERA_HOST_FATAL',
    });
    expect(adapter.lifecycleOrder.slice(-2)).toEqual(['settle:fatal', 'notify:era:test']);
    expect(adapter.emit({ type: 'after-fatal', source: 'ui', args: [] })).toMatchObject({
      accepted: false,
      code: 'ERA_HOST_FATAL',
    });
    expect(() => port.receive({ port: 'era.service.in' })).toThrowError(
      expect.objectContaining({ code: 'ERA_HOST_FATAL' }),
    );
    expect(() => host.capabilities['era.tavern.identity'].read({})).toThrowError(
      expect.objectContaining({ code: 'ERA_HOST_FATAL' }),
    );
    expect(() =>
      port.send({
        port: 'era.service.out',
        value: {
          schemaVersion: 1,
          frameId: 'control:after-fatal',
          kind: 'collection-control',
          commands: [],
        },
      }),
    ).toThrowError(expect.objectContaining({ code: 'ERA_HOST_FATAL' }));

    // 已成功处理的致命帧仍可安全重放为 no-op。
    expect(() => port.send({ port: 'era.service.out', value: frame })).not.toThrow();
    expect(adapter.notifications).toHaveLength(1);
    expect(host.diagnostics.snapshot()).toMatchObject({
      fatal: true,
      pendingReceipts: 0,
      portWaiters: 0,
    });

    await host.stop();
    expect(host.diagnostics.snapshot()).toMatchObject({
      fatal: false,
      cachedWriteDone: false,
      queueEvents: 0,
      pendingReceipts: 0,
      timers: 0,
      hostRefs: 0,
      notifications: 0,
      portWaiters: 0,
      processedFrames: 0,
    });
  });

  it('无 writeDone 缓存时内部重播命令是 no-op，且不透传给外部', async () => {
    const { adapter, host } = createFixture();
    host.start();
    const receive = host.capabilities['vibeflow.port'].receive({ port: 'era.service.in' });
    const admission = assertAccepted(adapter.emit({ type: 'replay-empty', source: 'ui', args: [] }));
    await receive;

    host.capabilities['vibeflow.port'].send({
      port: 'era.service.out',
      value: ignoredBatch('batch:replay-empty', admission, [
        { type: ERA_INTERNAL_REPLAY_WRITE_DONE_NOTIFICATION_TYPE, args: [] },
      ]),
    });

    await admission.done;
    expect(adapter.notifications).toEqual([]);
    expect(host.diagnostics.snapshot()).toMatchObject({ cachedWriteDone: false });
    await host.stop();
  });

  it('缓存完整已解码 writeDone 参数，并以原公共类型精确重播', async () => {
    const { adapter, host } = createFixture();
    host.start();
    const port = host.capabilities['vibeflow.port'];
    const callback = () => '宿主引用';
    const firstReceive = port.receive({ port: 'era.service.in' });
    const first = assertAccepted(
      adapter.emit({
        type: 'write-source',
        source: 'ui',
        args: [{ nested: [1, null, { ok: true }] }, undefined, callback],
        receipt: {
          settle: () => adapter.lifecycleOrder.push('settle:writeDone'),
        },
      }),
    );
    const firstEvent = (await firstReceive).value;

    port.send({
      port: 'era.service.out',
      value: ignoredBatch('batch:cache-writeDone', first, [
        { type: ERA_WRITE_DONE_NOTIFICATION_TYPE, args: firstEvent.args },
      ]),
    });
    await first.done;

    expect(adapter.notifications).toHaveLength(1);
    expect(adapter.notifications[0]).toMatchObject({
      type: ERA_WRITE_DONE_NOTIFICATION_TYPE,
      args: [{ nested: [1, null, { ok: true }] }, undefined, callback],
    });
    expect(adapter.notifications[0]?.args[2]).toBe(callback);
    expect(host.diagnostics.snapshot()).toMatchObject({
      cachedWriteDone: true,
      hostRefs: 0,
    });

    const replayReceive = port.receive({ port: 'era.service.in' });
    const replay = assertAccepted(
      adapter.emit({
        type: 'replay-request',
        source: 'era-api',
        args: [],
        receipt: {
          settle: () => adapter.lifecycleOrder.push('settle:replay'),
        },
      }),
    );
    await replayReceive;
    port.send({
      port: 'era.service.out',
      value: ignoredBatch('batch:replay-writeDone', replay, [
        { type: ERA_INTERNAL_REPLAY_WRITE_DONE_NOTIFICATION_TYPE, args: [] },
      ]),
    });
    await replay.done;

    expect(adapter.notifications).toHaveLength(2);
    expect(adapter.notifications[1]).toEqual(adapter.notifications[0]);
    expect(adapter.notifications[1]?.type).toBe(ERA_WRITE_DONE_NOTIFICATION_TYPE);
    expect(adapter.notifications[1]?.args[2]).toBe(callback);
    expect(adapter.notifications.some(item => item.type === ERA_INTERNAL_REPLAY_WRITE_DONE_NOTIFICATION_TYPE)).toBe(
      false,
    );
    expect(adapter.lifecycleOrder.slice(-2)).toEqual(['settle:replay', `notify:${ERA_WRITE_DONE_NOTIFICATION_TYPE}`]);

    await host.stop();
    expect(host.diagnostics.snapshot()).toMatchObject({
      cachedWriteDone: false,
      hostRefs: 0,
      notifications: 0,
    });
  });

  it('容量失败发生在接纳前，不消耗 sequence', async () => {
    const { adapter, host } = createFixture(new FakeAdapter(), {
      max_fifo_events: 1,
    });
    host.start();
    const first = assertAccepted(adapter.emit({ type: 'first', source: 'ui', args: [] }));
    const rejected = adapter.emit({ type: 'overflow', source: 'ui', args: [] });
    expect(rejected).toMatchObject({
      accepted: false,
      code: 'ERA_HOST_FIFO_FULL',
    });
    expect(host.diagnostics.snapshot().nextSequence).toBe(2);

    await host.capabilities['vibeflow.port'].receive({ port: 'era.service.in' });
    const second = assertAccepted(adapter.emit({ type: 'second', source: 'ui', args: [] }));
    expect(second.sequence).toBe(2);

    host.capabilities['vibeflow.port'].send({
      port: 'era.service.out',
      value: {
        schemaVersion: 1,
        frameId: 'batch:capacity',
        kind: 'batch-result',
        throughSequence: 2,
        settlements: [
          {
            eventId: first.eventId,
            sequence: 1,
            status: 'ignored',
            reason: '容量测试',
          },
          {
            eventId: second.eventId,
            sequence: 2,
            status: 'ignored',
            reason: '容量测试',
          },
        ],
        notifications: [],
        diagnostics: [],
        fatal: false,
      },
    });
    await host.stop();
  });

  it('高水位 watchdog 只告警，结算后屏障才完成', async () => {
    const { adapter, host } = createFixture();
    host.start();
    const admission = assertAccepted(adapter.emit({ type: 'generation_started', source: 'tavern', args: [] }));
    let barrierSettled = false;
    const barrier = admission.waitThrough().then(result => {
      barrierSettled = true;
      return result;
    });

    adapter.clock.advance(5);
    expect(barrierSettled).toBe(false);
    expect(adapter.warnings.at(-1)?.message).toContain('不会自动放行');

    host.capabilities['vibeflow.port'].send({
      port: 'era.service.out',
      value: ignoredBatch('batch:barrier', admission),
    });
    await expect(barrier).resolves.toMatchObject({
      throughSequence: 1,
      hasFailures: false,
    });
    await host.stop();
  });

  it('绝对 dueAt 定时器产生固定 timer 事件，并拒绝伪 timer 事件', async () => {
    const { adapter, host } = createFixture();
    host.start();
    const badTimer = adapter.emit({
      type: 'wrong_timer',
      source: 'timer',
      args: [],
    });
    const badExternal = adapter.emit({
      type: 'era.service.collection_timer',
      source: 'ui',
      args: [],
    });
    expect(badTimer).toMatchObject({ accepted: false, code: 'ERA_HOST_EVENT_INVALID' });
    expect(badExternal).toMatchObject({ accepted: false, code: 'ERA_HOST_EVENT_INVALID' });

    host.capabilities['vibeflow.port'].send({
      port: 'era.service.out',
      value: {
        schemaVersion: 1,
        frameId: 'control:timer',
        kind: 'collection-control',
        commands: [{ kind: 'schedule', token: 'timer:1', dueAt: 1_010 }],
      },
    });
    expect(host.diagnostics.snapshot().timers).toBe(1);
    adapter.clock.advance(10);
    expect(host.diagnostics.snapshot().timers).toBe(0);

    const received = (await host.capabilities['vibeflow.port'].receive({ port: 'era.service.in' })).value;
    expect(received).toMatchObject({
      sequence: 1,
      source: 'timer',
      type: 'era.service.collection_timer',
      args: [{ kind: 'json', value: 'timer:1' }],
    });
    host.capabilities['vibeflow.port'].send({
      port: 'era.service.out',
      value: ignoredBatch('batch:timer', {
        eventId: received.eventId,
        sequence: received.sequence,
      }),
    });
    await host.stop();
  });

  it('stop 可终止不遵守 AbortSignal 的通知与挂起 Port', async () => {
    const { adapter, host } = createFixture();
    adapter.notificationImplementation = () => new Promise<void>(() => undefined);
    host.start();
    const pendingReceive = host.capabilities['vibeflow.port'].receive({
      port: 'era.service.in',
    });
    const admission = assertAccepted(adapter.emit({ type: 'api', source: 'era-api', args: [] }));
    await pendingReceive;
    host.capabilities['vibeflow.port'].send({
      port: 'era.service.out',
      value: ignoredBatch('batch:stubborn-notify', admission, [{ type: 'era:test', args: [] }]),
    });
    const secondReceive = host.capabilities['vibeflow.port'].receive({
      port: 'era.service.in',
    });
    expect(host.diagnostics.snapshot()).toMatchObject({
      notifications: 1,
      portWaiters: 1,
    });

    await host.stop();
    await expect(secondReceive).rejects.toBeDefined();
    expect(host.diagnostics.snapshot()).toMatchObject({
      queueEvents: 0,
      queueBytes: 0,
      pendingReceipts: 0,
      timers: 0,
      hostRefs: 0,
      notifications: 0,
      portWaiters: 0,
      processedFrames: 0,
    });
  });

  it('处理一万事件无丢失重复，幂等窗口保持有界', async () => {
    const { adapter, host } = createFixture();
    host.start();
    const port = host.capabilities['vibeflow.port'];

    for (let index = 1; index <= 10_000; index += 1) {
      const receive = port.receive({ port: 'era.service.in' });
      const admission = assertAccepted(adapter.emit({ type: 'stress', source: 'ui', args: [index] }));
      const event = (await receive).value;
      expect(event.sequence).toBe(index);
      port.send({
        port: 'era.service.out',
        value: ignoredBatch(`batch:stress:${index}`, admission),
      });
      await admission.done;
    }

    expect(host.diagnostics.snapshot()).toMatchObject({
      accepted: 10_000,
      settled: 10_000,
      queueEvents: 0,
      pendingReceipts: 0,
      hostRefs: 0,
      processedFrames: 4_096,
    });
    await host.stop();
  }, 30_000);
});
