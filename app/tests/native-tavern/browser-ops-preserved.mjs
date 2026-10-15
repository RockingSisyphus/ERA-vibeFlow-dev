import { fixture, sync } from './native-fixture.mjs';
import assert from 'node:assert/strict';
const calls = [],
  storage = { chat: { outside: 1 }, script: { outside: 2 } },
  settings = {};
const api = {
  getVariables(scope) {
    calls.push(['getVariables', scope]);
    return storage[scope.type];
  },
  replaceVariables(value, scope) {
    calls.push(['replaceVariables', scope]);
    storage[scope.type] = value;
  },
  updateVariablesWith(fn, scope) {
    calls.push(['updateVariablesWith', scope]);
    storage[scope.type] = fn(storage[scope.type]);
  },
  getWorldbookNames() {
    return ['old'];
  },
  getCharWorldbookNames() {
    return { primary: 'old', additional: ['extra'] };
  },
  async getWorldbook(name) {
    calls.push(['getWorldbook', name]);
    return [{ uid: 1 }];
  },
  getTavernRegexes() {
    return [];
  },
  isCharacterTavernRegexesEnabled() {
    return false;
  },
  getCurrentCharacterId() {
    return 'avatar';
  },
  getCurrentCharacterName() {
    return 'name';
  },
  getScriptId() {
    return 'script';
  },
  getScriptTrees({ type }) {
    return [
      { type: 'folder', enabled: type === 'character', scripts: [{ type: 'script', id: 'script', enabled: true }] },
    ];
  },
  SillyTavern: {
    characterId: 0,
    groupId: null,
    characters: [{}],
    extensionSettings: settings,
    getCurrentChatId() {
      return 'chat';
    },
    async writeExtensionField(...args) {
      calls.push(['writeExtensionField', ...args]);
    },
    async saveSettingsDebounced() {
      calls.push(['saveSettings']);
    },
    async reloadCurrentChat() {
      calls.push(['reload']);
    },
  },
};
let published = 0;
const nativeOwner = await fixture(undefined, { api, onScriptVariablesCommitted: () => published++ });
const s = nativeOwner.session;
const mapped =
  (family, operation) =>
  ({ request }) =>
    sync({ request: { ...request, action: 'capability', family, operation } });
const suspended =
  (family, operation) =>
  async ({ request }) => {
    const out = mapped(family, operation)({ request });
    out.result.result = await (out.result.publicPromise ?? out.result.result);
    return out;
  };
const commit = suspended('variables', 'commit'),
  read = suspended('variables', 'read'),
  worldbookRead = suspended('worldbook', 'read'),
  regexUpsert = suspended('regex', 'upsert'),
  identityRead = mapped('identity', 'read'),
  scopeRead = mapped('installation_scope', 'read');
const run = async (fn, input) => (await fn({ request: { session: s, input } })).result.result;
const patched = await run(commit, { scope: { type: 'chat' }, stat: { coins: 3 }, meta: { id: 1 } });
assert.deepEqual(patched.variables, { outside: 1, stat_data: { coins: 3 }, ERAMetaData: { id: 1 } });
assert.ok(calls.some(([name]) => name === 'updateVariablesWith'));
const replaced = await run(commit, { scope: { type: 'script' }, variables: { only: 7 } });
assert.deepEqual(replaced.variables, { only: 7 });
assert.equal(published, 1);
assert.deepEqual((await run(read, { scope: { type: 'script' } })).variables, { only: 7 });
await assert.rejects(run(commit, { scope: { type: 'global' }, variables: {} }));
const wb = await run(worldbookRead, {});
assert.deepEqual(wb.bindings.additional, ['extra']);
assert.equal(wb.requestedName, 'old');
await run(regexUpsert, {
  regex: {
    id: 'regex',
    script_name: 'test',
    enabled: true,
    source: { ai_output: true },
    destination: { display: true, prompt: false },
    find_regex: 'x',
    replace_string: 'y',
  },
});
const order = calls.filter(([name]) => ['writeExtensionField', 'saveSettings', 'reload'].includes(name));
assert.deepEqual(
  order.map(([name]) => name),
  ['writeExtensionField', 'saveSettings', 'reload'],
);
assert.deepEqual(settings.character_allowed_regex, ['avatar']);
assert.equal(identityRead({ request: { session: s, input: {} } }).result.result.characterId, 'avatar');
assert.deepEqual(scopeRead({ request: { session: s, input: {} } }).result.result, {
  scriptId: 'script',
  scopes: ['character'],
  readStatus: 'complete',
});
nativeOwner.page.dispatchEvent(new Event('pagehide'));
await nativeOwner.work;
console.log(
  JSON.stringify({
    status: 'PASS',
    evidence: 'actual Browser single-esm AOT with recorded raw Tavern API',
    cases: [
      'patch and replace native branches',
      'unknown variable fields preserved',
      'script commit callback',
      'scope rejection',
      'worldbook binding facts',
      'regex write-save-reload order',
      'identity',
      'script scope facts',
    ],
  }),
);
