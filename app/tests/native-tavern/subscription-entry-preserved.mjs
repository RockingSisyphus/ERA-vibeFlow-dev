import { fixture, sync, asyncEntry } from './native-fixture.mjs';
import assert from 'node:assert/strict';
const cases = [],
  errors = [],
  rawReleases = [];
const owners = [];
async function session() {
  const owner = await fixture(undefined, {
    log: { error: (...args) => errors.push(args) },
    api: { toastr: { error: () => {} } },
  });
  owners.push(owner);
  return owner.session;
}
const s = await session(),
  s2 = await session();
const control = ({ request }) => sync({ request: { ...request, action: 'subscription_control' } });
const publish = ({ request }) =>
  asyncEntry({ request: { ...request, action: 'subscription_publish' } }, { entry: 'operation' });
const register = (listener, options = {}, owner = s) =>
  control({ request: { session: owner, operation: 'register', input: { listener, options } } }).result.result;
// 夹具只提供同步捕获的资源，实际逐项调度调用生产Nodeset与原生Loop。
const capture = (owner, stage = 'planning') => {
  const cycle = {
    owner,
    controller: new AbortController(),
    items: [...owner.subscriptions],
    completion: { stage, result: { plan: { hp: 1 } }, completionId: 'c' },
  };
  owner.subscriptionCycles.add(cycle);
  return cycle;
};
const run = cycle =>
  publish({ request: { session: cycle.owner, subscriptionCycle: cycle } }).then(x => x.result.result);
const tick = () => new Promise(resolve => setImmediate(resolve));
assert.throws(
  () => register(null),
  e => e.cause instanceof TypeError,
);
assert.throws(
  () => register(() => {}, { stages: ['unknown'] }),
  e => e.cause instanceof TypeError,
);
cases.push('listener and stage contracts retain original rejection');
const order = [];
let release;
const first = register(async event => {
  order.push(1);
  assert.ok(Object.isFrozen(event.result.plan));
  await new Promise(resolve => {
    release = resolve;
  });
  order.push(2);
});
const second = register(() => order.push(3));
const filtered = register(() => order.push(99), { stages: ['story'] });
const cycle = capture(s),
  waiting = run(cycle);
await tick();
assert.deepEqual(order, [1]);
release();
assert.equal(await waiting, true);
assert.deepEqual(order, [1, 2, 3]);
cases.push('native Loop waits sequentially and filters stages');
assert.equal(s.subscriptionCycles.size, 0);
cases.push('successful cycle releases instance resource');
first();
second();
filtered();
register(() => {
  throw null;
});
register(() => order.push(4));
assert.equal(await run(capture(s)), true);
assert.equal(errors.length, 1);
assert.equal(order.at(-1), 4);
cases.push('callback error including null is reported and later listener runs');
s.subscriptions.clear();
let entered;
const enteredWait = new Promise(resolve => {
  entered = resolve;
});
const ordinary = register(() => {
  entered();
  return new Promise(resolve => rawReleases.push(resolve));
});
register(() => order.push(5));
const ordinaryWait = run(capture(s));
await enteredWait;
ordinary();
assert.equal(await ordinaryWait, true);
assert.equal(order.at(-1), 5);
cases.push('ordinary unsubscribe wakes current callback without cancelling generation');
s.subscriptions.clear();
let mark;
const started = new Promise(resolve => {
  mark = resolve;
});
const stop = register(() => {
  mark();
  return new Promise(resolve => rawReleases.push(resolve));
});
register(() => order.push(6));
const cancelWait = run(capture(s));
await started;
stop.cancelPending();
assert.equal(await cancelWait, false);
assert.notEqual(order.at(-1), 6);
cases.push('cancelPending cancels current cycle and skips later listeners');
control({ request: { session: s, operation: 'cancel', input: { clear: false } } });
assert.equal(s.subscriptions.size, 1);
cases.push('navigation cancellation preserves registered listeners');
register(() => {}, {}, s2);
control({ request: { session: s, operation: 'cancel', input: { clear: true } } });
assert.equal(s.subscriptions.size, 0);
assert.equal(s2.subscriptions.size, 1);
cases.push('stop clears only current instance subscriptions');
assert.equal(s.subscriptionCycles.size, 0);
assert.equal([...s2.subscriptions][0].waiting.size, 0);
cases.push('callback wait handles released on all tested terminal paths');
for (const release of rawReleases) release();
for (const owner of owners) {
  owner.page.dispatchEvent(new Event('pagehide'));
  await owner.work;
}
const report = {
  status: 'PASS',
  evidence:
    'compiled Browser AOT control and subscription publishing Loop with captured resource fixtures; full production App acceptance is separate',
  cases,
};
console.log(JSON.stringify(report));
