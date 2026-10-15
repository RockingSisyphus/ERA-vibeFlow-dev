import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { fixture, deferred, realService } from './native-fixture.mjs';
const checks = [];

{
  const f = await fixture();
  assert.deepEqual((await f.caps['era.tavern.variables'].read({ scope: { type: 'chat' } })).variables, { value: 7 });
  assert.equal(f.caps['era.tavern.identity'].read({}).characterId, 'card');
  assert.ok([...f.handlers.values()].reduce((n, v) => n + v.size, 0) > 0);
  f.page.dispatchEvent(new Event('pagehide'));
  await f.work;
  assert.equal(
    [...f.handlers.values()].reduce((n, v) => n + v.size, 0),
    0,
  );
  assert.equal(f.disposed(), 1);
  assert.equal(f.client.enqueue('after-stop', 'ui').code, 'ERA_APP_SERVICE_UNAVAILABLE');
  assert.equal(
    f.direct({ action: 'admit', input: { type: 'after-stop', source: 'ui', args: [] } }).result.code,
    'ERA_HOST_NOT_STARTED',
  );
  f.page.dispatchEvent(new Event('pagehide'));
  assert.equal(f.disposed(), 1);
  checks.push('一次runEra启动主任务与资源；同步Capability保持即时返回；pagehide自动注销并清理一次');
}
{
  const f = await fixture(realService);
  assert.equal(f.caps['era.tavern.identity'].read({}).chatId, 'chat');
  const admission = f.client.enqueue('unknown-native-probe', 'era-api', []);
  assert.equal(admission.accepted, true);
  const outcome = await admission.done;
  assert.equal(outcome.eventId, admission.eventId);
  assert.equal(outcome.sequence, admission.sequence);
  assert.equal(outcome.status, 'ignored');
  assert.equal(outcome.reason, 'unknown-native-probe 没有对应的领域任务');
  f.page.dispatchEvent(new Event('pagehide'));
  await f.work;
  assert.equal(
    [...f.handlers.values()].reduce((n, v) => n + v.size, 0),
    0,
  );
  assert.equal(f.disposed(), 1);
  checks.push('真实主Service AOT通过Capability完成作用域决议和监听激活；卸载等待主Service与辅助资源实际结束');
}

{
  const f = await fixture(undefined, { config: { limits: { max_fifo_events: 2 } } });
  const a = f.client.enqueue('first', 'era-api', []),
    b = f.client.enqueue('second', 'era-api', []);
  assert.equal(a.sequence, 1);
  assert.equal(b.sequence, 2);
  assert.equal(f.client.enqueue('overflow', 'era-api').code, 'ERA_HOST_FIFO_FULL');
  const port = f.caps['vibeflow.port'];
  assert.equal((await port.receive({ port: 'era.service.in' })).value.eventId, a.eventId);
  assert.equal((await port.receive({ port: 'era.service.in' })).value.eventId, b.eventId);
  const ac = new AbortController(),
    pending = port.receive({ port: 'era.service.in' }, { signal: ac.signal });
  pending.catch(() => {});
  assert.equal(f.client.diagnostics().portWaiters, 1);
  await assert.rejects(
    port.receive({ port: 'era.service.in' }),
    e => e.cause?.code === 'ERA_HOST_PORT_CONCURRENT_RECEIVE',
  );
  ac.abort('one receive');
  await assert.rejects(pending);
  assert.equal(f.client.diagnostics().portWaiters, 0);
  f.page.dispatchEvent(new Event('pagehide'));
  await f.work;
  assert.equal((await a.done).status, 'cancelled');
  assert.equal((await b.done).status, 'cancelled');
  checks.push('三条实际生产入口保持同步容量边界、FIFO序号、并发receive拒绝和单次等待取消');
}
{
  const raw = deferred();
  let ended = false;
  const f = await fixture(undefined, {
    api: {
      getWorldbookNames: () => ['book'],
      getCharWorldbookNames: () => ({ primary: 'book' }),
      getWorldbook: async () => {
        const value = await raw.promise;
        ended = true;
        return value;
      },
    },
  });
  const read = f.caps['era.tavern.worldbook'].read({ name: 'book' });
  read.catch(() => {});
  let returned = false;
  f.work.then(() => {
    returned = true;
  });
  f.page.dispatchEvent(new Event('pagehide'));
  await assert.rejects(read);
  await delay(5);
  assert.equal(returned, false);
  assert.equal(ended, false);
  raw.resolve([]);
  await f.work;
  assert.equal(ended, true);
  assert.equal(f.disposed(), 1);
  checks.push('公开IO等待取消后，资源Node仍等待不响应取消的真实IO及编译后续体结束');
}
{
  const active = new Set(),
    created = deferred();
  const clock = {
    now: Date.now,
    setTimeout(fn, ms) {
      const h = setTimeout(() => {
        active.delete(h);
        fn();
      }, ms);
      active.add(h);
      created.resolve();
      return h;
    },
    clearTimeout(h) {
      clearTimeout(h);
      active.delete(h);
    },
  };
  const f = await fixture(undefined, { clock }),
    admission = f.caps['era.lifecycle.admission'];
  const input = {
    key: 'later',
    event: { type: 'delayed-probe', source: 'era-api', args: [] },
    delayMs: 100,
    maxDelayMs: 200,
  };
  assert.equal(admission.schedule(input).status, 'scheduled');
  await created.promise;
  assert.equal(active.size, 1);
  assert.equal(admission.cancel({ key: 'later' }).status, 'cancelled');
  await delay(0);
  assert.equal(active.size, 0);
  admission.schedule({ ...input, key: 'due', delayMs: 1, maxDelayMs: 10 });
  const event = (await f.caps['vibeflow.port'].receive({ port: 'era.service.in' })).value;
  assert.equal(event.type, 'delayed-probe');
  f.page.dispatchEvent(new Event('pagehide'));
  await f.work;
  assert.equal(active.size, 0);
  checks.push('真实Timeout属于受管等待Node；取消清除句柄、到期沿timer_fired真实准入、卸载无残留');
}
{
  const f = await fixture();
  let reentrant;
  const admission = f.direct({
    action: 'admit',
    input: {
      type: 'fatal-probe',
      source: 'era-api',
      receipt: {
        settle() {
          reentrant = f.client.enqueue('reentry', 'era-api');
        },
      },
    },
  }).result;
  const frame = {
    schemaVersion: 1,
    frameId: 'fatal-frame',
    kind: 'batch-result',
    throughSequence: admission.sequence,
    settlements: [
      {
        eventId: admission.eventId,
        sequence: admission.sequence,
        status: 'completed',
        taskId: 'probe',
        relation: 'primary',
      },
    ],
    notifications: [],
    diagnostics: [],
    fatal: true,
  };
  f.caps['vibeflow.port'].send({ port: 'era.service.out', value: frame });
  assert.equal((await admission.done).status, 'completed');
  assert.equal(reentrant.code, 'ERA_HOST_FATAL');
  assert.equal(f.session.fatalLatched, true);
  f.page.dispatchEvent(new Event('pagehide'));
  await f.work;
  checks.push('真实结果帧先标记致命转换再逐项结算，回执回调重入仍被拒绝');
}

