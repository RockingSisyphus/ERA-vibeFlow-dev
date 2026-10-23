/** 从正式接线和真实Service AOT验证命名入口的执行隔离与实例生命周期。 */
import assert from 'node:assert/strict';
import { fixture, asyncEntry, realService } from './native-fixture.mjs';
const events = [];
const owner = await fixture(realService, {
  runtimeOptions: { trace: 'full', onTrace: event => events.push(event) },
});
try {
  const identity = owner.caps['era.tavern.identity'].read({});
  assert.equal(typeof identity?.then, 'undefined');
  assert.equal(identity.chatId, 'chat');
  const admission = owner.client.enqueue('named-entry-probe', 'era-api', []);
  assert.equal(admission.accepted, true);
  assert.equal((await admission.done).status, 'ignored');
  const trace = [];
  await asyncEntry(
    { request: { action: 'wait_startup', session: owner.session } },
    { entry: 'operation', trace: 'full', onTrace: event => trace.push(event) },
  );
  assert.ok(trace.some(event => event.kind === 'node_start' && event.nodeId === 'finish'));
  assert.ok(!trace.some(event => event.kind === 'node_start' && event.nodeId.startsWith('runtime_')));
  assert.ok(!events.some(event => event.kind === 'node_start' && event.blockPath === '/' && event.nodeId === 'begin'));
  await assert.rejects(asyncEntry({ request: { action: 'wait_startup', session: null } }, { entry: 'operation' }));
  await assert.rejects(asyncEntry({ request: {} }, {}));
  await assert.rejects(asyncEntry({ request: {} }, { entry: 'missing' }));
  assert.equal(owner.disposed(), 0);
} finally {
  owner.page.dispatchEvent(new Event('pagehide'));
  await owner.work;
}
assert.equal(owner.disposed(), 1);
assert.equal(
  [...owner.handlers.values()].reduce((sum, handlers) => sum + handlers.size, 0),
  0,
);
console.log('PASS: operation/runtime入口隔离、同步合同、真实Service回执、错误入口拒绝与pagehide清理');
