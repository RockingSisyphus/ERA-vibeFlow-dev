import { fixture, asyncEntry } from './native-fixture.mjs';
import assert from 'node:assert/strict';
const cases = [],
  nativeOwner = await fixture(),
  session = nativeOwner.session;
const receipt = ({ request }) =>
  asyncEntry({ request: { ...request, action: 'generation_receipt' } }, { entry: 'operation' });
const original = { eventId: 'original', sequence: 7, status: 'completed', value: { completionId: 'phase' } };
const run = (result, owner = session) =>
  receipt({ request: { session: owner, originalReceipt: Promise.resolve(result) } }).then(x => x.result.result);
const normal = { eventId: 'ordinary', sequence: 1, status: 'failed', reason: 'failure' };
assert.deepEqual(await run(normal), normal);
cases.push('ordinary receipt is unchanged');
let resolve;
session.handoffs.set('phase', {
  promise: new Promise(done => {
    resolve = done;
  }),
  resolve: value => resolve(value),
});
let finished = false;
const pending = run(original).then(value => {
  finished = true;
  return value;
});
await new Promise(done => setImmediate(done));
assert.equal(finished, false);
cases.push('retry public receipt waits beyond original fragment');
const final = { eventId: 'later', sequence: 12, status: 'completed', value: { story: 'final' } };
resolve(final);
assert.deepEqual(await pending, { ...final, eventId: 'original', sequence: 7 });
cases.push('final settlement preserves original admitted event identity');
assert.deepEqual(await run(original, { handoffs: new Map() }), {
  ...original,
  status: 'cancelled',
  reason: '生成会话已取消',
});
cases.push('missing handoff preserves original cancellation result');
session.handoffs.set('phase', { promise: Promise.resolve(null), resolve: () => {} });
assert.deepEqual(await run(original), { ...original, status: 'cancelled', reason: '生成会话已取消' });
cases.push('cancelled handoff never becomes success');
nativeOwner.page.dispatchEvent(new Event('pagehide'));
await nativeOwner.work;
const report = {
  status: 'PASS',
  evidence:
    'compiled native receipt workflow with captured original receipt and handoff resources; full production App acceptance is separate',
  cases,
};
console.log(JSON.stringify(report));
