import { describe, expect, it, vi } from 'vitest';
import { run as execute } from '../../../javascript_project/service/nodes/agent/execute_generation_session';
import { run as handoff } from '../../../javascript_project/service/nodes/agent/prepare_stage_handoff';
import { normalizeAgentConfiguration } from '../../../javascript_project/service/base_lib/agent_generation_session';

/** 按真实阶段恢复入口推进，明确在两次 Node 执行之间改变宿主事实。 */
function fixture() {
  const configuration = normalizeAgentConfiguration({
    schemaVersion: '2',
    planning: { enabled: true },
    settlement: { enabled: true },
  });
  let session: Record<string, unknown> = {
    chatKey: 'chat',
    status: 'planned',
    execution: { id: 'cycle', trigger: 'initial' },
    configuration,
    plan: { storyPlan: { scene: 'room' }, calls: [] },
    functionResults: [],
    planReport: '<era_plan>{"plan":{"storyPlan":{"scene":"room"},"calls":[]},"functionResults":[]}</era_plan>',
    baseMessage: '',
  };
  const state = { revision: 1, statData: { hp: 14 }, statFunc: {} };
  const latest = { message_id: 1, swipe_id: 0, role: 'assistant', message: 'story', extra: {} };
  const identity = { chatId: 'chat', messageId: 1, swipeId: 0, mk: 'mk' };
  const generate = vi.fn(async (_request: Record<string, unknown>) => ({
    response: '{"operations":[{"edit":{"hp":16}}]}',
    requestId: 'settle',
  }));
  const clearSession = vi.fn();
  const capability = {
    clear_session: clearSession,
    stop_native_generation: vi.fn(),
    generate,
    await_native_completion: async () => ({
      status: 'completed',
      executionId: 'cycle',
      identity: { chatId: 'chat' },
      latestMessage: { ...latest },
    }),
    read_session_binding: () => ({ active: false, previous: session }),
    write_session: (input: Record<string, unknown>) => {
      session = input.session as Record<string, unknown>;
    },
  };
  let index = 0;
  const step = async (resume?: string, cancelled = false) => {
    const request = {
      phase: resume ? 'resume' : 'story',
      configuration,
      trigger: {
        eventId: `event-${index++}`,
        type: resume ? 'era.agent.stage_continue' : 'message_received',
        retry: { completionId: resume, cancelled },
      },
      context: { identity: { chatId: 'chat' }, state, session, latestMessage: latest, messages: [latest] },
      identity,
      identityError: null,
    };
    const out = await execute({ 'era.agent.generation.request': { value: request } }, {}, {
      capabilities: { 'era.tavern.agent': capability },
    } as never);
    return handoff({ 'era.agent.generation.outcome': { value: out.generation_outcome } }).handoff_outcome;
  };
  return { step, state, latest, generate, identity, clearSession };
}

describe('actual Agent stage continuation', () => {
  it('waits before settlement, rereads variables and preserves callback transactions before AI operations', async () => {
    const f = fixture();
    const story = await f.step();
    expect(story.handoff.stage).toBe('story');
    expect(f.generate).not.toHaveBeenCalled();
    f.state.statData.hp = 15;
    f.latest.message += '<era_tx s="m"><VariableEdit>{"hp":15}</VariableEdit></era_tx>';
    const settlement = await f.step(story.handoff.completionId);
    expect(settlement.handoff).toMatchObject({ stage: 'settlement', result: { operations: [{ edit: { hp: 16 } }] } });
    expect(f.generate.mock.calls[0]?.[0].userInput).toContain('故事前变量：{"hp":15}');
    f.state.statData.hp = 17;
    f.latest.message += '<era_tx s="m"><VariableEdit>{"hp":17}</VariableEdit></era_tx>';
    const final = await f.step(settlement.handoff.completionId);
    expect(final.candidate.content).not.toContain('<era_update>');
    expect(final.candidate.content).not.toContain('"attempts"');
    expect(final.candidate.content.indexOf('"hp":15')).toBeLessThan(final.candidate.content.indexOf('"hp":16'));
    expect(final.candidate.content.indexOf('"hp":17')).toBeLessThan(final.candidate.content.indexOf('"hp":16'));
    expect(f.generate).toHaveBeenCalledOnce();
  });
  it('ignores repeated or wrong continuation identifiers', async () => {
    const f = fixture();
    await f.step();
    expect((await f.step('other-cycle')).handoff).toBeUndefined();
    expect(f.generate).not.toHaveBeenCalled();
  });
  it('adopts a first persisted MK instead of comparing provisional dispatch keys', async () => {
    const f = fixture();
    const story = await f.step();
    expect(story.handoff).not.toHaveProperty('mk');
    f.identity.mk = 'persisted';
    f.latest.message += '<span era-message-key="persisted"></span>';
    const settlement = await f.step(story.handoff.completionId);
    expect(settlement.handoff.mk).toBe('persisted');
    expect(f.generate).toHaveBeenCalledOnce();
    f.identity.mk = 'other-swipe';
    expect((await f.step(settlement.handoff.completionId)).candidate).toBeUndefined();
  });
  it('binds a final candidate to the actual dispatch identity when no earlier step persisted an MK', async () => {
    const f = fixture();
    const story = await f.step();
    f.identity.mk = 'second-provisional';
    const settlement = await f.step(story.handoff.completionId);
    f.identity.mk = 'final-provisional';
    const result = await f.step(settlement.handoff.completionId);
    expect(result.candidate.mk).toBe('final-provisional');
  });
  it('cancels an invalidated handoff without calling the following model', async () => {
    const f = fixture();
    const story = await f.step();
    const result = await f.step(story.handoff.completionId, true);
    expect(result.value).toEqual({ status: 'generation-cancelled' });
    expect(f.clearSession).toHaveBeenCalledWith({ chatKey: 'chat' });
    expect(f.generate).not.toHaveBeenCalled();
  });
});
