import { fixture, sync as start, asyncEntry as finish } from './native-fixture.mjs';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const calls = [],
  cases = [];
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
};
const nativeOwner = await fixture(undefined, { api });
const s = nativeOwner.session;
s.agentRecordView = {
  clear: () => {},
  begin: (...args) => calls.push(['begin', ...args]),
  armNative: id => calls.push(['arm', id]),
  finish: (...args) => calls.push(['finish', ...args]),
  sessionChanged: () => calls.push(['changed']),
};
s.observeAgentSession = (value, eventId) => calls.push(['observe', value, eventId]);
const write = input =>
  start({ request: { session: s, action: 'capability', family: 'agent', operation: 'write_session', input } }).result
    .result;
assert.throws(
  () => write({ chatKey: '' }),
  e => e.cause?.message === 'Agent 会话写入缺少 chatKey。',
);
cases.push('invalid chat key rejected before resource changes');
const report = {
    execution: { id: 'e', trigger: 'normal' },
    pendingStage: { completionId: 'c' },
    storyRequestId: 'existing',
    story: 'original',
    extra: { unknown: 1 },
  },
  stored = { storage: 'separate', nested: { x: 2 } };
assert.deepEqual(
  write({
    chatKey: 'chat',
    session: report,
    storageSession: stored,
    nativeExecutionId: 'e',
    observationEventId: 'event',
  }),
  { status: 'committed', chatKey: 'chat' },
);
assert.deepEqual(
  calls.map(x => x[0]),
  ['observe', 'finish', 'changed'],
);
assert.equal(calls[0][2], 'event');
assert.deepEqual(s.sessions.get('chat'), stored);
stored.nested.x = 7;
assert.equal(s.sessions.get('chat').nested.x, 2);
cases.push('observe, clone storage, story finish and UI publish retain original order');
assert.equal(s.handoffs.has('c'), true);
assert.deepEqual(s.nativeCycle.identity, { chatId: 'chat', executionId: 'e' });
const cycle = s.nativeCycle,
  handoff = s.handoffs.get('c');
write({ chatKey: 'chat', session: report, nativeExecutionId: 'e' });
assert.equal(s.nativeCycle, cycle);
assert.equal(s.handoffs.get('c'), handoff);
cases.push('same native identity and pending stage preserve existing wait resources');
let previous;
cycle.promise.then(x => {
  previous = x;
});
write({ chatKey: 'chat', session: report, nativeExecutionId: 'next' });
await Promise.resolve();
assert.deepEqual(previous, { status: 'cancelled', reason: 'superseded' });
cases.push('new native execution cancels only previous completion resource');
calls.length = 0;
write({
  chatKey: 'chat',
  session: { execution: { id: 'next', trigger: 'retry' }, pendingStage: { completionId: 'new' } },
  storageSession: { ignored: true },
  startStoryObservation: true,
  nativeExecutionId: 'next',
});
assert.deepEqual(
  calls.map(x => x[0]),
  ['begin', 'arm', 'observe', 'changed'],
);
assert.match(s.sessions.get('chat').storyRequestId, /^era-story-/);
assert.equal(s.sessions.get('chat').ignored, undefined);
assert.deepEqual(calls[0][6], { executionId: 'next', trigger: 'retry', attemptIndex: 0, intent: 'initial' });
assert.deepEqual(calls[0][4], { injection: null });
cases.push('start observation creates real record id and stores observed session instead of storage override');
const current = s.nativeCycle;
write({ chatKey: 'other', session: { value: 1 } });
assert.equal(s.nativeCycle, current);
assert.equal(s.sessions.get('chat').execution.id, 'next');
cases.push('write without native intent retains cycle and isolates chat storage');
nativeOwner.page.dispatchEvent(new Event('pagehide'));
await nativeOwner.work;
const result = {
  status: 'PASS',
  evidence: 'compiled Browser AOT session write with recorded UI resource ports; App observation binding still pending',
  cases,
};
console.log(JSON.stringify(result));
