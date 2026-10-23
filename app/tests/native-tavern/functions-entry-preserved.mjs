import { fixture, sync as start } from './native-fixture.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const cases = [];
let tool = () => undefined,
  parameters,
  body = 'original',
  markEntered;
const entered = new Promise(resolve => {
  markEntered = resolve;
});
const basis = () => ({
  identity: { characterId: 'card', chatId: 'chat', groupId: null },
  messages: [{ messageId: 0, swipeIndex: 0, activeText: body, role: 'assistant' }],
});
const api = {
  SillyTavern: {
    groupId: null,
    getCurrentChatId: () => 'chat',
    ToolManager: {
      invokeFunctionTool: (name, args) => {
        parameters = args;
        markEntered();
        return tool(args);
      },
    },
  },
  getCurrentCharacterId: () => 'card',
  getChatMessages: () => [{ message_id: 0, role: 'assistant', message: body, swipe_id: 0, swipes: [body] }],
};
const owners = [],
  watchers = new Set();
async function session() {
  const owner = await fixture(undefined, {
    api,
    runtimeOptions: {
      trace: 'full',
      onTrace: () => {
        for (const w of [...watchers])
          if (w.ready()) {
            watchers.delete(w);
            w.resolve();
          }
      },
    },
    createFunctionFacade: (transport, active) =>
      Object.freeze({
        get() {
          active();
          return { value: 1 };
        },
        commit(payload) {
          active();
          return transport('era:commit', payload);
        },
      }),
  });
  owners.push(owner);
  return owner.session;
}
const s = await session(),
  s2 = await session();
const capture = (op, input, options = {}, owner = s) =>
  start({ request: { session: owner, action: 'capability', family: 'functions', operation: op, input, options } })
    .result;
const immediate = (op, input, options, owner) => capture(op, input, options, owner).result;
const context = (args, owner = s) =>
  start({ request: { session: owner, action: 'function_submit', input: { mode: 'context', parameters: args } } }).result
    .result;
const next = async (id, owner = s, options = {}) => capture('next', { id }, options, owner).publicPromise;
const begin = (id, args = {}, options = {}, owner = s) =>
  immediate('begin', { id, name: 'test', args, sourceBasis: basis() }, options, owner);
