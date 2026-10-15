import { fixture, sync as start, asyncEntry as finish } from './native-fixture.mjs';
import assert from 'node:assert/strict';
const calls = [];
let saveResolve,
  responseStatus = 200,
  payload = { data: [{ id: 'b' }, { id: ' a ' }, { name: 'b' }, null] },
  jsonError;
const tavern = {
  groupId: null,
  characterId: 0,
  getCurrentChatId: () => 'chat-a',
  characters: [{ data: { extensions: { era_agent: { version: 2 } } } }],
  extensionSettings: {},
  writeExtensionField: async (id, key, value) => calls.push(['field', id, key, value]),
  getRequestHeaders: () => ({}),
  saveSettingsDebounced: () => {
    calls.push('save');
    return new Promise(r => {
      saveResolve = r;
    });
  },
};
const api = {
  location: { origin: 'http://tavern.test' },
  SillyTavern: tavern,
  getCurrentCharacterId: () => 'card',
  getChatMessages: () => [{ message_id: 0, role: 'assistant', message: 'body' }],
  getPresetNames: () => ['test'],
  getLoadedPresetName: () => 'test',
  getPreset: () => ({
    prompts: [{ id: 'p', role: 'system', content: 'secret free' }],
    settings: { temperature: 0.5, key: 'must not leave' },
  }),
  fetch: (url, options) => {
    calls.push(['fetch', url, JSON.parse(options.body)]);
    return Promise.resolve({
      ok: responseStatus === 200,
      status: responseStatus,
      json: async () => {
        if (jsonError) throw jsonError;
        return payload;
      },
    });
  },
};
const nativeOwner = await fixture(undefined, { api });
const s = nativeOwner.session;
s.activeSnapshot = { revision: 2, statData: { hp: 4 }, statFunc: {}, eraMeta: {} };
const capture = (operation, input = {}) =>
  start({ request: { session: s, action: 'capability', family: 'agent', operation, input } }).result;
