import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { fixture, deferred } from './native-fixture.mjs';
const checks = [];
function batch(owner, records, id, notifications = []) {
  owner.caps['vibeflow.port'].send({
    port: 'era.service.out',
    value: {
      schemaVersion: 1,
      frameId: id,
      kind: 'batch-result',
      throughSequence: Math.max(...records.map(r => r.sequence)),
      settlements: records.map(r => ({
        eventId: r.eventId,
        sequence: r.sequence,
        status: 'completed',
        taskId: 'probe',
        relation: 'primary',
      })),
      notifications,
      diagnostics: [],
      fatal: false,
    },
  });
}
{
  let requestBody;
  const a = await fixture(undefined, {
    extensionId: 'A',
    config: { limits: { max_fifo_events: 1 } },
    api: {
      location: { origin: 'http://tavern.test' },
      SillyTavern: { extensionSettings: {}, getRequestHeaders: () => ({}) },
      fetch: async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return { ok: true, json: async () => ({ data: [] }) };
      },
    },
  });
  const b = await fixture(undefined, { extensionId: 'B' }),
    port = a.caps['vibeflow.port'];
  const first = a.client.enqueue('core-probe', 'era-api', [() => 42, undefined, { hello: 1 }]);
  assert.equal(first.sequence, 1);
  assert.equal(a.session.refs.size, 1);
  const receiving = port.receive({ port: 'era.service.in' });
  assert.equal(a.session.queue.length, 0);
  const second = a.client.enqueue('same-stack', 'era-api', []);
  assert.equal(second.accepted, true, 'receive removes FIFO head before yielding');
  const event = (await receiving).value;
  assert.equal(event.args[0].kind, 'host-ref');
  assert.equal(a.session.refs.get(event.args[0].token)(), 42);
  assert.equal(event.args[1].kind, 'undefined');
  assert.deepEqual(event.args[2].value, { hello: 1 });
  assert.equal(b.session.refs.size, 0);
  assert.equal(b.client.enqueue('b', 'era-api').sequence, 1);
  const keyReference = event.args[0];
  await a.caps['era.tavern.agent'].list_connection_models_draft({ apiUrl: 'https://api.test', keyReference });
  assert.equal(requestBody.proxy_password, '42');
  await assert.rejects(
    b.caps['era.tavern.agent'].list_connection_models_draft({ apiUrl: 'https://api.test', keyReference }),
    e => e.cause?.code === 'ERA_HOST_REF_UNKNOWN',
  );
  batch(a, [first], 'refs-release');
  await first.done;
  assert.equal(a.session.refs.size, 0);
  await assert.rejects(
    a.caps['era.tavern.agent'].list_connection_models_draft({ apiUrl: 'https://api.test', keyReference }),
    e => e.cause?.code === 'ERA_HOST_REF_UNKNOWN',
  );
  assert.equal(
    a.direct({ action: 'admit', input: { type: 'bad', source: 'era-api', args: {} } }).result.code,
    'ERA_HOST_EVENT_INVALID',
  );
  a.page.dispatchEvent(new Event('pagehide'));
  b.page.dispatchEvent(new Event('pagehide'));
  await Promise.all([a.work, b.work]);
  assert.equal((await second.done).status, 'cancelled');
  checks.push('保留原FIFO同栈取出、函数/undefined/JSON编码及多实例断言；密钥引用仅当前实例有效，结算后失效');
}
{
  let stopped = false,
    nativeCalls = 0,
    auxiliaryCalls = 0;
  const f = await fixture(undefined, {
      api: {
        SillyTavern: {
          stopGeneration: () => {
            nativeCalls++;
            return stopped;
          },
        },
        stopAllGeneration: () => {
          auxiliaryCalls++;
          return true;
        },
      },
    }),
    cap = f.caps['era.tavern.agent'];
  assert.equal(cap.stop_native_generation({}).status, 'deferred');
  assert.equal(f.handlers.get('generation_after_commands').size, 1);
  const stale = [...f.handlers.get('generation_after_commands')][0];
  assert.equal(cap.stop_native_generation({}).status, 'deferred');
  assert.equal(f.handlers.get('generation_after_commands').size, 1);
  stale();
  assert.equal(nativeCalls, 2);
  stopped = true;
  await f.api.eventEmit('generation_after_commands');
  assert.equal(nativeCalls, 3);
  assert.equal(auxiliaryCalls, 2);
  assert.equal(f.handlers.get('generation_after_commands').size, 0);
  assert.equal(cap.stop_native_generation({}).status, 'stopped');
  assert.equal(f.session.nativeStopTicket, null);
  f.page.dispatchEvent(new Event('pagehide'));
  await f.work;
  checks.push('原生停止失败只保留一次受资源Node拥有的重试；替换票据失效，重试不再次停止辅助模型');
}
{
  let release;
  const field = { value: 'old' };
  const f = await fixture(undefined, {
    api: {
      SillyTavern: {
        characterId: 0,
        writeExtensionField: () =>
          new Promise(resolve => {
            release = resolve;
          }),
      },
      window: { top: { document: { querySelector: () => field } } },
    },
  });
  const ac = new AbortController(),
    work = f.caps['era.tavern.worldbook'].bind({ name: 'new' }, { signal: ac.signal });
  ac.abort('cancel');
  await assert.rejects(work);
  release();
  await delay(0);
  assert.equal(field.value, 'new', 'retain the confirmed old bind tail after raw write completion');
  f.page.dispatchEvent(new Event('pagehide'));
  await f.work;
  checks.push('保留旧Host实测的世界书绑定取消尾段：公开等待已取消，实际写入结束后仍完成原DOM确认');
}
{
  const warnings = [];
  const definitions = [
    {
      type: 'generation_started',
      listenerOrder: 'first',
      awaitMode: 'generation-barrier',
      closesCollectionWindow: true,
    },
  ];
  const f = await fixture(undefined, {
    config: { barrier_watchdog_ms: 5 },
    warn: (message, detail) => warnings.push({ message, detail }),
    eventDefinitions: definitions,
  });
  const prior = f.client.enqueue('prior', 'era-api');
  const started = [...f.handlers.get('generation_started')][0];
  const barrier = started('normal', {}, false);
  assert.equal(typeof barrier.then, 'function');
  let released = false;
  barrier.then(() => {
    released = true;
  });
  const generation = [...f.session.receipts.values()].find(r => r.event.type === 'generation_started').event;
  const late = f.client.enqueue('late', 'era-api');
  await delay(15);
  assert.equal(released, false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /不会自动放行/);
  await f.caps['vibeflow.port'].receive({ port: 'era.service.in' });
  await f.caps['vibeflow.port'].receive({ port: 'era.service.in' });
  batch(f, [prior, generation], 'barrier-high-water');
  await barrier;
  assert.equal(released, true);
  assert.equal(f.session.receipts.has(late.sequence), true);
  assert.equal(f.session.watchdogs.size, 0);
  f.page.dispatchEvent(new Event('pagehide'));
  await f.work;
  checks.push('生成回调返回真实高水位Promise；watchdog只告警，不超时放行；后来的请求不扩大覆盖范围');
}
console.log(JSON.stringify({ status: 'PASS', checks }));
