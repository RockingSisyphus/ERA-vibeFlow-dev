import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../native-tavern/native-fixture.mjs';
import type { EraAdmissionResult, EraInboundEvent, EraPreparedNotification } from '../../src/ERA变量框架/service/types';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const owners: any[] = [];
afterEach(async () => {
  for (const owner of owners.splice(0)) {
    owner.page.dispatchEvent(new Event('pagehide'));
    await finishOwner(owner);
  }
});
class FakeClock {
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

/** 只记录原测试的外部事实，不实现队列或生命周期。 */
class FakeAdapter {
  readonly clock = new FakeClock();
  readonly warnings: Array<{ message: string; details?: Readonly<Record<string, unknown>> }> = [];
  readonly notifications: EraPreparedNotification[] = [];
  readonly lifecycleOrder: string[] = [];
  sidecarPromptClearCount = 0;
  variables = { read: (_input: any): any => [] };
  notificationImplementation: (notification: EraPreparedNotification, signal: AbortSignal) => void | Promise<void> =
    () => {};
  emit: (event: EraInboundEvent & { receipt?: { settle: (outcome: any) => unknown } }) => EraAdmissionResult = () => {
    throw Error('fixture not connected');
  };
}
/** 测试调用点的错误视图：断言领域错误；单独原生入口探针验证VF包装。 */
function domainError(error: any): any {
  while (typeof error?.code === 'string' && error.code.startsWith('VF_') && error.cause) error = error.cause;
  return error;
}
/** 注入fatal批次会令原生运行入口以该领域错误结束，必须核对原因，不能吞掉其他错误。 */
async function finishOwner(owner: any) {
  if (owner.expectedFailure) {
    await expect(owner.work.catch((error: any) => Promise.reject(domainError(error)))).rejects.toMatchObject({
      code: owner.expectedFailure,
    });
  } else await owner.work;
}
async function createFixture(adapter = new FakeAdapter(), limits: Record<string, number> = {}, manualStartup = false) {
  let owner: any;
  owner = await fixture(undefined, {
    manualStartup,
    extensionId: 'era.tavern.service_host',
    clock: adapter.clock,
    config: { limits, barrier_watchdog_ms: 5 },
    warn: (message: string, details: any) => adapter.warnings.push({ message, details }),
    api: {
      getWorldbookNames: () => ['fatal-race'],
      getCharWorldbookNames: () => ({ primary: null, additional: [] }),
      getWorldbook: () => adapter.variables.read({}),
      eventEmit: (type: string, ...args: unknown[]) => {
        const notification = { type, args };
        adapter.notifications.push(notification);
        adapter.lifecycleOrder.push(`notify:${type}`);
        return adapter.notificationImplementation(notification, owner.session.lifecycle.signal);
      },
    },
  });
  owners.push(owner);
  owner.page.addEventListener('era-sidecar-binding-prompt', () => adapter.sidecarPromptClearCount++);
  adapter.emit = event => owner.direct({ action: 'admit', input: event }).result;
  const capabilities = Object.fromEntries(
    Object.entries(owner.caps).map(([id, operations]) => [
      id,
      Object.fromEntries(
        Object.entries(operations as object).map(([operation, call]: [string, any]) => [
          operation,
          (...args: any[]) => {
            try {
              const value = call(...args);
              return value?.then
                ? value.catch((error: any) => {
                    throw domainError(error);
                  })
                : value;
            } catch (error) {
              throw domainError(error);
            }
          },
        ]),
      ),
    ]),
  );
  const close = async (_reason?: string) => {
    owner.page.dispatchEvent(new Event('pagehide'));
    await finishOwner(owner);
  };
  return {
    adapter,
    owner,
    host: {
      capabilities,
      // 只验证实际回信处理图的同步业务合同；Service邮箱行为由receive/send及原生探针另外验证。
      applyFrame: (frame: any) => {
        try {
          return owner.session.dispatch.sync({
            session: owner.session,
            action: 'send',
            origin: 'service',
            input: { port: 'era.service.out', value: frame },
          }).result;
        } catch (error) {
          throw domainError(error);
        }
      },
      stop: close,
      diagnostics: { snapshot: () => owner.direct({ action: 'diagnostics' }).result },
    },
    listenerCount: () => [...owner.handlers.values()].reduce((n: number, handlers: any) => n + handlers.size, 0),
  };
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

describe('ERA 原生辅助workflow核心', () => {
  it('单次入口按安装决议激活一次，重复卸载只清理一次', async () => {
    const { owner, host, listenerCount, adapter } = await createFixture(new FakeAdapter(), {}, true);
    expect(listenerCount()).toBe(0);
    expect(host.diagnostics.snapshot()).toMatchObject({
      started: true,
      accepted: 0,
      pendingReceipts: 0,
      timers: 0,
      hostRefs: 0,
      notifications: 0,
      portWaiters: 0,
    });
    const gate = host.capabilities['era.tavern.startup_gate'];
    gate.activate({ route: 'allow' });
    const count = listenerCount();
    expect(count).toBe(4);
    gate.activate({ route: 'allow' });
    expect(listenerCount()).toBe(count);
    owner.page.dispatchEvent(new Event('pagehide'));
    await finishOwner(owner);
    await host.stop();
    expect(listenerCount()).toBe(0);
    expect(adapter.sidecarPromptClearCount).toBe(1);
  });
  it('安装位置决议前无监听，dormant不登记，allow登记', async () => {
    const dormant = await createFixture(new FakeAdapter(), {}, true);
    expect(dormant.listenerCount()).toBe(0);
    expect(
      dormant.host.capabilities['era.tavern.startup_gate'].dormant({ route: 'dormant', classification: 'global' }),
    ).toEqual({ activated: false });
    expect(dormant.listenerCount()).toBe(0);
    await dormant.host.stop();
    const allowed = await createFixture(new FakeAdapter(), {}, true);
    expect(
      allowed.host.capabilities['era.tavern.startup_gate'].activate({ route: 'allow', classification: 'character' }),
    ).toEqual({ activated: true });
    expect(allowed.listenerCount()).toBe(4);
    await allowed.host.stop();
    expect(allowed.listenerCount()).toBe(0);
  });

  it('无损编码 tagged args，并严格保持结算先于通知启动', async () => {
    const { adapter, host } = await createFixture();
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
    const { adapter, host } = await createFixture();
    const admission = assertAccepted(adapter.emit({ type: 'manual_sync', source: 'ui', args: [] }));
    const frame = ignoredBatch('batch:idempotent', admission, [{ type: 'era:test', args: [] }]);

    host.capabilities['vibeflow.port'].send({ port: 'era.service.out', value: frame });
    await expect(admission.done).resolves.toMatchObject({ status: 'ignored' });
    expect(() => host.applyFrame(frame)).not.toThrow();
    await vi.waitFor(() => expect(adapter.notifications).toHaveLength(1));

    expect(() => host.applyFrame({ ...frame, fatal: true })).toThrowError(
      expect.objectContaining({
        code: 'ERA_HOST_FRAME_CONFLICT',
      }),
    );

    await host.stop();
  });

  it('致命批次先结算再锁存，阻止回执重入、挂起 Port 与 Capability 继续', async () => {
    const { adapter, host, owner } = await createFixture();
    owner.expectedFailure = 'ERA_HOST_FATAL';
    let finishRaw!: () => void;
    adapter.variables.read = () =>
      new Promise<void>(resolve => {
        finishRaw = resolve;
      });
    const port = host.capabilities['vibeflow.port'];
    const pendingCapability = host.capabilities['era.tavern.worldbook'].read({
      name: 'fatal-race',
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
      code: 'VF_INSTANCE_ENDED',
    });
    const frame = fatalBatch('batch:fatal', admission, [{ type: 'era:test', args: [] }]);

    try {
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
      await expect(port.receive({ port: 'era.service.in' })).rejects.toMatchObject({ code: 'VF_INSTANCE_ENDED' });
      expect(() => host.capabilities['era.tavern.identity'].read({})).toThrowError(
        expect.objectContaining({ code: 'ERA_HOST_NOT_STARTED' }),
      );
      const lateFrame = {
        schemaVersion: 1,
        frameId: 'control:after-fatal',
        kind: 'collection-control',
        commands: [],
      };
      // Send仅将消息交到尚在清理的运行邮箱；业务处理图仍拒绝新帧。
      port.send({ port: 'era.service.out', value: lateFrame });
      expect(() => host.applyFrame(lateFrame)).toThrowError(expect.objectContaining({ code: 'ERA_HOST_NOT_STARTED' }));
      await tick();
      expect(host.diagnostics.snapshot()).toMatchObject({ timers: 0, processedFrames: 1 });

      // 已终结的Service不能继续发信；实际处理图仍将已成功的同一帧识别为no-op。
      expect(() => host.applyFrame(frame)).not.toThrow();
      expect(adapter.notifications).toHaveLength(1);
      expect(host.diagnostics.snapshot()).toMatchObject({
        fatal: true,
        pendingReceipts: 0,
        portWaiters: 0,
      });
    } finally {
      finishRaw();
    }
    await host.stop();
    expect(host.diagnostics.snapshot()).toMatchObject({
      fatal: false,
      queueEvents: 0,
      pendingReceipts: 0,
      timers: 0,
      hostRefs: 0,
      notifications: 0,
      portWaiters: 0,
      processedFrames: 0,
    });
  });

  it('容量失败发生在接纳前，不消耗 sequence', async () => {
    const { adapter, host } = await createFixture(new FakeAdapter(), {
      max_fifo_events: 1,
    });
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
    await Promise.all([first.done, second.done]);
    await host.stop();
  });

  it('高水位 watchdog 只告警，结算后屏障才完成', async () => {
    const { adapter, host } = await createFixture();
    const admission = assertAccepted(adapter.emit({ type: 'generation_started', source: 'tavern', args: [] }));
    let barrierSettled = false;
    const barrier = admission.waitThrough().then(result => {
      barrierSettled = true;
      return result;
    });

    await tick();
    adapter.clock.advance(5);
    await tick();
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

  it('屏障告警后 stop 取消原回执并清理 watchdog，不留下永久等待', async () => {
    const { adapter, host } = await createFixture();
    const admission = assertAccepted(adapter.emit({ type: 'generation_started', source: 'tavern', args: [] }));
    const barrier = admission.waitThrough();
    await tick();
    adapter.clock.advance(5);
    await tick();
    const warningsBeforeStop = adapter.warnings.length;
    expect(adapter.warnings.at(-1)?.details).toMatchObject({ throughSequence: 1, pendingSequences: [1] });
    await host.stop('explicit lifecycle stop');
    await expect(admission.done).resolves.toMatchObject({ sequence: 1, status: 'cancelled' });
    await expect(barrier).resolves.toMatchObject({ throughSequence: 1, hasFailures: true });
    await tick();
    adapter.clock.advance(100);
    await tick();
    expect(adapter.warnings).toHaveLength(warningsBeforeStop);
  });

  it('stop 在告警之前清理定时器并结算全部原回执', async () => {
    const { adapter, host } = await createFixture();
    const first = assertAccepted(adapter.emit({ type: 'generation_started', source: 'tavern', args: [] }));
    const second = assertAccepted(adapter.emit({ type: 'message_received', source: 'tavern', args: [] }));
    const barrier = second.waitThrough();
    await host.stop('explicit lifecycle stop');
    await expect(first.done).resolves.toMatchObject({ sequence: 1, status: 'cancelled' });
    await expect(second.done).resolves.toMatchObject({ sequence: 2, status: 'cancelled' });
    await expect(barrier).resolves.toMatchObject({ throughSequence: 2, hasFailures: true });
    await tick();
    adapter.clock.advance(100);
    await tick();
    expect(adapter.warnings.some(item => item.message.includes('高水位屏障'))).toBe(false);
  });

  it('绝对 dueAt 定时器产生固定 timer 事件，并拒绝伪 timer 事件', async () => {
    const { adapter, host } = await createFixture();
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
    await vi.waitFor(() => expect(host.diagnostics.snapshot().timers).toBe(1));
    await tick();
    adapter.clock.advance(10);
    await tick();
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
    await vi.waitFor(() => expect(host.diagnostics.snapshot().pendingReceipts).toBe(0));
    await host.stop();
  });

  it('卸载取消公开等待，并等不遵守AbortSignal的通知真实结束', async () => {
    const { adapter, host } = await createFixture();
    let finishNotification!: () => void;
    adapter.notificationImplementation = () =>
      new Promise<void>(resolve => {
        finishNotification = resolve;
      });
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
    await expect(admission.done).resolves.toMatchObject({ status: 'ignored' });
    await vi.waitFor(() =>
      expect(host.diagnostics.snapshot()).toMatchObject({
        notifications: 1,
        portWaiters: 1,
      }),
    );

    const rejectedReceive = expect(secondReceive).rejects.toBeDefined();
    let exited = false;
    const closing = host.stop().then(() => {
      exited = true;
    });
    await rejectedReceive;
    await tick();
    expect(exited).toBe(false);
    finishNotification();
    await closing;
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
    const { adapter, host } = await createFixture();
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

it('工作流延迟准入可防抖，连续请求不超过最长等待，停止时清理', async () => {
  const { adapter, host } = await createFixture();
  const scheduler = host.capabilities['era.lifecycle.admission'];
  const request = {
    key: 'save',
    delayMs: 200,
    maxDelayMs: 2000,
    event: { type: 'era.facade.sync', source: 'era-api', args: [{ mode: 'auto' }] },
  };
  for (let i = 0; i < 20; i++) {
    const result = scheduler.schedule(request);
    expect(result.dueAt).toBeLessThanOrEqual(3000);
    await tick();
    adapter.clock.advance(100);
    await tick();
  }
  expect(host.diagnostics.snapshot().accepted).toBe(1);
  const received = (await host.capabilities['vibeflow.port'].receive({ port: 'era.service.in' })).value;
  expect(received).toMatchObject({ source: 'era-api', type: 'era.facade.sync' });
  scheduler.schedule(request);
  scheduler.cancel({ key: 'save' });
  await tick();
  adapter.clock.advance(300);
  await tick();
  expect(host.diagnostics.snapshot().accepted).toBe(1);
  scheduler.schedule(request);
  await host.stop();
  await tick();
  adapter.clock.advance(300);
  await tick();
  expect(host.diagnostics.snapshot().timers).toBe(0);
});
