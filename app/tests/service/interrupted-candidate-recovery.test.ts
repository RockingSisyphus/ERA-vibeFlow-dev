import { expect, it, vi } from 'vitest';
import { run as inspect } from '../../../javascript_project/service/nodes/sidecar/inspect_current';
import { contextWith, identity, sidecarId } from './memory-lifecycle-fixture';
import { recordFor } from '../../../javascript_project/service/base_lib/sidecar_binding';
import { workingCapabilityFixture } from './working-capability-fixture';

it.each([false, true])('返回候选中断的聊天先恢复起点，正文被编辑=%s 时拒绝旧待写文本', async edited => {
  const sync = contextWith('original');
  sync.variablesRaw = { identity, meta: { SidecarId: sidecarId }, stat: null };
  const sourceBasis = structuredClone(sync.step.dispatchContext.sourceBasis);
  const baseline = {
    record: recordFor(sidecarId, identity, { statData: { hp: 100 }, statFunc: {}, eraMeta: {} }, null),
    work: { pending: 'earlier-stage' },
    sourceBasis,
    dirty: true,
    stage: { phase: 'story', messageId: 1 },
  };
  const retainedSession = { status: 'unsettled', story: 'retained body', pendingStage: null };
  const writeSession = vi.fn();
  const clearSession = vi.fn();
  const fixture = workingCapabilityFixture();
  fixture.write_working({
    ...baseline,
    record: recordFor(sidecarId, identity, { statData: { hp: 70 }, statFunc: { temporary: {} }, eraMeta: {} }, null),
    stage: { phase: 'settlement', candidateRecovery: { working: baseline, session: retainedSession } },
  });
  if (edited) sync.step.dispatchContext.sourceBasis.messages[0].activeText = 'user edit';
  const current = { identity, meta: { SidecarId: sidecarId }, stat: null };
  const result = await inspect(
    { 'era.sync.context': { value: sync } },
    {},
    {
      capabilities: {
        'era.tavern.agent': {
          read_session_binding: () => ({ active: false, previous: null }),
          write_session: writeSession,
          clear_session: clearSession,
        },
        'era.tavern.sidecar': {
          ...fixture,
          read_current: async () => current,
          read_record: async () => {
            throw new Error('must use pending memory');
          },
        },
      },
    },
  );
  expect(result.sidecar_binding_facts.status).toBe('matched');
  const restored = fixture.read_working().working;
  expect(restored.record.state.statData).toEqual({ hp: 100 });
  expect(restored.record.state.statFunc).toEqual({});
  expect(restored.stage?.candidateRecovery).toBeUndefined();
  expect(restored.work).toEqual(edited ? null : baseline.work);
  expect(restored.sourceBasis).toEqual(edited ? null : sourceBasis);
  if (edited) {
    expect(clearSession).toHaveBeenCalledWith({ chatKey: identity.chatId });
    expect(writeSession).not.toHaveBeenCalled();
  } else {
    expect(writeSession).toHaveBeenCalledWith(
      expect.objectContaining({ chatKey: identity.chatId, session: retainedSession }),
    );
    expect(clearSession).not.toHaveBeenCalled();
  }
});

it('取消后保留早期已完成阶段的待写记录，后续同步按原版本保存', async () => {
  const { run: finish } = await import('../../../javascript_project/service/nodes/agent/finish_stage_blocks');
  const fixture = workingCapabilityFixture();
  fixture.write_working({
    record: recordFor(sidecarId, identity, { statData: { hp: 70 }, statFunc: {}, eraMeta: {} }, null),
    work: { pending: 'retained body without old settlement' },
    sourceBasis: contextWith('old settlement').step.dispatchContext.sourceBasis,
    dirty: true,
    stage: { phase: 'story', messageId: 1 },
  });
  const before = fixture.read_working().working;
  const schedule = vi.fn();
  finish(
    {
      'era.sync.block.step.state.next': {
        value: {
          stageOutcome: { value: { status: 'generation-cancelled' }, stageWorkInput: { session: {} } },
        },
      },
    },
    {},
    { capabilities: { 'era.tavern.sidecar': fixture, 'era.lifecycle.admission': { schedule } } },
  );
  expect(fixture.read_working().working).toEqual(before);
  expect(schedule).toHaveBeenCalledWith(
    expect.objectContaining({ event: expect.objectContaining({ type: 'era.facade.sync' }) }),
  );
});