{
  const entered = { first: deferred(), second: deferred() };
  let f;
  const api = {
    SillyTavern: {
      groupId: null,
      getCurrentChatId: () => 'chat',
      ToolManager: {
        invokeFunctionTool: async (name, args) => {
          entered[name].resolve();
          await f.client.forCall(args).commit({ name });
        },
      },
    },
  };
  f = await fixture(undefined, {
    api,
    createFunctionFacade: (transport, active) => ({
      commit(payload) {
        active();
        return transport('era:commit', payload);
      },
    }),
  });
  const fn = f.caps['era.tavern.functions'];
  const basis = { identity: { characterId: 'card', chatId: 'chat', groupId: null }, messages: [] };
  fn.begin({ id: 'first', name: 'first', args: {}, sourceBasis: basis });
  await entered.first.promise;
  const first = await fn.next({ id: 'first' });
  fn.begin({ id: 'second', name: 'second', args: {}, sourceBasis: basis });
  await entered.second.promise;
  const second = await fn.next({ id: 'second' });
  assert.equal(f.session.functionCalls.get('first').finished, false);
  assert.equal(f.session.functionCalls.get('second').finished, false);
  assert.equal(first.payload.name, 'first');
  assert.equal(second.payload.name, 'second');
  for (const id of ['first', 'second']) fn.acknowledge({ id, requestId: 1, settlement: { status: 'completed' } });
  assert.equal((await fn.next({ id: 'first' })).kind, 'done');
  assert.equal((await fn.next({ id: 'second' })).kind, 'done');
  f.page.dispatchEvent(new Event('pagehide'));
  await f.work;
  assert.equal(f.session.functionCalls.size, 0);
  assert.equal(f.session.backgroundWaiter, null);
  checks.push('保留原作者并发断言：两调用各等自身回执、互不阻塞、分别ack唤醒，卸载释放上下文');
}

{
  let launches = 0;
  const raw = deferred(),
    entered = deferred();
  const f = await fixture(undefined, {
    runtimeOptions: {
      trace: 'full',
      onTrace: event => {
        if (event.nodeId === 'launch') launches++;
      },
    },
    api: {
      SillyTavern: {
        groupId: null,
        getCurrentChatId: () => 'chat',
        ToolManager: {
          invokeFunctionTool: () => {
            entered.resolve();
            return raw.promise;
          },
        },
      },
    },
    createFunctionFacade: () => ({}),
  });
  f.caps['era.tavern.functions'].begin({
    id: 'uncancellable',
    name: 'tool',
    args: {},
    sourceBasis: { identity: { characterId: 'card', groupId: null, chatId: 'chat' }, messages: [] },
  });
  await entered.promise;
  let returned = false;
  f.work.then(() => {
    returned = true;
  });
  f.page.dispatchEvent(new Event('pagehide'));
  await delay(10);
  const before = launches;
  assert.ok(before > 0);
  await delay(20);
  assert.equal(launches, before, 'closing must wait existing tasks instead of launching empty inbox tasks');
  assert.equal(returned, false);
  raw.resolve('actual end');
  assert.deepEqual(await f.work, { status: 'stopped' });
  assert.equal(f.disposed(), 1);
  checks.push('关闭阶段等待不响应取消的作者任务，启动计数保持不变，无空收件忙转且最终只返回轻量结果');
}
{
  const cleanup = deferred();
  let entered = false,
    exited = false;
  const owner = await fixture(undefined, {
    onActivated: () => async () => {
      entered = true;
      await cleanup.promise;
    },
  });
  owner.work.then(() => {
    exited = true;
  });
  owner.page.dispatchEvent(new Event('pagehide'));
  await delay(0);
  assert.equal(entered, true);
  assert.equal(exited, false);
  assert.equal(owner.disposed(), 0);
  cleanup.resolve();
  await owner.work;
  assert.equal(owner.disposed(), 1);
  checks.push('资源Node等待异步展示释放器真正完成后再结束，不把已请求卸载当作释放完成');
}
console.log(JSON.stringify({ status: 'PASS', checks }));