const execute = (owner = s) => {
  const call = [...owner.functionCalls.values()].find(call => !call.finished);
  if (!call) return Promise.resolve();
  return new Promise(resolve => {
    watchers.add({ ready: () => call.finished, resolve });
  });
};
const expired = e => e?.cause?.message === 'ERA_FUNCTION_CONTEXT_EXPIRED';
assert.equal(begin('a', { value: 2 }).status, 'started');
assert.equal(parameters, undefined);
cases.push('begin binds synchronously but tool runs later');
let received;
tool = async args => {
  received = context(args);
  await received.commit({ hp: 2 });
};
const running = execute();
await entered;
assert.deepEqual(parameters, { value: 2 });
assert.equal(Object.getOwnPropertySymbols(parameters).length, 0);
cases.push('original cloned parameters without injected fields');
assert.throws(() => context(parameters, s2), expired);
assert.throws(() => context({ value: 2 }), expired);
cases.push('parameter identity and instance isolation');
const request = await next('a');
assert.deepEqual(request, { kind: 'request', id: 1, type: 'era:commit', payload: { hp: 2 } });
cases.push('same-call FIFO request capture');
const done = next('a');
immediate('acknowledge', { id: 'a', requestId: 1, settlement: { status: 'completed' } });
await running;
assert.deepEqual(await done, { kind: 'done', error: null });
cases.push('await commit completes through acknowledge and wake');
assert.throws(
  () => immediate('acknowledge', { id: 'a', requestId: 1, settlement: {} }),
  e => e.cause?.message === 'ERA_FUNCTION_REQUEST_MISSING',
);
assert.throws(
  () => begin('a'),
  e => e.cause?.message === 'ERA_FUNCTION_CONTEXT_EXISTS',
);
cases.push('duplicate call and missing acknowledgement keep legacy errors');
immediate('release', { id: 'a' });
assert.throws(() => received.get(), expired);
assert.equal(immediate('release', { id: 'a' }).status, 'released');
cases.push('release is idempotent and expires retained Facade');
let pending = [];
tool = args => {
  const facade = context(args);
  pending = [facade.commit({ n: 1 }), facade.commit({ n: 2 })];
};
begin('unawaited');
await execute();
assert.equal(s.functionCalls.get('unawaited').finished, true);
assert.equal(s.functionCalls.get('unawaited').pending.size, 2);
for (const id of [1, 2]) {
  assert.equal((await next('unawaited')).id, id);
  immediate('acknowledge', { id: 'unawaited', requestId: id, settlement: { status: 'completed' } });
}
await Promise.all(pending);
assert.equal((await next('unawaited')).kind, 'done');
cases.push('unawaited requests remain pending until every receipt');
immediate('release', { id: 'unawaited' });
const cancel = new AbortController();
let cancelledPromise, oldFacade;
tool = args => {
  oldFacade = context(args);
  cancelledPromise = oldFacade.commit({ cancel: true });
  cancelledPromise.catch(() => {});
};
begin('cancel', {}, { signal: cancel.signal });
await execute();
assert.equal((await next('cancel')).kind, 'request');
const waiting = next('cancel');
waiting.catch(() => {});
cancel.abort(new Error('stop'));
await assert.rejects(cancelledPromise, /ERA_FUNCTION_CONTEXT_EXPIRED/);
await assert.rejects(waiting, expired);
assert.equal(s.functionCalls.has('cancel'), false);
assert.throws(() => oldFacade.get(), expired);
cases.push('cancel rejects pending requests, wakes next and unbinds context');
const singleCancel = new AbortController();
tool = () => undefined;
begin('single-next');
const singleWaiting = next('single-next', s, { signal: singleCancel.signal });
singleWaiting.catch(() => {});
singleCancel.abort(new Error('single wait cancelled'));
await assert.rejects(singleWaiting, /single wait cancelled/);
assert.equal(s.functionCalls.get('single-next').active, true);
await execute();
assert.equal((await next('single-next')).kind, 'done');
immediate('release', { id: 'single-next' });
cases.push('single next cancellation preserves author call and observes raw continuation');
tool = () => vm.runInNewContext('new Error("foreign error")');
begin('foreign');
await execute();
assert.deepEqual(await next('foreign'), {
  kind: 'done',
  error: { code: 'ERA_FUNCTION_CALL_FAILED', message: 'foreign error' },
});
immediate('release', { id: 'foreign' });
cases.push('cross-window Error is reported as original diagnostic');
tool = () => undefined;
begin('stale');
await execute();
body = 'edited';
await assert.rejects(next('stale'), e => e.cause?.code === 'ERA_MESSAGE_WRITE_TARGET_CHANGED');
start({ request: { session: s, action: 'function_release', input: { id: 'stale' } } });
cases.push('source edit rejects stale call and private release remains available');
body = 'original';
s.createFunctionFacade = () => {
  throw new Error('factory failed');
};
assert.throws(
  () => begin('failed'),
  e => e.cause?.message === 'factory failed',
);
assert.equal(s.functionCalls.has('failed'), false);
cases.push('failed context creation leaves no live call');
s.createFunctionFacade = (transport, active) => ({
  get() {
    active();
    return {};
  },
  commit(payload) {
    active();
    return transport('era:commit', payload);
  },
});
begin('stopping');
await execute();
s.stopping = true;
assert.throws(() => immediate('release', { id: 'stopping' }));
assert.equal(
  start({ request: { session: s, action: 'function_release', input: { id: 'stopping' } } }).result.result.status,
  'released',
);
cases.push('private native release works after public ingress closes');
for (const owner of owners) {
  owner.page.dispatchEvent(new Event('pagehide'));
  await owner.work;
}
const report = {
  status: 'PASS',
  evidence:
    'compiled Browser AOT sync, async wait Loop and author tool Nodeset with recorded APIs; controlled Tavern APIs; full production App acceptance is separate',
  cases,
};
console.log(JSON.stringify(report));
