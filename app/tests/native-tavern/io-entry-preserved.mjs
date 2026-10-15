import { fixture, sync as start, asyncEntry as finish } from './native-fixture.mjs';
import assert from 'node:assert/strict';
const calls = [];
let values = { chat: { unknown: { keep: 1 }, stat_data: { old: 1 } }, script: {} };
let enabled = false,
  chatId = 'chat-a',
  bound = { primary: 'book-a', additional: ['extra'] };
let resolveBook;
const save = () => {
  calls.push('save');
};
save.flush = async () => {
  calls.push('flush');
  enabled = true;
};
const tavern = {
  characters: [{ avatar: 'card' }],
  characterId: 0,
  extensionSettings: { character_allowed_regex: [] },
  writeExtensionField: async (id, key, value) => {
    calls.push(['field', id, key, value]);
  },
  saveSettingsDebounced: save,
  reloadCurrentChat: async () => {
    calls.push('reload');
  },
};
const api = {
  SillyTavern: tavern,
  getCurrentCharacterId: () => 'card',
  getVariables: scope => values[scope.type],
  replaceVariables: (v, scope) => {
    calls.push('replace');
    values[scope.type] = v;
  },
  updateVariablesWith: (fn, scope) => {
    calls.push('patch');
    values[scope.type] = fn(values[scope.type]);
  },
  getWorldbookNames: () => ['book-a'],
  getCharWorldbookNames: () => bound,
  getWorldbook: name => {
    calls.push(['get', name]);
    return new Promise(r => {
      resolveBook = r;
    });
  },
  createWorldbook: async name => {
    calls.push(['create', name]);
    return false;
  },
  replaceWorldbook: async (name, entries) => {
    calls.push(['replace-book', name, entries]);
  },
  getTavernRegexes: () => [],
  isCharacterTavernRegexesEnabled: () => enabled,
  window: { top: { document: { querySelector: () => null } } },
};
const nativeOwner = await fixture(undefined, { api });
const s = nativeOwner.session;
let published = 0;
s.onScriptVariablesCommitted = () => {
  published++;
};
const capture = (family, operation, input = {}) =>
  start({ request: { session: s, action: 'capability', family, operation, input } }).result;
const immediate = async (family, operation, input) => capture(family, operation, input).result;
const suspended = async (family, operation, input) => {
  const prepared = capture(family, operation, input);
  return prepared.publicPromise;
};
const patch = immediate('variables', 'commit', { scope: { type: 'chat' }, stat: { new: 2 } });
assert.equal(values.chat.stat_data.new, 2, 'write must occur before Promise is returned');
assert.deepEqual(values.chat.unknown, { keep: 1 });
assert.equal((await patch).variables.stat_data.new, 2);
const replacement = await immediate('variables', 'commit', { scope: { type: 'script' }, variables: { setting: 7 } });
assert.equal(published, 1);
assert.deepEqual(replacement.variables, { setting: 7 });
const read = await immediate('variables', 'read', { scope: { type: 'chat' } });
read.variables.unknown.keep = 99;
assert.equal(values.chat.unknown.keep, 1);
const book = suspended('worldbook', 'read', {});
assert.deepEqual(calls.at(-1), ['get', 'book-a'], 'raw IO must start in this calling stack');
bound = { primary: 'book-b', additional: [] };
chatId = 'chat-b';
resolveBook([{ uid: 3 }]);
const actual = await book;
assert.equal(actual.requestedName, 'book-a');
assert.deepEqual(actual.bindings, { primary: 'book-a', additional: ['extra'] });
assert.deepEqual(actual.entries, [{ uid: 3 }]);
assert.equal((await suspended('worldbook', 'create', { name: 'book-a' })).status, 'exists');
await suspended('worldbook', 'bind', { name: 'book-a' });
assert.deepEqual(calls.at(-1), ['field', 0, 'world', 'book-a']);
await suspended('worldbook', 'replace_entries', { name: 'book-a', entries: [{ uid: 4, unknown: 8 }] });
assert.deepEqual(calls.at(-1), ['replace-book', 'book-a', [{ uid: 4, unknown: 8 }]]);
const before = calls.length;
await suspended('regex', 'upsert', { regex: { id: 'regex', script_name: 'r', enabled: true } });
assert.equal(calls[before][2], 'regex_scripts');
assert.deepEqual(calls.slice(before + 1), ['save', 'flush', 'reload']);
const already = calls.length;
await suspended('regex', 'upsert', { regex: { id: 'regex2', script_name: 'r2', enabled: true } });
assert.equal(calls[already][2], 'regex_scripts');
assert.deepEqual(calls.slice(already + 1), ['reload']);
assert.equal((await immediate('regex', 'read', {})).enabled, true);
const ctrl = new AbortController();
const pendingFrame = start({
  request: {
    session: s,
    action: 'capability',
    family: 'worldbook',
    operation: 'read',
    input: {},
    options: { signal: ctrl.signal },
  },
}).result;
const cancelled = pendingFrame.publicPromise;
ctrl.abort('probe-cancel');
await assert.rejects(cancelled);
await assert.rejects(immediate('variables', 'read', { scope: { type: 'global' } }));
resolveBook([]);
nativeOwner.page.dispatchEvent(new Event('pagehide'));
await nativeOwner.work;
const report = {
  status: 'PASS',
  evidence: 'actual Browser single-esm AOT using native entry routing and recorded Tavern APIs',
  cases: [
    'synchronous patch and unknown fields',
    'script replace and callback',
    'read clone isolation',
    'same-stack request start',
    'captured binding across context changes',
    'create exists',
    'single bind API without extra reads',
    'entry preservation',
    'regex write/save/flush/reload order',
    'already-enabled no redundant save',
    'cancelled raw request',
    'invalid scope rejected',
  ],
};
console.log(JSON.stringify(report));
