import { expect, it, vi } from 'vitest';
import { createCandidateRunner } from './agent-candidate-fixture';
import { contextWith, identity } from './memory-lifecycle-fixture';
import { normalizeAgentConfiguration } from '../../../javascript_project/service/base_lib/agent/agent_generation_session';

const edit = (value: unknown) => `<VariableEdit>${JSON.stringify({ hp: value })}</VariableEdit>`;
async function runCandidates(stage: 'planning' | 'settlement', responses: string[]) {
  const context = contextWith('story');
  const floor = { chatId: identity.chatId, messageId: 1, swipeId: 0, mk: 'candidate-floor' };
  let session: any =
    stage === 'settlement' ? { status: 'settled', messageId: 1, story: 'story', baseMessage: '' } : null;
  const requests: any[] = [];
  const generate = vi.fn(async (request: any) => {
    requests.push(request);
    return { response: responses[requests.length - 1], requestId: `request-${requests.length}` };
  });
  const stop = vi.fn();
  const host = {
    generate,
    read_session_binding: () => ({ active: false, previous: session }),
    write_session: (input: any) => {
      session = input.session;
    },
    clear_session: () => {
      session = null;
    },
    stop_native_generation: stop,
    create_error_message: vi.fn(async () => {}),
    inject_once: vi.fn(),
  };
  const initial = {
    identity,
    session,
    state: { statData: { hp: 100 }, statFunc: {}, eraMeta: {} },
    latestMessage: { message_id: 1, role: stage === 'planning' ? 'user' : 'assistant', message: 'story' },
  };
  const request = {
    phase: 'execute',
    context: initial,
    identity: stage === 'planning' ? null : floor,
    configuration: normalizeAgentConfiguration({
      planning: { enabled: true, retryCount: 1 },
      settlement: { enabled: true, retryCount: 1 },
    }),
    trigger: {
      eventId: 'candidate-retry',
      sequence: 1,
      kind: 'normal',
      type: stage === 'planning' ? 'message_sent' : 'era.ui.agent_retry',
      retry: { kind: 'settlement' },
    },
  };
  const execute = createCandidateRunner(
    context.step,
    { nextState: {} },
    { capabilities: { 'era.tavern.agent': host } },
    initial,
  );
  const result = await execute(request);
  return { ...result, session, requests, stop };
}
it('规划整次候选回退变量和函数库，再请求完整候选；没有中间阶段完成', async () => {
  const result = await runCandidates('planning', [
    edit(70) +
      '<FunctionInsert>{"temporary":{"params":[],"expr":"1"}}</FunctionInsert>' +
      '{"storyPlan":{},"calls":[{"function":"missing","args":[]}]}',
    edit(50) + '{"storyPlan":{},"calls":[{"function":"max","args":[2,3]}]}',
  ]);
  expect(result.requests).toHaveLength(2);
  expect(result.requests[1].userInput).toContain('当前变量：{"hp":100}');
  expect(result.requests[1].userInput).toContain('完整修正结果');
  expect(result.requests[1].requestContext).toMatchObject({ intent: 'correction', attemptIndex: 1 });
  expect(result.working.record.state.statData).toEqual({ hp: 50 });
  expect(result.working.record.state.statFunc).toEqual({});
  expect(result.session.stageMemory.content).not.toContain('temporary');
  expect(result.session.planningAttempts.map((attempt: any) => attempt.status)).toEqual(['failed', 'passed']);
  expect(result.generation_outcome.stageBoundary.stage).toBe('planning');
});
it('规划连续候选失败耗尽，停在候选起点并停止原生生成', async () => {
  const bad = edit(70) + '{"storyPlan":{},"calls":[{"function":"missing","args":[]}]}';
  const result = await runCandidates('planning', [bad, bad]);
  expect(result.requests).toHaveLength(2);
  expect(result.working.record.state.statData).toEqual({ hp: 100 });
  expect(result.working.dirty).toBe(false);
  expect(result.session).toBeNull();
  expect(result.generation_outcome.status).toBe('failed');
  expect(result.generation_outcome).not.toHaveProperty('stageBoundary');
  expect(result.stop).toHaveBeenCalledOnce();
});
it('结算标签按原文有序执行，错误候选整体撤销后重试', async () => {
  const result = await runCandidates('settlement', [
    edit(70) + '<VariableEdit>{"hp":{"$expr":"missing()"}}</VariableEdit>' + edit(1),
    edit(80) + '<VariableEdit>{"hp":{"$expr":"hp-5"}}</VariableEdit>' + edit({ $expr: 'hp*2' }),
  ]);
  expect(result.requests).toHaveLength(2);
  expect(result.requests[1].userInput).toContain('当前变量：{"hp":100}');
  expect(result.working.record.state.statData).toEqual({ hp: 150 });
  expect(result.session.stageMemory.content).not.toContain('missing()');
  expect(result.generation_outcome.stageBoundary.stage).toBe('settlement');
});
it('结算候选耗尽保留正文基线，最终候选为未结算', async () => {
  const bad = edit(70) + '<VariableEdit>{"hp":{"$expr":"missing()"}}</VariableEdit>';
  const result = await runCandidates('settlement', [bad, bad]);
  expect(result.requests).toHaveLength(2);
  expect(result.working.record.state.statData).toEqual({ hp: 100 });
  expect(result.generation_outcome.candidate.terminalStatus).toBe('unsettled');
  expect(result.generation_outcome.candidate.content).not.toContain('missing()');
  expect(result.generation_outcome).not.toHaveProperty('stageBoundary');
});

