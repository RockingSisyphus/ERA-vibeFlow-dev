import { businessWorkflowNode } from './business-workflow-node';
import { run as prepareWork } from './prepare-block-work-fixture';
import { expect, it } from 'vitest';
import { contextWith, identity, sidecarId } from './memory-lifecycle-fixture';
import { recordFor } from '../../../javascript_project/service/base_lib/sidecar_binding';
import { run as advance } from './message-block-fixture';
import { parsePlanningOutput } from '../../../javascript_project/service/base_lib/agent/agent_generation_session';
const edit = (value: unknown) => `<VariableEdit>${JSON.stringify({ hp: value })}</VariableEdit>`;
async function execute(stage: string, text: string, extra: any = {}) {
  const context = contextWith('previous');
  let session: any = {
    baseMessage: '',
    sourceKey: 'candidate',
    planningAttempts: [{ attempt: 0, response: text }],
    ...(stage === 'planning'
      ? {
          plan: parsePlanningOutput(text),
          planningDraft: [parsePlanningOutput(text).instructionsBefore, parsePlanningOutput(text).instructionsAfter]
            .filter(Boolean)
            .join('\n'),
        }
      : { pendingStage: { candidate: { content: text } }, settlementAttempts: [{ attempt: 0, response: text }] }),
    ...extra,
  };
  const initial = recordFor(
    sidecarId,
    identity,
    {
      statData: { hp: 100 },
      statFunc: {},
      eraMeta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
    },
    null,
  );
  let working: any = { version: 0, record: initial, dirty: false, work: null, sourceBasis: null };
  const snapshots: number[] = [];
  const capabilities = {
    'era.tavern.sidecar': {
      read_working: () => ({ working: structuredClone(working) }),
      write_working: (input: any) => {
        working = { ...input, version: working.version + 1 };
        snapshots.push(working.record.state.statData.hp);
      },
    },
    'era.tavern.agent': {
      read_session_binding: () => ({ previous: session, active: false }),
      write_session: (input: any) => {
        session = input.session;
      },
      clear_session: () => {
        session = null;
      },
    },
  };
  const outcome = {
    stageBoundary: { stage, result: {} },
    stageWorkInput: {
      step: context.step,
      session,
      executionState: {
        schemaVersion: 1,
        nextState: { consecutiveMk: null, consecutiveProcessingCount: 0, scopeWindow: {} },
      },
      request: {
        trigger: { kind: 'normal', type: 'generation_started', eventId: 'candidate' },
        identity: stage === 'planning' ? null : { messageId: 1, swipeId: 0, mk: 'settle-mk' },
        context: { identity, session: null },
      },
    },
  };
  let state = (
    await businessWorkflowNode(
      'era.lifecycle.prepare_stage_blocks',
      { 'era.agent.generation.raw': { value: outcome } },
      {},
      { capabilities },
    )
  ).block_step_state;
  for (let count = 0; !state.done; count++) {
    if (count > 100) throw new Error('candidate stalled');
    const pending = (await advance({ 'era.sync.block.step.state': { value: state } }, {}, { capabilities }))
      .block_step_pending;
    const work = prepareWork({ 'era.sync.block.step.pending': { value: pending } }).expression_command_result;
    state = (
      await businessWorkflowNode(
        'era.lifecycle.publish_block_application',
        { 'era.command_compaction.result': { value: work } },
        {},
        { capabilities },
      )
    ).block_step_state_after;
  }
  const result = (
    await businessWorkflowNode(
      'era.lifecycle.finish_stage_blocks',
      { 'era.sync.block.step.state.next': { value: state } },
      {},
      { capabilities },
    )
  ).applied_generation_outcome;
  return { state, working, session, result, snapshots, initial };
}
it('规划前缀创建函数，JSON calls读取新函数，后缀随后执行', async () => {
  const text =
    '<FunctionInsert>{"answer":{"params":[],"expr":"42"}}</FunctionInsert>' +
    '{"storyPlan":{},"calls":[{"function":"answer","args":[]}]}' +
    edit(70);
  const result = await execute('planning', text);
  expect(result.result.status).not.toBe('failed');
  expect(result.session.functionResults[0].result).toBe(42);
  expect(result.working.record.state.statData.hp).toBe(70);
});
it('候选操作失败撤销已发布的前缀和日志，不执行后缀，不发送阶段交接', async () => {
  const result = await execute('settlement', edit(70) + edit({ $expr: 'unknownFunction()' }) + edit(10));
  expect(result.snapshots).toContain(70);
  expect(result.snapshots).not.toContain(10);
  expect(result.working.record).toEqual(result.initial);
  expect(result.working.dirty).toBe(false);
  expect(result.result).not.toHaveProperty('stageBoundary');
  expect(result.result.retryGeneration.context.candidateRetry.nextAttempt).toBe(1);
});
it('规划无前缀也执行JSON calls，不跳过空块边界', async () => {
  const result = await execute('planning', '{"storyPlan":{},"calls":[{"function":"max","args":[2,5]}]}');
  expect(result.session.functionResults[0].result).toBe(5);
});
it('重开恢复的开头只有空行时，规划落稿不把空行当成历史变化', async () => {
  const result = await execute('planning', '{"storyPlan":{},"calls":[]}', {
    baseMessage: '\n',
    planningDraft: '',
  });
  expect(result.result.status).not.toBe('failed');
  expect(result.session.planningDraft).toBe('');
  expect(result.result).toHaveProperty('stageBoundary');
});
