import { businessWorkflowNode } from './business-workflow-node';
import { expect, it, vi } from 'vitest';
import { normalizeAgentConfiguration } from '../../../javascript_project/service/base_lib/agent/agent_generation_session';
it('重新结算替换旧结算记录，保留已执行正文中的普通API记录与done', async () => {
  const story =
    'story<EraFCall name="body" status="done"/><era_tx s="a"><VariableInsert>{"body":1}</VariableInsert></era_tx>';
  const oldSettlement = '<era_tx s="m"><VariableInsert>{"settled":1}</VariableInsert></era_tx>';
  const floor = { chatId: 'retry-memory', messageId: 1, swipeId: 0, mk: 'retry-mk' };
  const session = {
    status: 'settled',
    messageId: 1,
    story,
    stageMemory: { ...floor, content: story + oldSettlement },
    transaction: oldSettlement,
  };
  const write = vi.fn();
  const result = await businessWorkflowNode(
    'era.agent.execute_session_v2',
    {
      'era.agent.generation.request': {
        value: {
          phase: 'execute',
          identity: floor,
          configuration: normalizeAgentConfiguration({ settlement: { enabled: true, retryCount: 0 } }),
          trigger: { type: 'era.ui.agent_retry', eventId: 'retry-event', retry: { kind: 'settlement' } },
          context: {
            identity: { chatId: floor.chatId },
            session,
            latestMessage: { message_id: 1, role: 'assistant', message: story + oldSettlement },
            state: { statData: { body: 1, settled: 1 }, statFunc: {} },
          },
        },
      },
    },
    {},
    {
      capabilities: {
        'era.tavern.agent': {
          read_session_binding: () => ({ active: false, previous: null }),
          write_session: write,
          generate: async () => ({ response: '' }),
        } as never,
      },
    },
  );
  expect(result.generation_outcome.status).toBe('committed');
  const candidate = write.mock.calls.at(-1)![0].session.pendingStage.candidate;
  expect(candidate.content).toContain(story);
  expect(candidate.content).not.toContain('"settled":1');
  expect(session.stageMemory.content).toContain(oldSettlement);
});