it('候选纯函数部分失败保留真实报告表，重试只回退业务效果', async () => {
  const result = await runCandidates('planning', [
    '{"storyPlan":{},"calls":[{"function":"floor","args":[2.9],"purpose":"first"},{"function":"sqrt","args":[-1]},{"function":"random","args":[]}]}',
    '{"storyPlan":{},"calls":[{"function":"max","args":[1,2],"purpose":"corrected"}]}',
  ]);
  expect(result.session.planningAttempts[0].functionResults.map((item: any) => item.status)).toEqual([
    'passed',
    'failed',
    'not-executed',
  ]);
  expect(result.session.planningAttempts[1].functionResults[0]).toMatchObject({
    status: 'passed',
    purpose: 'corrected',
    result: 2,
  });
});

it('结算insert、edit、insert直接按标签执行且没有转换包装', async () => {
  const text =
    '<VariableInsert>{"food":1}</VariableInsert><VariableEdit>{"food":2}</VariableEdit><VariableInsert>{"gold":3}</VariableInsert>';
  const result = await runCandidates('settlement', [text]);
  expect(result.requests).toHaveLength(1);
  expect(result.working.record.state.statData).toEqual({ hp: 100, food: 2, gold: 3 });
  expect(result.session.stageMemory.content).toContain(text);
  expect(result.session.stageMemory.content).not.toContain('<era_tx');
});
it.each(['{"operations":[]}', '<VariableEdit>{', '<VariableEdit>not-json</VariableEdit>'])(
  '结算错误标签或旧JSON在成功前缀之后触发整个候选回退：%s',
  async bad => {
    const result = await runCandidates('settlement', [edit(70) + bad, edit(80)]);
    expect(result.requests).toHaveLength(2);
    expect(result.requests[1].userInput).toContain('当前变量：{"hp":100}');
    expect(result.working.record.state.statData).toEqual({ hp: 80 });
    expect(result.session.settlementAttempts.map((attempt: any) => attempt.status)).toEqual(['failed', 'passed']);
  },
);
it('空结算保留正文状态并完成', async () => {
  const result = await runCandidates('settlement', ['']);
  expect(result.requests).toHaveLength(1);
  expect(result.working.record.state.statData).toEqual({ hp: 100 });
  expect(result.generation_outcome.stageBoundary.stage).toBe('settlement');
});
