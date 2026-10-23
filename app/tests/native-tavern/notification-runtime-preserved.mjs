import { fixture, sync, asyncEntry } from './native-fixture.mjs';
import assert from 'node:assert/strict';
const cases = [],
  order = [],
  warnings = [],
  rawHandoffs = [];
let handler = () => undefined,
  s;
const defer = () => {
  let resolve;
  const promise = new Promise(r => {
    resolve = r;
  });
  return { promise, resolve };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
async function bounded(p, label) {
  let handle;
  try {
    return await Promise.race([
      p,
      new Promise((_, reject) => {
        handle = setTimeout(() => reject(new Error('native notification did not complete: ' + label)), 3000);
      }),
    ]);
  } finally {
    clearTimeout(handle);
  }
}
const nativeOwner = await fixture(undefined, {
  warn: (message, detail) => warnings.push({ message, detail }),
  api: { eventEmit: (type, ...args) => handler(type, args) },
});
s = nativeOwner.session;
const control = ({ request }) => sync({ request: { ...request, action: 'subscription_control' } });
const originalHandoff = s.dispatch.handoff;
s.dispatch.handoff = f => {
  const work = originalHandoff(f);
  rawHandoffs.push(work);
  return work;
};
const deliveries = [];
const subscribe = listener =>
  control({ request: { session: s, operation: 'register', input: { listener } } }).result.result;
const send = (notifications, signal) => {
  const receiving = nativeOwner.caps['vibeflow.port'].receive({ port: 'era.service.in' });
  deliveries.push(receiving);
  const admitted = nativeOwner.client.enqueue('notification-probe', 'era-api');
  const outputFrame = {
    schemaVersion: 1,
    frameId: 'probe:' + admitted.sequence,
    kind: 'batch-result',
    throughSequence: admitted.sequence,
    settlements: [
      {
        eventId: admitted.eventId,
        sequence: admitted.sequence,
        status: 'completed',
        taskId: 'probe',
        relation: 'primary',
      },
    ],
    notifications: notifications.map(n => ({ ...n, args: n.args.map(value => ({ kind: 'json', value })) })),
    diagnostics: [],
    fatal: false,
  };
  nativeOwner.caps['vibeflow.port'].send({ port: 'era.service.out', value: outputFrame }, { signal });
  return { result: null };
};
const running = nativeOwner.work;
const slow = defer(),
  fast = defer();
handler = type => {
  order.push(type);
  return type === 'slow' ? slow.promise : fast.promise;
};
assert.equal(
  send([
    { type: 'slow', args: [] },
    { type: 'fast', args: [] },
  ]).result,
  null,
);
assert.deepEqual(order, ['slow', 'fast']);
assert.equal(s.activeNotifications.size, 1);
cases.push('synchronous notification start preserves same-stack callback order and group count');
const group = [...s.activeNotifications][0];
fast.resolve();
await tick();
assert.equal(s.activeNotifications.size, 1);
slow.resolve();
await bounded(group, 'ordinary group');
assert.equal(s.activeNotifications.size, 0);
cases.push('instance-owned waits do not finish group before every callback');
handler = type => {
  if (type === 'bad1') throw new Error('first');
  return Promise.reject(new Error('second'));
};
send([
  { type: 'bad1', args: [] },
  { type: 'bad2', args: [] },
]);
await bounded([...s.activeNotifications][0], 'failed group');
assert.deepEqual(
  warnings.map(x => x.detail.error),
  ['first', 'second'],
);
cases.push('startup exceptions and async failures reported once in original order');
const callbacks = defer();
subscribe(() => callbacks.promise);
const original = defer();
s.handoffs.set('stage', { ...original });
const executionSignal = new AbortController();
handler = () => undefined;
send(
  [
    {
      type: 'era.agent.stage_completed',
      args: [{ completionId: 'stage', executionId: 'execution', stage: 'planning', result: { plan: {} } }],
    },
  ],
  executionSignal.signal,
);
await tick();
assert.equal(s.subscriptionCycles.size, 1);
assert.equal(s.queue.length, 0);
executionSignal.abort(new Error('sending node exited'));
await tick();
assert.equal(s.activeNotifications.size, 1, 'accepted notification outlives sending node');
assert.equal(s.handoffs.has('stage'), true);
cases.push('sending-node cancellation does not cancel instance-owned notification');
callbacks.resolve();
while (!s.queue.length) await tick();
const event = (await nativeOwner.caps['vibeflow.port'].receive({ port: 'era.service.in' })).value;
assert.equal(event.type, 'era.agent.stage_continue');
nativeOwner.caps['vibeflow.port'].send({
  port: 'era.service.out',
  value: {
    schemaVersion: 1,
    frameId: 'continue:' + event.sequence,
    kind: 'batch-result',
    throughSequence: event.sequence,
    settlements: [
      {
        eventId: event.eventId,
        sequence: event.sequence,
        status: 'completed',
        taskId: 'probe',
        relation: 'primary',
        value: { final: true },
      },
    ],
    notifications: [],
    diagnostics: [],
    fatal: false,
  },
});
await bounded([...s.activeNotifications][0], 'successful handoff group');
assert.equal((await original.promise).value.final, true);
cases.push('native handoff admits original continuation and resolves final result through real queue');
const cancelledCallbacks = defer();
subscribe(() => cancelledCallbacks.promise);
const cancelledStage = defer();
s.handoffs.set('cancelled', { ...cancelledStage });
send([
  {
    type: 'era.agent.stage_completed',
    args: [{ completionId: 'cancelled', executionId: 'execution', stage: 'planning', result: { plan: {} } }],
  },
]);
await tick();
assert.equal(s.subscriptionCycles.size, 1);
let stopped = false;
running.then(() => {
  stopped = true;
});
nativeOwner.page.dispatchEvent(new Event('pagehide'));
await tick();
assert.equal(stopped, false, 'runtime must wait for actual subscriber completion');
cancelledCallbacks.resolve();
await bounded(Promise.all(rawHandoffs), 'raw cancelled handoff');
assert.equal(await cancelledStage.promise, null);
assert.equal(s.queue.length, 0, 'stopped subscription must not admit a continuation');
assert.equal(s.subscriptionCycles.size, 0);
cases.push('instance stop cancels handoff, waits raw subscriber and does not admit continuation');
await bounded(running, 'runtime stop');
assert.equal(s.resources, undefined);
assert.equal(s.activeNotifications.size, 0);
cases.push('full native runtime stops with no pending notification resources');
await Promise.all(deliveries);
const report = {
  status: 'PASS',
  evidence:
    'actual compiled sync notification prefix, async subscription/handoff and full native runtime; this probe does not validate production App',
  cases,
};
console.log(JSON.stringify(report));
