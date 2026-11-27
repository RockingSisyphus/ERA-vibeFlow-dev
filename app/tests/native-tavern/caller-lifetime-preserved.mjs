import {encodePacket,decodePacket} from '../../../base_lib/workflow_values/codec.mjs';
/** 通过真实主 Service AOT 验证跨 Node 的作者调用。 */
import assert from 'node:assert/strict';
import { nativeG3 } from './g3-fixture.mjs';
import { realService, deferred } from './native-fixture.mjs';
import { setTimeout as delay } from 'node:timers/promises';

const trace = [];
let observedCall;
let holdNotifications = false;
const fake = await nativeG3(
  {
    runWorkflowAsync: (inputs, options) => {
      const native=options.workflowSession;
      return realService(inputs,{...options,workflowSession:{
        ...native,
        invoke_sync:(request,callOptions)=>{const input=decodePacket(request.inputs.wire_request),result=native.invoke_sync(request,callOptions);if(input.capability==='era.tavern.functions'&&input.operation==='begin')observedCall=owner.session.functionCalls.get(input.input.id);return result;},
        // 在真实原生Send边界注入受控通知，保持同一消息身份与接收工作流。
        send:(request,callOptions)=>{let payload=decodePacket(request.payload);if(holdNotifications&&payload.value?.kind==='batch-result')payload={...payload,value:{...payload.value,notifications:[...payload.value.notifications,{type:'native-probe-notification',args:[]}]}};return native.send({...request,payload:encodePacket(payload)},callOptions);}
      }});

    },
  },
  trace,
);
const { owner } = fake;
let invoked = 0;
let committed = 0;
let retained;
const notificationGate = deferred();
const heldNotifications = [];
const emit = owner.api.eventEmit;
owner.api.eventEmit = (...args) => {
  if (!holdNotifications) return emit(...args);
  heldNotifications.push(args[0]);
  return notificationGate.promise.then(() => emit(...args));
};
owner.session.createFunctionFacade = (submit, assertActive) => ({
  commit: operations => {
    assertActive();
    return submit('era.facade.commit', { scope: 'always', operations, windowToken: 1 });
  },
});
owner.api.SillyTavern.ToolManager = {
  invokeFunctionTool: async (_name, args) => {
    invoked++;
    assert.equal(observedCall?.active,true);
    assert.equal(observedCall?.signal.aborted,false);
    retained = owner.client.forCall(args);
    const result = await retained.commit([{ insert: { nativeLifetimeProbe: { value: 11 } } }]);
    assert.equal(result.status, 'completed');
    committed++;
  },
};
async function submit(type, source, args = []) {
  const admission = fake.emit({ type, source, args, occurredAt: Date.now() });
  assert.equal(admission.accepted, true);
  const outcome = await admission.done;
  assert.equal(outcome.status, 'completed', JSON.stringify(outcome));
}
try {
  await submit('app_ready', 'tavern');
  await submit('era.ui.initialize_resources', 'ui', [{ mode: 'traditional' }]);
  await owner.api.setChatMessages([{ message_id: 0, message: '<erafcall name="native_lifetime" />' }]);
  holdNotifications = true;
  await submit('era.facade.sync', 'era-api', [{ mode: 'full' }]);
  assert.equal(invoked, 1);
  assert.equal(committed, 1);
  assert.equal(owner.session.functionCalls.size, 0);
  assert.throws(
    () => retained.commit([]),
    error => error.cause?.message === 'ERA_FUNCTION_CONTEXT_EXPIRED',
  );
  await delay(0);
  assert.ok(heldNotifications.length > 0, '发送Node的受控通知必须进入原生通知路径');
  const groups = [...owner.session.notificationGroups];
  assert.ok(groups.length > 0, '未完成的通知必须仍受资源Node持有');
  assert.ok(
    groups.every(group => !group.linked.signal.aborted),
    '发送Node返回不能取消未完成通知',
  );
  const completions = groups.map(group => group.completion.promise);
  notificationGate.resolve();
  await Promise.all(completions);
  assert.equal(owner.session.notificationGroups.size, 0);
  holdNotifications = false;

  // Helper直接改正文不一定发编辑事件；原保护拒绝写入后，必须由Main自动重新同步。
  const resynchronized = deferred();
  owner.session.storeWorkingState = working => {
    if (!working.dirty && working.record.state.statData.nativeHostEditProbe === 70) resynchronized.resolve();
  };
  let staleCommitRejected = false;
  owner.api.SillyTavern.ToolManager.invokeFunctionTool = async (_name, args) => {
    await owner.api.setChatMessages([
      { message_id: 0, message: '<VariableInsert>{"nativeHostEditProbe":70}</VariableInsert>' },
    ]);
    try {
      await owner.client.forCall(args).commit([{ edit: { nativeHostEditProbe: 999 } }]);
    } catch {
      staleCommitRejected = true;
    }
  };
  await owner.api.setChatMessages([
    {
      message_id: 0,
      message: '<VariableInsert>{"nativeHostEditProbe":100}</VariableInsert><erafcall name="native_host_edit" />',
    },
  ]);
  const changed = await fake.emit({
    type: 'era.facade.sync',
    source: 'era-api',
    args: [{ mode: 'full' }],
    occurredAt: Date.now(),
  }).done;
  assert.equal(staleCommitRejected, true);
  assert.equal(changed.status, 'failed');
  assert.equal(changed.error.code, 'ERA_MESSAGE_WRITE_TARGET_CHANGED');
  let timeout;
  try {
    await Promise.race([
      resynchronized.promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('未按原分支自动重新同步被作者改动的正文')), 3000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  assert.equal(fake.snapshot().workbenchRecord.state.statData.nativeHostEditProbe, 70);
  console.log(
    JSON.stringify({
      status: 'PASS',
      cases: [
        '真实主Service启动Node返回后，作者工具仍完成提交、回执、终态与上下文释放',
        '实际Port发送Node返回后，异步通知继续完成并释放',
        '真实作者改动正文后拒绝陈旧提交，并按原错误事实自动同步新正文、清除dirty',
      ],
    }),
  );
} finally {
  notificationGate.resolve();
  owner.page.dispatchEvent(new Event('pagehide'));
  await owner.work;
}
