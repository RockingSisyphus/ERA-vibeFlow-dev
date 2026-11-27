import assert from 'node:assert/strict';
import { fixture, sync as start } from './native-fixture.mjs';
const calls = [],
  pending = [];
const tavern = {
  characterId: 0,
  groupId: null,
  getCurrentChatId: () => 'chat-a',
  getChatCompletionModel: () => 'current-model',
  characters: [{ data: { extensions: {} } }],
  extensionSettings: {
    era_agent: {
      connectionProfiles: {
        private: { id: 'private', name: 'Private', apiUrl: 'https://model.test', key: 'private-key' },
      },
    },
  },
  writeExtensionField: () => {},
};
const api = {
  SillyTavern: tavern,
  getLoadedPresetName: () => 'preset',
  substitudeMacros: s => 'resolved:' + s,
  generateRaw: input => {
    calls.push(['raw', input]);
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  },
  generate: input => {
    calls.push(['story', input]);
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  },
};
const owners = [];
async function session() {
  const f = await fixture(undefined, {
    api,
    observeAgentRequest: (status, data) => calls.push(['record', status, data]),
  });
  owners.push(f);
  return f.session;
}
const s = await session();
const input = {
  generationId: 'gen',
  userInput: 'input',
  orderedPrompts: [{ role: 'system', content: 'macro' }],
  requestPolicy: { binding: { kind: 'tavern-current', model: null }, sampling: { temperature: 0.3 } },
};
const capture = (session, operation, input, signal) =>
  start({ request: { session, action: 'capability', family: 'agent', operation, input, options: { signal } } }).result;
const generate = (session, operation, input, signal) => capture(session, operation, input, signal).result;
const first = generate(s, 'generate', input);
assert.equal(s.auxiliaryGenerationDepth, 1);
assert.equal(calls.at(-1)[0], 'raw');
assert.equal(calls.at(-1)[1].custom_api.temperature, 0.3);
pending.shift().resolve('{"ok":true}');
const result = await first;
assert.equal(result.response, '{"ok":true}');
assert.equal(s.auxiliaryGenerationDepth, 0);
assert.equal(result.route.kind, 'tavern-current');
const controller = new AbortController(),
  reason = new Error('public cancellation');
const cancelled = generate(s, 'generate', input, controller.signal);
assert.equal(s.auxiliaryGenerationDepth, 1);
controller.abort(reason);
await assert.rejects(cancelled, e => e === reason);
assert.equal(s.auxiliaryGenerationDepth, 1, 'cancellation must not release active raw model');
pending.shift().resolve('{}');
await new Promise(r => setImmediate(r));
assert.equal(s.auxiliaryGenerationDepth, 0);
const a = generate(s, 'generate', input),
  b = generate(s, 'generate', input);
assert.equal(s.auxiliaryGenerationDepth, 2);
pending.shift().resolve('a');
await a;
assert.equal(s.auxiliaryGenerationDepth, 1);
pending.shift().resolve('b');
await b;
assert.equal(s.auxiliaryGenerationDepth, 0);
const custom = generate(s, 'generate', {
  ...input,
  resolvePresetMacros: true,
  requestPolicy: { ...input.requestPolicy, binding: { kind: 'custom-profile', profileId: 'private', model: 'custom' } },
});
const raw = calls.at(-1)[1];
assert.equal(raw.custom_api.key, 'private-key');
assert.equal(raw.ordered_prompts[0].content, 'resolved:macro');
pending.shift().resolve('{}');
const customResult = await custom;
assert.equal(customResult.route.profileId, 'private');
assert.equal(JSON.stringify(customResult).includes('private-key'), false);
const failure = generate(s, 'generate', input);
pending.shift().reject(new Error('supplier text contains private-key'));
const failed = await failure;
assert.equal(failed.status, 'failed');
assert.equal(failed.diagnostic.code, 'ERA_AGENT_AUXILIARY_REQUEST_FAILED');
assert.equal(JSON.stringify(failed).includes('private-key'), false);
assert.equal(s.auxiliaryGenerationDepth, 0);
const invalid = generate(s, 'generate', input);
pending.shift().resolve({ bad: 'not text' });
assert.equal((await invalid).status, 'failed');
assert.equal(s.auxiliaryGenerationDepth, 0);
const missing = generate(s, 'generate', {
  ...input,
  requestPolicy: { ...input.requestPolicy, binding: { kind: 'custom-profile', profileId: 'missing', model: 'x' } },
});
assert.equal((await missing).diagnostic.code, 'ERA_AGENT_PROFILE_MISSING');
assert.equal(s.auxiliaryGenerationDepth, 0);
assert.throws(() => capture(s, 'generate', { userInput: 4, orderedPrompts: [] }));
const story = generate(s, 'generate_story', {
  userInput: 'retry',
  injection: 'inject',
  requestContext: { executionId: 'x' },
});
assert.equal(calls.at(-1)[0], 'story');
assert.equal(calls.at(-1)[1].should_stream, true);
assert.equal(calls.at(-1)[1].injects[0].content, 'inject');
pending.shift().resolve('body');
assert.equal((await story).response, 'body');
assert.equal(s.auxiliaryGenerationDepth, 0);
const storyFailure = generate(s, 'generate_story', {});
const originalError = new Error('story error');
pending.shift().reject(originalError);
await assert.rejects(storyFailure, e => e.cause === originalError);
assert.equal(s.auxiliaryGenerationDepth, 0);
const other = await session();
const late = generate(other, 'generate', input);
owners.at(-1).page.dispatchEvent(new Event('pagehide'));
await assert.rejects(late);
assert.equal(other.auxiliaryGenerationDepth, 1);
pending.shift().resolve('{}');
await new Promise(r => setImmediate(r));
assert.equal(other.auxiliaryGenerationDepth, 0);
assert.equal(other.started, false);
assert.equal(other.modelLeases.size, 0);
assert.equal(s.auxiliaryGenerationDepth, 0);
for (const f of owners) {
  f.page.dispatchEvent(new Event('pagehide'));
  await f.work;
}
const report = {
  status: 'PASS',
  evidence:
    'compiled Browser AOT protocol operation waits actual IO, releases its lease and returns the original result',
  cases: [
    'same-stack raw request and lease',
    'sampling and current route',
    'success returns after release',
    'public cancellation reason preserved',
    'raw lease survives public cancellation',
    'lease released at real terminal',
    'concurrent request leases independent',
    'custom profile key stays out of result',
    'preset macros resolved in request',
    'supplier error diagnostic redacted',
    'non-text classified failed',
    'missing profile failed diagnostic',
    'invalid request rejected',
    'story retry uses native preset chain',
    'story error identity in native cause',
    'late callback after lifecycle close does not restart instance',
  ],
};
console.log(JSON.stringify(report));
