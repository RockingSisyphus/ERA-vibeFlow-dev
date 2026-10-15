import { fixture, sync as start, asyncEntry as finish } from './native-fixture.mjs';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const calls = [];
let resolveMessages;
const api = {
  crypto: webcrypto,
  SillyTavern: {
    characterId: 0,
    groupId: null,
    getCurrentChatId: () => 'chat',
    getChatCompletionModel: () => 'model',
    chatCompletionSettings: { chat_completion_source: 'openai' },
  },
  getLoadedPresetName: () => 'preset',
  injectPrompts: (rows, options) => calls.push(['inject', rows, options]),
  createChatMessages: (rows, options) => {
    calls.push(['messages', rows, options]);
    return new Promise(r => {
      resolveMessages = r;
    });
  },
};
const nativeOwner = await fixture(undefined, { api });
const s = nativeOwner.session;
s.agentRecordView = {
  clear: () => {},
  begin: (...args) => calls.push(['begin', ...args]),
  armNative: id => calls.push(['arm', id]),
  get: () => ({ requestContext: { executionId: 'old' } }),
  stopNative: () => calls.push(['stop_view']),
  sessionChanged: () => calls.push(['session_changed']),
};
const capture = (operation, input = {}, options = {}) =>
  start({ request: { session: s, action: 'capability', family: 'agent', operation, input, options } }).result;
const immediate = (operation, input, options) => capture(operation, input, options).result;
const cases = [];
assert.deepEqual(immediate('read_session_binding', { chatKey: 'chat' }), { active: false, previous: null });
cases.push('empty native binding facts');
s.sessions.set('chat', {
  execution: { id: 'e', private: 'not projected' },
  storyRequestId: 'story-a',
  nativeGeneration: true,
  extra: { a: 1 },
});
s.nativeGenerationActive = true;
const binding = immediate('read_session_binding', { chatKey: 'chat' });
assert.deepEqual(binding, {
  active: true,
  previous: { execution: { id: 'e' }, storyRequestId: 'story-a', nativeGeneration: true },
});
binding.previous.execution.id = 'changed';
assert.equal(s.sessions.get('chat').execution.id, 'e');
cases.push('binding projection excludes unrelated fields and clones facts');
assert.deepEqual(immediate('inject_once', { id: 'prompt', content: 'injection' }), {
  status: 'injected',
  id: 'prompt',
});
assert.deepEqual(
  calls.map(c => c[0]),
  ['begin', 'arm', 'inject'],
);
assert.equal(calls[0][1], 'story-a');
assert.deepEqual(calls[0][4], { injection: 'injection' });
assert.deepEqual(calls[0][6], { executionId: 'old' });
assert.deepEqual(calls[2][1], [
  { id: 'prompt', position: 'in_chat', depth: 0, role: 'system', content: 'injection', should_scan: false },
]);
assert.deepEqual(calls[2][2], { once: true });
cases.push('injection preserves record, arm and raw API order');
s.sessions.set('chat', { execution: { id: 'e' } });
immediate('inject_once', { id: 'prompt-2', content: 'new' });
assert.match(s.sessions.get('chat').storyRequestId, /^era-story-/);
cases.push('injection creates request id only when missing');
assert.throws(
  () => immediate('inject_once', { id: 'bad', content: 2 }),
  e => e.cause?.message.includes('缺少 id 或 content'),
);
cases.push('invalid injection rejected');
s.sessions.set('other', { value: 2 });
let finishNative;
const nativeCycle = {
  identity: { chatId: 'chat', executionId: 'e' },
  promise: new Promise(resolve => {
    finishNative = resolve;
  }),
  resolve: value => finishNative(value),
};
s.nativeCycle = nativeCycle;
assert.deepEqual(immediate('clear_session', { chatKey: 'chat' }), { status: 'cleared', chatKey: 'chat' });
assert.equal(s.sessions.has('other'), true);
assert.equal(s.nativeCycle, nativeCycle);
assert.deepEqual(calls.slice(-2), [['stop_view'], ['session_changed']]);
cases.push('clear one session preserves other chat and native completion resource');
assert.deepEqual(immediate('clear_session', {}), { status: 'cleared', chatKey: null });
assert.equal(s.sessions.size, 0);
cases.push('clear all and view notification');
const error = capture('create_error_message', { message: 'planning failed' });
assert.deepEqual(calls.at(-1), [
  'messages',
  [
    {
      role: 'system',
      message: 'planning failed',
      extra: { era_agent: { status: 'planning-failed', swipeLocked: true } },
    },
  ],
  { insert_before: 'end', refresh: 'affected' },
]);
resolveMessages();
assert.deepEqual(await error.publicPromise, { status: 'created' });
cases.push('error message starts in same stack with original extras and returns after completion');
assert.throws(
  () => capture('create_error_message', { message: 1 }),
  e => e.cause?.message.includes('缺少 message'),
);
cases.push('invalid error message rejected before API');
const cancel = new AbortController(),
  pending = capture('create_error_message', { message: 'late' }, { signal: cancel.signal });
pending.publicPromise.catch(() => {});
cancel.abort(new Error('cancelled'));
await assert.rejects(pending.publicPromise, /cancelled/);
resolveMessages();
await Promise.resolve();
await Promise.resolve();
cases.push('public cancellation rejects while original message completion is retained');
nativeOwner.page.dispatchEvent(new Event('pagehide'));
await nativeOwner.work;
const report = {
  status: 'PASS',
  evidence:
    'actual compiled native Agent binding/session/injection/error-message paths with recorded Tavern and UI APIs; native event integration not included',
  cases,
};
console.log(JSON.stringify(report));
