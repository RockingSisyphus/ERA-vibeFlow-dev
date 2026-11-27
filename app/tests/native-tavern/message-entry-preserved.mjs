import { fixture, sync as start } from './native-fixture.mjs';
import assert from 'node:assert/strict';
const calls = [];
let chatId = 'chat-a',
  persisted,
  saveError,
  responseError,
  invalidJson,
  swallowed = false,
  holdSave;
const chat = [
  {
    message_id: 0,
    is_user: true,
    mes: 'old',
    swipe_id: 0,
    swipes: ['old'],
    extra: { image: 'attachment', unknown: undefined, era_old: { x: 1 } },
    swipe_info: [{ extra: { image: 'attachment' } }],
  },
];
const tavern = {
  characterId: 0,
  groupId: null,
  characters: [{ avatar: 'card.png', name: 'Card', chat: 'chat-a' }],
  chat,
  getCurrentChatId: () => chatId,
  getRequestHeaders: () => ({ 'content-type': 'application/json' }),
  reloadCurrentChat: async () => {
    calls.push('reload');
  },
  writeExtensionField: () => {},
  saveChat: async () => {
    calls.push('save');
    if (holdSave) await holdSave;
    if (saveError) throw saveError;
    if (!swallowed) persisted = structuredClone(chat);
  },
};
const api = {
  location: { origin: 'http://tavern.test' },
  SillyTavern: tavern,
  getCurrentCharacterId: () => 'card',
  getVariables: () => ({}),
  getChatMessages: range =>
    (typeof range === 'number' ? (chat[range] ? [chat[range]] : []) : chat).map(message => ({
      ...message,
      message: message.mes,
    })),
  setChatMessages: async (updates, options) => {
    calls.push(['set', structuredClone(updates), options]);
    for (const u of updates) {
      const m = chat[u.message_id];
      if (u.message !== undefined) {
        m.mes = u.message;
        m.swipes[m.swipe_id] = u.message;
      }
      if (u.extra) m.extra = u.extra;
    }
  },
  refreshOneMessage: async id => {
    calls.push(['refresh', id]);
  },
  fetch: async (url, options) => {
    calls.push(['fetch', url, JSON.parse(options.body)]);
    return {
      ok: !responseError,
      status: responseError ? 500 : 200,
      json: async () => {
        if (invalidJson) throw new SyntaxError('bad JSON');
        return [{ header: true }, ...persisted];
      },
    };
  },
};
const nativeOwner = await fixture(undefined, { api });
const s = nativeOwner.session;
s.updateTechnicalReports = ids => calls.push(['project', ids]);
const capture = (operation, input) =>
  start({ request: { session: s, action: 'capability', family: 'messages', operation, input } }).result;
const run = async (operation, input) => {
  const p = capture(operation, input);
  return p.publicPromise;
};
const read = capture('read_context', { projection: 'era-active-message-v2' }).result;
assert.deepEqual(read, {
  schemaVersion: 2,
  messages: [
    {
      schemaVersion: 2,
      messageId: 0,
      role: 'user',
      activeText: 'old',
      swipeIndex: 0,
      candidate: { exists: true, generation: null, predecessor: null, phase: 'idle' },
    },
  ],
});
assert.throws(() => capture('read_context', {}));
chat[0].swipe_id = 1;
assert.equal(capture('read_context', { projection: 'era-active-message-v2' }).result.messages[0].activeText, '');
chat[0].swipe_id = 0;
let basis = { identity: { characterId: 'card', chatId: 'chat-a', groupId: null }, messages: read.messages };
const firstFrame = capture('update_content', { messageId: 0, content: 'new', sourceBasis: basis });
const first = firstFrame.publicPromise;
assert.equal(chat[0].mes, 'new', 'memory write must start before first await');
assert.equal(chat[0].extra.image, 'attachment');
assert.equal((await first).status, 'committed');
assert.deepEqual(
  calls.map(c => (Array.isArray(c) ? c[0] : c)),
  ['set', 'save', 'fetch', 'project'],
);
assert.deepEqual(calls[0][1], [{ message_id: 0, message: 'new' }]);
assert.deepEqual(calls.at(-1), ['project', [0]]);
assert.throws(
  () => capture('update_content', { messageId: 0, content: 'stale', sourceBasis: basis }),
  error => error.cause?.code === 'ERA_MESSAGE_WRITE_TARGET_CHANGED',
);
assert.equal(chat[0].mes, 'new');
calls.length = 0;
assert.equal(
  (await run('update_content', { updates: [{ message_id: 0, message: 'many', extra: { era_new: { x: 2 } } }] })).status,
  'committed',
);
assert.equal(chat[0].extra.image, 'attachment');
assert.equal(Object.hasOwn(chat[0].extra, 'unknown'), true);
assert.deepEqual(chat[0].extra.era_old, { x: 1 });
assert.deepEqual(chat[0].extra.era_new, { x: 2 });
assert.equal(calls.filter(c => Array.isArray(c) && c[0] === 'set').length, 1);
swallowed = true;
const failed = await run('update_content', { messageId: 0, content: 'not-saved' });
assert.equal(failed.status, 'failed');
assert.equal(failed.writeState, 'memory-written');
assert.equal(failed.persistenceConfirmed, false);
assert.equal(failed.sourceChanged, false);
swallowed = false;
saveError = new Error('disk');
const failedSave = await run('update_content', { messageId: 0, content: 'disk-fail' });
assert.equal(failedSave.status, 'failed');
assert.equal(failedSave.message, 'disk');
saveError = null;
responseError = true;
assert.equal((await run('update_content', { messageId: 0, content: 'http-fail' })).status, 'failed');
responseError = false;
invalidJson = true;
assert.equal((await run('update_content', { messageId: 0, content: 'json-fail' })).status, 'failed');
invalidJson = false;
let release;
holdSave = new Promise(r => {
  release = r;
});
const pending = run('update_content', { messageId: 0, content: 'during-save' });
await new Promise(r => setImmediate(r));
chat[0].mes = 'user edit';
chat[0].swipes[0] = 'user edit';
release();
const changed = await pending;
assert.equal(changed.status, 'failed');
assert.equal(changed.sourceChanged, true);
holdSave = null;
await run('refresh', { messageId: 0 });
assert.deepEqual(calls.at(-1), ['refresh', 0]);
await run('refresh', { mode: 'all' });
assert.equal(calls.at(-1), 'reload');
nativeOwner.page.dispatchEvent(new Event('pagehide'));
await nativeOwner.work;
const report = {
  status: 'PASS',
  evidence: 'compiled Browser AOT native message entry, loop and persistence failure branches with recorded APIs',
  cases: [
    'strict projection',
    'missing projection rejected',
    'overswipe empty text',
    'same-stack single update',
    'single message only preserves attachment',
    'write-save-read-project order',
    'stale source rejected before write',
    'one batch call and unknown extra preserved',
    'swallowed save detected',
    'save rejection classified',
    'HTTP rejection classified',
    'invalid JSON classified',
    'edit during save detected',
    'single and all refresh',
  ],
};
console.log(JSON.stringify(report));
