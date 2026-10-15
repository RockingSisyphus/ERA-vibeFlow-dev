import { fixture, sync as start, asyncEntry as finish } from './native-fixture.mjs';
import assert from 'node:assert/strict';
const id = 'era_chat_12345678',
  calls = [];
let chat = 'chat-a',
  variables = { stat_data: { old: 1 }, other: 7 };
let status = 200,
  text = '{"valid":true}',
  failText = false;
const api = {
  location: { origin: 'http://tavern.test' },
  getCurrentCharacterId: () => 'card',
  SillyTavern: { groupId: null, getCurrentChatId: () => chat, getRequestHeaders: () => ({}) },
  getVariables: () => variables,
  updateVariablesWith: fn => {
    calls.push('variables');
    variables = fn(variables);
  },
  fetch: (url, options) => {
    calls.push(['fetch', url, options]);
    return Promise.resolve({
      status,
      ok: status === 200,
      text: async () => {
        if (failText) throw new Error('text fail');
        calls.push('text');
        return text;
      },
    });
  },
  window: { top: { dispatchEvent: event => calls.push(['prompt', event.detail]) } },
  CustomEvent: class {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  },
};
const nativeOwner = await fixture(undefined, { api });
const s = nativeOwner.session;
s.publishSnapshot = (snapshot, notify) => calls.push(['publish', structuredClone(snapshot), notify]);
const capture = (operation, input = {}) =>
  start({ request: { session: s, action: 'capability', family: 'sidecar', operation, input } }).result;
const immediate = (operation, input) => capture(operation, input).result;
const suspended = async (operation, input) => {
  const prepared = capture(operation, input);
  return prepared.publicPromise;
};
const owner = { characterId: 'card', chatId: 'chat-a', groupId: null };
const snapshot = {
  sidecarId: id,
  owner,
  revision: 3,
  state: { eraMeta: { m: 1 }, statData: { hp: 9 }, statFunc: { x: 'y' } },
};
assert.deepEqual(immediate('read_current').stat, { old: 1 });
const committed = immediate('commit_metadata', { sidecarId: id, snapshot });
assert.equal(committed.status, 'committed');
assert.equal(Object.hasOwn(variables, 'stat_data'), false);
assert.equal(variables.other, 7);
assert.deepEqual(variables.ERAMetaData, { SidecarId: id });
assert.equal(calls.at(-1)[0], 'publish');
const before = calls.length;
immediate('commit_metadata', { sidecarId: id, snapshot, workingVersion: 99 });
assert.equal(calls.length, before, 'stale working version must not publish or rewrite pointer');
const working = immediate('write_working', { record: snapshot, dirty: true, expectedVersion: 0 });
assert.equal(working.working.version, 1);
assert.equal(calls.at(-1)[2], false);
const clone = immediate('read_working');
clone.working.record.state.statData.hp = 0;
assert.equal(immediate('read_working').working.record.state.statData.hp, 9);
assert.throws(
  () => immediate('write_working', { record: snapshot, expectedVersion: 0 }),
  e => e.cause?.message === 'ERA_WORKING_STATE_CHANGED',
);
immediate('commit_metadata', { sidecarId: id, snapshot, workingVersion: 1 });
assert.equal(calls.at(-1)[0], 'publish');
chat = 'chat-b';
const count = calls.length;
assert.equal(immediate('publish_snapshot', { sidecarId: id, snapshot }).status, 'ignored');
assert.equal(calls.length, count);
assert.equal(immediate('read_working').working, null);
assert.throws(
  () => immediate('commit_metadata', { sidecarId: id, snapshot }),
  e => e.cause?.code === 'ERA_MESSAGE_WRITE_TARGET_CHANGED',
);
chat = 'chat-a';
immediate('present_prompt', { prompt: { kind: 'bind' } });
assert.deepEqual(calls.at(-1), ['prompt', { kind: 'bind' }]);
immediate('clear_prompt', { expectedSidecarId: id });
assert.deepEqual(calls.at(-1), ['prompt', null]);
assert.match(immediate('create_id').sidecarId, /^era_chat_[a-z0-9-]{8,80}$/i);
const file = suspended('read_record', { sidecarId: id });
assert.equal(calls.at(-1)[0], 'fetch');
assert.deepEqual((await file).record, { valid: true });
status = 404;
const missingCalls = calls.length;
assert.equal((await suspended('read_record', { sidecarId: id })).status, 'missing');
assert.equal(calls.length, missingCalls + 1);
status = 200;
text = 'invalid';
assert.equal((await suspended('read_record', { sidecarId: id })).status, 'invalid');
status = 500;
await assert.rejects(suspended('read_record', { sidecarId: id }));
status = 200;
failText = true;
await assert.rejects(suspended('read_record', { sidecarId: id }));
failText = false;
const record = { unicode: '你好', unknown: { a: 1 } };
const wrote = await suspended('write_record', { sidecarId: id, record, expectedSidecarId: id });
assert.equal(wrote.status, 'committed');
const upload = JSON.parse(calls.at(-1)[2].body);
assert.equal(upload.name, `era-sidecar-v1-${id}.json`);
assert.deepEqual(JSON.parse(Buffer.from(upload.data, 'base64').toString('utf8')), record);
const n = calls.length;
assert.throws(
  () => capture('write_record', { sidecarId: id, record, expectedSidecarId: null }),
  e => e.cause?.code === 'ERA_MESSAGE_WRITE_TARGET_CHANGED',
);
assert.equal(calls.length, n);
const otherOwner = await fixture(undefined, { api });
const other = otherOwner.session;
assert.equal(
  start({ request: { session: other, action: 'capability', family: 'sidecar', operation: 'read_working', input: {} } })
    .result.result.working,
  null,
);
otherOwner.page.dispatchEvent(new Event('pagehide'));
await otherOwner.work;
nativeOwner.page.dispatchEvent(new Event('pagehide'));
await nativeOwner.work;
const report = {
  status: 'PASS',
  evidence: 'compiled Browser AOT native Sidecar entry, file result branches and working-version publication branches',
  cases: [
    'current state clone',
    'pointer removes stat and preserves unknown',
    'stale version no publication',
    'working version increment',
    'working read isolation',
    'expected version rejected',
    'matching version published',
    'other chat snapshot ignored',
    'owner mismatch rejected before pointer write',
    'prompt present and clear',
    'valid generated ID',
    'same-stack file request and found',
    '404 no text read',
    'invalid JSON',
    'HTTP and text failures rejected',
    'UTF-8 record upload',
    'binding guard before upload',
    'instance state isolation',
  ],
};
console.log(JSON.stringify(report));