const immediate = (operation, input) => capture(operation, input).result;
const suspended = async (operation, input) => {
  const prepared = capture(operation, input);
  return prepared.publicPromise;
};
const context = immediate('read_context');
assert.equal(context.configuration.version, 2);
assert.equal(context.state.statData.hp, 4);
context.configuration.version = 99;
assert.equal(immediate('read_context').configuration.version, 2);
const preset = immediate('capture_preset', { name: 'in_use' });
assert.equal(preset.loadedName, 'test');
assert.equal(preset.settings.temperature, 0.5);
assert.equal(Object.hasOwn(preset.settings, 'key'), false);
const config = suspended('write_configuration', { configuration: { version: 3 } });
assert.deepEqual(calls.at(-1), ['field', 0, 'era_agent', { version: 3 }]);
assert.equal((await config).status, 'committed');
let keyReads = 0;
const pending = suspended('upsert_connection_profile', {
  id: 'profile-a',
  name: 'A',
  apiUrl: 'https://api.test///',
  keyMode: 'keep',
  keyProvider: () => {
    keyReads++;
    return 'private-key';
  },
  status: 'created',
});
assert.equal(tavern.extensionSettings.era_agent.connectionProfiles['profile-a'].key, 'private-key');
assert.equal(keyReads, 1);
assert.equal(calls.at(-1), 'save');
saveResolve();
const saved = await pending;
assert.equal(saved.profile.hasKey, true);
assert.equal(JSON.stringify(saved).includes('private-key'), false);
assert.equal(saved.profile.apiUrl, 'https://api.test');
const empty = suspended('upsert_connection_profile', {
  id: 'profile-a',
  sourceId: 'profile-a',
  name: 'A',
  apiUrl: 'https://api.test',
  keyMode: 'keep',
  keyProvider: () => '',
  status: 'updated',
});
saveResolve();
await empty;
assert.equal(tavern.extensionSettings.era_agent.connectionProfiles['profile-a'].key, 'private-key');
const state = immediate('read_connection_state', { id: 'profile-a' });
assert.equal(state.entryCount, 1);
assert.equal(state.entryExists, true);
assert.equal(state.profile.hasKey, true);
assert.equal(Object.hasOwn(state.profile, 'key'), false);
assert.equal(immediate('read_configuration_sources').connectionProfiles[0].hasKey, true);
const models = suspended('list_connection_models', { id: 'profile-a' });
assert.equal(calls.at(-1)[0], 'fetch');
assert.equal(calls.at(-1)[2].proxy_password, 'private-key');
const listed = await models;
assert.deepEqual(listed.models, ['a', 'b']);
assert.equal(JSON.stringify(listed).includes('private-key'), false);
s.refs.set('secret-ref', () => 'closed-over-private');
const referenced = await suspended('list_connection_models_draft', {
  apiUrl: 'https://draft.test',
  keyReference: { kind: 'host-ref', token: 'secret-ref' },
});
assert.deepEqual(referenced.models, ['a', 'b']);
assert.equal(calls.at(-1)[2].proxy_password, 'closed-over-private');
assert.throws(
  () =>
    capture('list_connection_models_draft', {
      apiUrl: 'https://draft.test',
      keyReference: { kind: 'host-ref', token: 'released' },
    }),
  e => e.cause?.code === 'ERA_HOST_REF_UNKNOWN',
);
s.refs.set('wrong-kind', {});
assert.throws(
  () =>
    capture('list_connection_models_draft', {
      apiUrl: 'https://draft.test',
      keyReference: { kind: 'host-ref', token: 'wrong-kind' },
    }),
  e => e.cause?.code === 'ERA_HOST_REF_KIND',
);
const draft = await suspended('list_connection_models_draft', {
  apiUrl: 'https://draft.test/',
  keyProvider: () => 'draft-private',
});
assert.deepEqual(draft.models, ['a', 'b']);
assert.equal(calls.at(-1)[2].proxy_password, 'draft-private');
responseStatus = 500;
await assert.rejects(suspended('list_connection_models', { id: 'profile-a' }), e =>
  e.cause?.message.includes('ERA_AGENT_MODEL_LIST_FAILED'),
);
responseStatus = 200;
payload = { error: 'provider failure' };
await assert.rejects(suspended('list_connection_models_draft', { apiUrl: 'https://draft.test' }), e =>
  e.cause?.message.includes('ERA_AGENT_MODEL_LIST_FAILED'),
);
payload = { data: [] };
assert.deepEqual((await suspended('list_connection_models', { id: 'profile-a' })).models, []);
jsonError = new SyntaxError('invalid JSON');
await assert.rejects(suspended('list_connection_models', { id: 'profile-a' }));
jsonError = null;
assert.throws(
  () => capture('list_connection_models', { id: 'missing' }),
  e => e.cause?.message.includes('ERA_AGENT_PROFILE_MISSING'),
);
const clear = suspended('clear_connection_profile_key', { id: 'profile-a', name: 'A', apiUrl: 'https://api.test' });
assert.equal(tavern.extensionSettings.era_agent.connectionProfiles['profile-a'].key, '');
saveResolve();
assert.equal((await clear).profile.hasKey, false);
const deleted = suspended('delete_connection_profile', { id: 'profile-a' });
assert.equal(Object.hasOwn(tavern.extensionSettings.era_agent.connectionProfiles, 'profile-a'), false);
saveResolve();
assert.equal((await deleted).status, 'deleted');
tavern.groupId = 'group';
assert.equal(immediate('read_context').configuration, null);
assert.throws(() => capture('capture_preset', { name: 'test' }));
assert.throws(() => capture('write_configuration', { configuration: {} }));
nativeOwner.page.dispatchEvent(new Event('pagehide'));
await nativeOwner.work;
const report = {
  status: 'PASS',
  evidence:
    'compiled Browser AOT native Agent context/configuration/connection operation paths with recorded APIs; model generation not included',
  cases: [
    'context clone and Sidecar facts',
    'preset sampling projection excludes secret',
    'same-stack configuration write',
    'same-stack profile/key preparation and save wait',
    'empty key keeps existing secret',
    'redacted connection state',
    'configuration sources summaries',
    'same-stack model status and redacted response',
    'draft endpoint and one secret provider',
    'HTTP failure stable diagnostic',
    'invalid provider payload rejected',
    'legal zero models',
    'JSON rejection',
    'missing profile diagnostic',
    'clear key before save confirmation',
    'delete before save confirmation',
    'group chat configuration protections',
    'instance secret reference resolution',
    'released reference rejected',
    'wrong reference kind rejected',
  ],
};
console.log(JSON.stringify(report));
