import { run as seedCandidate } from '../../../javascript_project/service/nodes/agent/candidate_seed';
import { recordFor } from '../../../javascript_project/service/base_lib/sidecar_binding';
import { sidecarId, contextWith, identity } from './memory-lifecycle-fixture';
import { classifyGeneration } from '../../../javascript_project/service/base_lib/agent/agent_flow_policy';
import { expect, it } from 'vitest';
import { run } from '../../../javascript_project/service/nodes/agent/prepare_auxiliary_execution_request';
import { planEraSync } from '../../../javascript_project/service/base_lib/sync/sync_planning';
import { readMkMessageText } from '../../../javascript_project/service/base_lib/domain/mk_engine';

it.each([
  ['settlement', 70, false],
  ['story', 80, false],
  ['planning', 100, false],
  ['regenerate', 100, false],
  ['planning', 40, true],
] as const)('%s 请求从保留阶段恢复变量和函数库，不依赖模型历史或既有楼层上下文', async (kind, expected, stale) => {
  const planning =
    '<VariableEdit>{"hp":80}</VariableEdit><FunctionInsert>{"candidateFn":{"params":[],"expr":"42"}}</FunctionInsert>';
  const story = '<EraFCall name="body" status="done"/><era_tx s="a"><VariableEdit>{"hp":70}</VariableEdit></era_tx>';
  const settlement = '<era_tx s="a"><VariableEdit>{"hp":40}</VariableEdit></era_tx>';
  const base = planEraSync({
    messages: [
      {
        messageId: 0,
        role: 'assistant',
        content: { kind: 'text', text: '<VariableInsert>{"hp":100}</VariableInsert>' },
      },
      { messageId: 1, role: 'assistant', content: { kind: 'text', text: planning + story + settlement } },
    ],
    mkSeedsByIndex: [
      { timestamp: 1, token: 'base0000' },
      { timestamp: 2, token: 'body0000' },
    ],
    stat: {},
    statFunc: {},
    meta: {},
    reason: 'manual',
    processingMk: null,
    consecutiveState: null,
  });
  expect(base.stat).toEqual({ hp: 40 });
  const { step } = contextWith(planning + story + settlement);
  step.taskRoute = 'agent-generation-session';
  step.task.primaryEvent.type = kind === 'regenerate' ? 'generation_started' : 'era.ui.agent_retry';
  step.task.primaryEvent.args = [
    { kind: 'json', value: kind === 'regenerate' ? kind : { kind, ...(stale ? { requestId: 'obsolete' } : {}) } },
  ];
  step.dispatchContext.messages = base.messages.map(m => ({
    messageId: m.messageId,
    role: m.role,
    activeText: readMkMessageText(m),
    swipeIndex: 0,
  }));
  step.dispatchContext.floorIdentity = {
    chatId: identity.chatId,
    messageId: 1,
    swipeId: 0,
    mk: (base.meta.SelectedMks as string[])[1],
  };
  if (kind === 'regenerate') step.dispatchContext.floorIdentity = null;
  const original = {
    identity,
    configuration: { planning: { enabled: true } },
    session: { planningDraft: planning, story, transaction: settlement },
    messages: [],
    latestMessage: { message_id: 1, role: 'assistant', message: planning + story + settlement },
    state: { statData: base.stat, statFunc: base.statFunc, eraMeta: base.meta },
  };
  const result = await run(
    { 'era.step.request.routed': { value: step } },
    {},
    {
      capabilities: {
        'era.tavern.agent': { read_context: async () => original },
      },
    },
  );
  expect(result.generation_facts.context.state.statData).toEqual({ hp: expected });
  expect(original.state.statData).toEqual({ hp: 40 });
  if (stale) {
    expect(result.generation_facts.context).not.toHaveProperty('stageBaseline');
    expect(classifyGeneration(result.generation_facts).disposition).toMatchObject({ status: 'failed' });
    return;
  }
  expect(result.generation_facts.context.state.statFunc).toEqual(
    kind === 'planning' || kind === 'regenerate' ? {} : { candidateFn: { params: [], expr: '42' } },
  );
  if (kind === 'regenerate')
    expect(result.generation_facts.identity.mk).not.toBe((base.meta.SelectedMks as string[])[1]);
  let working: any = { version: 3, dirty: false, record: recordFor(sidecarId, identity, original.state, null) };
  let savedSession: any;
  const seeded = seedCandidate(
    {
      'era.agent.generation.request': { value: { phase: 'execute', context: result.generation_facts.context } },
      'era.step.request.routed': { value: step },
      'era.batch.execution.state': { value: { schemaVersion: 1, nextState: {} } },
    },
    {},
    {
      capabilities: {
        'era.tavern.sidecar': {
          read_working: () => ({ working }),
          write_working: (input: any) => {
            working = { ...input, version: working.version + 1 };
          },
        },
        'era.tavern.agent': {
          read_session_binding: () => ({ active: false, previous: original.session }),
          write_session: (input: any) => {
            savedSession = input.session;
          },
        },
      },
    },
  );
  expect(seeded.candidate_state.request.phase).toBe('execute');
  expect(working.record.state.statData).toEqual({ hp: expected });
  expect(working.dirty).toBe(true);
  expect(working.work.plan.messageUpdates.at(-1).content.text).not.toContain('"hp":40');
  expect(savedSession.status).toBe('unsettled');
  if (kind === 'settlement') expect(savedSession.stageMemory.content).toContain('status="done"');
});

it('无法恢复结算基线时形成可恢复任务失败，不继续生成或抛成服务致命异常', () => {
  const diagnostic = { code: 'ERA_AGENT_STAGE_BASELINE_FAILED', message: 'missing rollback evidence' };
  const result = classifyGeneration({ diagnostics: [diagnostic] } as any);
  expect(result.phase).toBe('finish');
  expect(result.disposition).toMatchObject({ mode: 'execute-only', status: 'failed', diagnostics: [diagnostic] });
});
