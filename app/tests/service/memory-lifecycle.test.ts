import { describe, expect, it } from 'vitest';
import { contextWith, identity, sidecarId } from './memory-lifecycle-fixture';
import { run as advance } from '../../../javascript_project/service/nodes/sync/drive_message_blocks';
import {
  PrepareBlockWorkNode as prepareWork,
  PublishBlockApplicationNode as publish,
} from '../../../javascript_project/service/nodes/sync/shared_block_state_adapters';
import { recordFor } from '../../../javascript_project/service/base_lib/sidecar_binding';
import { applySealedCommandCompactionToWork } from '../../../javascript_project/service/base_lib/sync/command_compaction';
import { overlayWorkingMessages } from '../../../javascript_project/service/base_lib/working_state';

import { run as prepareApi } from '../../../javascript_project/service/nodes/api/prepare_api_blocks';
import { run as receipt } from '../../../javascript_project/service/nodes/api/return_applied_receipt';
import {
  buildTransaction,
  inspectWindow,
  validateCommit,
} from '../../../javascript_project/service/base_lib/facade_api_engine';

import { execute } from './memory-batch-fixture';

describe('内存块执行与批次保存', () => {
  it('100块即时更新工作状态，聊天和Sidecar各保存一次', async () => {
    const result = await execute('<VariableEdit>{"hp":{"$expr":"hp+1"}}</VariableEdit>'.repeat(100));
    expect(result.snapshots[0].record.state.statData.hp).toBe(101);
    expect(result.working.record.state.statData.hp).toBe(200);
    expect(result.writes).toHaveLength(1);
    expect(result.saves).toHaveLength(1);
    expect(result.writes[0].updates[0].message).not.toContain('<era_block');
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].notifySubscribers).toBe(false);
    expect(result.snapshots.at(-1).notifySubscribers).toBe(true);
    expect(result.working.dirty).toBe(false);
  });
  it('消息起点变量和函数快照不被内存发布改变', async () => {
    const text =
      '<FunctionEdit>{"f":{"params":["x"],"expr":"x*3"}}</FunctionEdit><VariableEdit>{"hp":70}</VariableEdit><VariableEdit>{"hp":{"$expr":"@f(@hp)"}}</VariableEdit>';
    const context = contextWith(text);
    context.variablesRaw.statFunc = { f: { params: ['x'], expr: 'x*2' } };
    const result = await execute(text, { context });
    expect(result.working.record.state.statData.hp).toBe(200);
  });
  it('未注册函数报错并标done，继续后面的普通操作', async () => {
    const result = await execute(
      '<VariableEdit>{"hp":70}</VariableEdit><EraFCall name="missing"/><VariableEdit>{"hp":5}</VariableEdit>',
    );
    expect(result.outcome.status).toBe('committed');
    expect(result.saves[0].state.statData.hp).toBe(5);
    expect(result.writes[0].updates[0].message).toContain('status="done"');
  });
  it('保存失败保留已应用工作状态和待保存记录', async () => {
    const result = await execute('<VariableEdit>{"hp":70}</VariableEdit>', { failSave: true });
    expect(result.outcome.status).toBe('failed');
    expect(result.working.dirty).toBe(true);
    expect(result.working.record.state.statData.hp).toBe(70);
    expect(result.notifications).toHaveLength(0);
  });
  it('待保存消息投影拒绝不同Swipe和用户编辑', () => {
    const original = { messageId: 0, role: 'assistant', swipeIndex: 0, activeText: 'old' };
    const working: any = {
      dirty: true,
      sourceBasis: { messages: [original] },
      work: { plan: { messageUpdates: [{ messageId: 0, content: { kind: 'text', text: 'new' } }] } },
    };
    expect(overlayWorkingMessages({ messages: [original] }, working).messages[0].activeText).toBe('new');
    for (const changed of [
      { ...original, swipeIndex: 1 },
      { ...original, activeText: 'edited' },
    ]) {
      expect(overlayWorkingMessages({ messages: [changed] }, working).messages[0]).toEqual(changed);
    }
  });
});

it('连续API共享未保存记录，第二次表达式基于第一次的结果', async () => {
  const context = contextWith('正文');
  const execution: any = {
    schemaVersion: 1,
    nextState: {
      consecutiveMk: null,
      consecutiveProcessingCount: 0,
      scopeWindow: { token: null, messageId: null, messageAdmission: null, branchAdmission: null },
    },
  };
  let working: any = {
    version: 0,
    dirty: false,
    record: recordFor(
      sidecarId,
      identity,
      {
        statData: { hp: 100 },
        statFunc: {},
        eraMeta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
      },
      null,
    ),
  };
  const capabilities = {
    'era.lifecycle.admission': { schedule: () => ({ status: 'scheduled' }) },
    'era.tavern.sidecar': {
      read_working: () => ({ working }),
      write_working: (input: any) => {
        working = { ...input, version: working.version + 1 };
        return { working };
      },
    },
  };
  const original = context.step.dispatchContext;
  for (const amount of [10, 20]) {
    const messages = overlayWorkingMessages({ messages: original.sourceBasis.messages }, working).messages;
    const task = { ...context.step.task, kind: 'api', eventType: 'era.facade.commit', args: [] };
    const request = {
      task,
      sources: context.step.sources,
      dispatchContext: {
        ...original,
        dispatchClass: 'api',
        processingMessage: { ...original.processingMessage, activeText: messages[0].activeText },
        stagedMessageUpdates: [],
      },
      detail: { scope: 'always', windowToken: 7, operations: [{ edit: { hp: { $expr: `hp-${amount}` } } }] },
    };
    const inspected = inspectWindow(
      request,
      execution,
      { ...identity, lifecycleToken: 7 },
      { schemaVersion: 2, messages },
    );
    const validated: any = validateCommit(inspected);
    expect(validated.route).toBe('commit');
    const transaction = buildTransaction(validated.context);
    let state = prepareApi({ 'era.api.commit.target': { value: transaction } }, {}, { capabilities }).block_step_state;
    for (let count = 0; !state.done; count++) {
      if (count > 20) throw new Error('API stalled');
      const pending = (await advance({ 'era.sync.block.step.state': { value: state } }, {}, { capabilities }))
        .block_step_pending;
      const work = prepareWork({ 'era.sync.block.step.pending': { value: pending } }).expression_command_result;
      state = publish(
        { 'era.command_compaction.result': { value: applySealedCommandCompactionToWork(work) } },
        {},
        { capabilities },
      ).block_step_state_after;
    }
    const result = receipt(
      { 'era.sync.block.step.state.next': { value: state } },
      {},
      { capabilities },
    ).facade_commit_result;
    expect(result.status).toBe('committed');
    expect(result.settlements[0].status).toBe('completed');
    execution.nextState = { ...execution.nextState, ...result.stateUpdate };
  }
  expect(working.record.state.statData.hp).toBe(70);
  expect(working.dirty).toBe(true);
  expect(working.work.plan.messageUpdates[0].content.text.match(/<era_tx /g)).toHaveLength(2);
});