it('恢复点读取期间切聊天，不提交旧聊天的变量或阶段会话', async () => {
  const sync = contextWith('original');
  sync.variablesRaw = { identity, meta: { SidecarId: sidecarId }, stat: null };
  const fixture = workingCapabilityFixture();
  const baseline = {
    record: recordFor(sidecarId, identity, { statData: { hp: 100 }, statFunc: {}, eraMeta: {} }, null),
    sourceBasis: sync.step.dispatchContext.sourceBasis,
    dirty: true,
    work: null,
    stage: null,
  };
  fixture.write_working({
    ...baseline,
    stage: { candidateRecovery: { working: baseline, session: { story: 'old' } } },
  });
  const before = fixture.read_working().working;
  const write = vi.fn();
  let reads = 0;
  const result = await inspect(
    { 'era.sync.context': { value: sync } },
    {},
    {
      capabilities: {
        'era.tavern.sidecar': {
          ...fixture,
          read_current: async () => ({
            identity: ++reads === 1 ? identity : { ...identity, chatId: 'other' },
            meta: { SidecarId: sidecarId },
            stat: null,
          }),
          read_record: async () => {
            throw new Error('unexpected disk read');
          },
        },
        'era.tavern.agent': {
          read_session_binding: () => ({ active: false, previous: null }),
          write_session: write,
          clear_session: write,
        },
      },
    },
  );
  expect(result.sidecar_binding_input.sync.status).toBe('failed');
  expect(fixture.read_working().working).toEqual(before);
  expect(write).not.toHaveBeenCalled();
});

it('规划完成但AI楼层尚未创建时取消，丢弃未来文本并由历史日志撤销其效果', async () => {
  const { run: finish } = await import('../../../javascript_project/service/nodes/agent/finish_stage_blocks');
  const { planEraSync } = await import('../../../javascript_project/service/base_lib/sync/sync_planning');
  const { overlayWorkingMessages } = await import('../../../javascript_project/service/base_lib/working_state');
  const messages = [
    {
      messageId: 0,
      role: 'assistant',
      content: { kind: 'text' as const, text: '<VariableInsert>{"hp":100}</VariableInsert>' },
    },
  ];
  const base = planEraSync({
    messages,
    mkSeedsByIndex: [{ timestamp: 1, token: 'base0000' }],
    stat: {},
    statFunc: {},
    meta: {},
    reason: 'manual',
    processingMk: null,
    consecutiveState: null,
  });
  const plan = planEraSync({
    messages: [
      ...base.messages,
      {
        messageId: 1,
        role: 'assistant',
        content: {
          kind: 'text',
          text: '<VariableEdit>{"hp":70}</VariableEdit><FunctionInsert>{"draftFn":{"params":[],"expr":"1"}}</FunctionInsert>',
        },
      },
    ],
    mkSeedsByIndex: [
      { timestamp: 1, token: 'base0000' },
      { timestamp: 2, token: 'draft000' },
    ],
    stat: base.stat,
    statFunc: base.statFunc,
    meta: base.meta,
    reason: 'manual',
    processingMk: null,
    consecutiveState: null,
  });
  expect(base.stat).toEqual({ hp: 100 });
  expect(plan.stat).toEqual({ hp: 70 });
  const source = {
    messages: base.messages.map(m => ({
      messageId: m.messageId,
      role: m.role,
      activeText: (m.content as any).text,
      swipeIndex: 0,
    })),
  };
  const fixture = workingCapabilityFixture();
  fixture.write_working({
    record: recordFor(sidecarId, identity, { statData: plan.stat, statFunc: plan.statFunc, eraMeta: plan.meta }, null),
    work: { plan },
    dirty: true,
    sourceBasis: { identity, ...source },
    stage: { phase: 'planning', messageId: 1, mk: (plan.meta.SelectedMks as Record<string, string>)[1] },
  });
  const schedule = vi.fn();
  finish(
    {
      'era.sync.block.step.state.next': {
        value: {
          stageOutcome: {
            value: { status: 'generation-cancelled' },
            stageWorkInput: { session: {}, step: { dispatchContext: { sourceBasis: source } } },
          },
        },
      },
    },
    {},
    { capabilities: { 'era.tavern.sidecar': fixture, 'era.lifecycle.admission': { schedule } } },
  );
  const working = fixture.read_working().working;
  expect(overlayWorkingMessages(source, working).messages).toHaveLength(1);
  expect(working.stage).toBeNull();
  expect(working.work).toBeNull();
  const replay = planEraSync({
    messages: base.messages,
    stat: working.record.state.statData,
    statFunc: working.record.state.statFunc,
    meta: working.record.state.eraMeta,
    reason: 'manual',
    processingMk: null,
    consecutiveState: null,
  });
  expect(replay.stat).toEqual({ hp: 100 });
  expect(replay.statFunc).toEqual({});
  expect(schedule).toHaveBeenCalledOnce();
});
