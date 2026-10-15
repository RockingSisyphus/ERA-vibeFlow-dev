import { fixture, sync as start, asyncEntry as finish } from './native-fixture.mjs';
import assert from 'node:assert/strict';
const calls = [],
  fields = { '#firstmessage_textarea': { value: 'old' }, '#character_json_data': { value: '' } };
let http = 200,
  failBody = 'write failed',
  hold;
const c = {
  avatar: 'real-avatar.png',
  name: 'Display',
  chat: 'chat-a',
  first_mes: 'old',
  data: { first_mes: 'old', extensions: { unknown: 7 } },
  json_data: JSON.stringify({ first_mes: 'old', data: { first_mes: 'old', extensions: { unknown: 7 } } }),
};
const t = {
  characters: [c, { avatar: 'other.png', data: { extensions: {} }, json_data: '{}' }],
  characterId: 0,
  groupId: null,
  chat: [],
  chatMetadata: {},
  name2: 'Display',
  getRequestHeaders: () => ({}),
  writeExtensionField: () => {},
  eventTypes: { MESSAGE_RECEIVED: 'received', CHARACTER_MESSAGE_RENDERED: 'rendered' },
  eventSource: { emit: async (type, id, source) => calls.push([type, id, source]) },
  clearChat: async () => calls.push('clear'),
  printMessages: async () => calls.push('print'),
  saveChat: async () => calls.push('save'),
};
const api = {
  location: { origin: 'http://tavern.test' },
  SillyTavern: t,
  window: { top: { document: { querySelector: selector => fields[selector] } } },
  getCurrentCharacterName: () => 'Display',
  getCharacter: name => {
    calls.push(['get', name]);
    return Promise.resolve({ first_messages: [c.first_mes] });
  },
  fetch: async (url, options) => {
    calls.push(['fetch', url, JSON.parse(options.body)]);
    if (hold) await hold;
    return { ok: http === 200, status: http, text: async () => failBody };
  },
};
const nativeOwner = await fixture(undefined, { api });
const s = nativeOwner.session;
s.refreshSingleFloor = () => calls.push('single-ui');
s.refreshExternalStatusbar = () => calls.push('external-ui');
const capture = (operation, input = {}) =>
  start({ request: { session: s, action: 'capability', family: 'character', operation, input } }).result;
const immediate = (operation, input) => capture(operation, input).result;
const run = (operation, input) => capture(operation, input).publicPromise;
const read = await run('read_main_greeting');
assert.equal(read.characterId, 'real-avatar.png');
assert.equal(read.firstMessage, 'old');
t.groupId = 'group';
assert.deepEqual(await run('read_main_greeting'), { status: 'missing', firstMessage: null });
t.groupId = null;
const before = calls.length;
await assert.rejects(run('write_main_greeting', { expected: 'stale', next: 'new' }), e =>
  e.cause?.message.startsWith('ERA_CHARACTER_GREETING_STALE'),
);
assert.equal(
  calls.slice(before).some(c => c[0] === 'fetch'),
  false,
);
assert.equal((await run('write_main_greeting', { expected: 'old', next: 'new' })).firstMessage, 'new');
const posted = calls.find(c => Array.isArray(c) && c[0] === 'fetch')[2];
assert.equal(posted.avatar, 'real-avatar.png');
assert.equal(c.first_mes, 'new');
assert.equal(c.data.first_mes, 'new');
assert.equal(JSON.parse(c.json_data).first_mes, 'new');
assert.equal(fields['#firstmessage_textarea'].value, 'new');
http = 500;
await assert.rejects(run('write_main_greeting', { expected: 'new', next: 'not-written' }));
assert.equal(c.first_mes, 'new');
http = 200;
const startEmpty = calls.length;
const empty = run('apply_greeting_refresh', { kind: 'empty', next: 'hello' });
assert.equal(t.chat[0].mes, 'hello', 'first floor mirror must change before Promise');
assert.equal((await empty).status, 'refreshed');
assert.deepEqual(
  calls.slice(startEmpty).map(x => (Array.isArray(x) ? x[0] : x)),
  ['received', 'clear', 'print', 'rendered', 'save'],
);
t.chat[0].swipes = ['hello'];
await run('apply_greeting_refresh', { kind: 'append', updated: 'appended' });
assert.equal(t.chat[0].swipes[0], 'appended');
assert.equal(immediate('read_greeting_refresh_context').first.primary, 'appended');
const updated = await run('patch_external_statusbar', {
  characterId: 'real-avatar.png',
  patch: { enabled: true, html: '<div>x</div>' },
});
assert.equal(updated.status, 'updated');
assert.equal(c.data.extensions.unknown, 7);
assert.equal(c.data.extensions.era_external_statusbar.enabled, true);
assert.equal(calls.at(-1), 'external-ui');
assert.equal(JSON.parse(fields['#character_json_data'].value).data.extensions.unknown, 7);
let release;
hold = new Promise(r => {
  release = r;
});
const fixed = run('patch_single_floor', { characterId: 'real-avatar.png', enabled: true });
assert.equal(calls.at(-1)[2].avatar, 'real-avatar.png');
t.characterId = 1;
release();
await fixed;
hold = null;
assert.equal(c.data.extensions.era_single_floor.enabled, true);
assert.equal(t.characters[1].data.extensions.era_single_floor, undefined);
assert.equal(calls.at(-1), 'single-ui');
http = 500;
await assert.rejects(run('patch_single_floor', { characterId: 'real-avatar.png', enabled: false }));
assert.equal(c.data.extensions.era_single_floor.enabled, true);
http = 200;
const oldJson = c.json_data;
c.json_data = 'bad JSON';
const requests = calls.length;
assert.throws(() => capture('patch_single_floor', { characterId: 'real-avatar.png', enabled: false }));
assert.equal(calls.length, requests);
c.json_data = oldJson;
assert.throws(() => capture('patch_single_floor', { characterId: 'missing.png', enabled: true }));
nativeOwner.page.dispatchEvent(new Event('pagehide'));
await nativeOwner.work;
const report = {
  status: 'PASS',
  evidence:
    'compiled Browser AOT character sync/async native entry and actual current resource allocator with recorded APIs',
  cases: [
    'main greeting read',
    'group missing',
    'stale expected rejected before write',
    'real avatar backend target',
    'mirror and editor draft after success',
    'HTTP failure leaves greeting unchanged',
    'first-floor mutation before first await',
    'received-clear-print-rendered-save order',
    'append preserves swipe update',
    'refresh context projection',
    'external config preserves unknown extension',
    'JSON editor synchronization',
    'fixed avatar through chat selection change',
    'settings HTTP failure no mirror update',
    'bad JSON rejected before API',
    'missing avatar rejected',
  ],
};
console.log(JSON.stringify(report));
