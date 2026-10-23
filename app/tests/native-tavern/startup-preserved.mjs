import assert from 'node:assert/strict';
import { fixture, asyncEntry, realService } from './native-fixture.mjs';
const cases = [];
const a = await fixture(undefined, { manualStartup: true, config: { staged_startup: true } }),
  b = await fixture(undefined, { manualStartup: true, config: { staged_startup: true } });
assert.equal(
  [...a.handlers.values()].reduce((n, v) => n + v.size, 0),
  0,
);
assert.equal(
  [...b.handlers.values()].reduce((n, v) => n + v.size, 0),
  0,
);
cases.push('staged初始化不登记Tavern监听');
const wait = owner =>
  asyncEntry({ request: { session: owner.session, action: 'wait_startup' } }, { entry: 'operation' }).then(
    r => r.result.result,
  );
let settled = false;
const pending = wait(a).then(x => {
  settled = true;
  return x;
});
await new Promise(resolve => setImmediate(resolve));
assert.equal(settled, false);
cases.push('原生异步入口在安装决定前真实挂起');
const decision = { route: 'allow', reason: 'scope' };
assert.deepEqual(a.caps['era.tavern.startup_gate'].activate(decision), { activated: true });
const count = [...a.handlers.values()].reduce((n, v) => n + v.size, 0);
assert.ok(count > 0);
assert.deepEqual(await pending, decision);
assert.ok(Object.isFrozen(await pending));
cases.push('allow只激活本实例，等待返回冻结的原决定');
a.caps['era.tavern.startup_gate'].activate({ route: 'allow', reason: 'later' });
assert.equal(
  [...a.handlers.values()].reduce((n, v) => n + v.size, 0),
  count,
);
assert.deepEqual(await wait(a), decision);
cases.push('重复allow不重新登记或覆盖首次决定');
assert.deepEqual(b.caps['era.tavern.startup_gate'].dormant({ route: 'dormant', reason: 'outside' }), {
  activated: false,
});
assert.equal(
  [...b.handlers.values()].reduce((n, v) => n + v.size, 0),
  0,
);
assert.deepEqual(await wait(b), { route: 'dormant', reason: 'outside' });
cases.push('休眠只影响本实例且无Tavern监听');
const stopped = await fixture(undefined, { manualStartup: true });
const cancelled = wait(stopped);
cancelled.catch(() => {});
stopped.session.stopping = true;
stopped.session.started = false;
stopped.session.lifecycle.abort(new Error('stopped during startup'));
await assert.rejects(cancelled, e => e.cause?.message === 'stopped during startup');
assert.throws(() => stopped.caps['era.tavern.startup_gate'].activate({ route: 'allow' }));
await stopped.work;
cases.push('初始化中停止唤醒等待，迟到决议不能重挂载');
const dormant = await fixture(realService, {
  readyOnEntry: true,
  api: { getScriptTrees: ({ type }) => (type === 'global' ? [{ type: 'script', enabled: true, id: 'script' }] : []) },
});
await dormant.work;
assert.equal(
  [...dormant.handlers.values()].reduce((n, v) => n + v.size, 0),
  0,
);
assert.equal(dormant.disposed(), 1);
cases.push('真实主Service识别全局误装后自行结束，无脚本start/stop管理层');
for (const owner of [a, b]) {
  owner.page.dispatchEvent(new Event('pagehide'));
  await owner.work;
}
console.log(JSON.stringify({ status: 'PASS', cases }));
