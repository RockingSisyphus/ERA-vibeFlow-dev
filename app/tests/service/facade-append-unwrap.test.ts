import { describe, expect, it } from 'vitest';

import { commitAppendNode as facadeAppend } from '../../../javascript_project/service/nodes/api/facade_nodes';

describe('facade 追加提交：能力包装必须解开', () => {
  it('VF_CAPABILITY_FAILED 的 cause 才是真原因', async () => {
    const cause = Object.assign(new Error('消息写入目标已变化：source-text (#2)。'), {
      code: 'ERA_MESSAGE_WRITE_TARGET_CHANGED',
    });
    const wrapped = Object.assign(new Error("capability 'era.tavern.messages.update_content' failed"), {
      code: 'VF_CAPABILITY_FAILED',
      cause,
    });
    const result = await facadeAppend(
      { 'era.api.commit.rechecked': { value: { capabilityInput: { updates: [] } } } },
      {},
      {
        capabilities: {
          'era.tavern.messages': {
            update_content: () => Promise.reject(wrapped),
          },
        },
      },
    );

    const observed = result.facade_commit_append_result.observed as { message: string; code?: string };
    expect(observed.message).toContain('消息写入目标已变化');
    expect(observed.code).toBe('ERA_MESSAGE_WRITE_TARGET_CHANGED');
  });
});

describe('facade 追加提交：写入前必须刷新依据', () => {
  it('依据里用刚读到的消息列表，而不是派发时捕获的旧列表', async () => {
    const { commitAppendNode } = await import('../../../javascript_project/service/nodes/api/facade_nodes');
    const fresh = [
      { messageId: 0, role: 'assistant', swipeIndex: 0, activeText: 'a' },
      { messageId: 1, role: 'user', swipeIndex: 0, activeText: 'b' },
      { messageId: 2, role: 'assistant', swipeIndex: 0, activeText: 'c' },
      { messageId: 3, role: 'assistant', swipeIndex: 0, activeText: 'd' },
    ];
    let seen: Record<string, unknown> | null = null;

    const result = await commitAppendNode(
      {
        'era.api.commit.rechecked': {
          value: {
            capabilityInput: {
              messageId: 3,
              content: 'next',
              refresh: 'none',
              purpose: 'era-facade-commit',
              // 派发时捕获的旧依据：只有 3 条消息（真机 STATUSBAR-EXAMPLE-020 的形态）。
              sourceBasis: {
                identity: { characterId: 'c', chatId: 'chat', groupId: null },
                messages: fresh.slice(0, 3),
              },
            },
          },
        },
      },
      {},
      {
        capabilities: {
          'era.tavern.messages': {
            read_context: () => Promise.resolve(fresh),
            update_content: (input: Record<string, unknown>) => {
              seen = input;
              return Promise.resolve({ status: 'committed' });
            },
          },
        },
      },
    );

    expect(result.facade_commit_append_result.status).toBe('committed');
    expect((seen as unknown as { sourceBasis: { messages: unknown[] } }).sourceBasis.messages).toHaveLength(4);
  });
});
