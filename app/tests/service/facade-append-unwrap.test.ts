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
            // **真实宿主契约**（`tavern-adapter.read_context`）：返回
            // `{schemaVersion: 2, messages}`，不是裸数组。老用例喂裸数组，
            // 于是把 `Array.isArray(fresh)` 这个恒假的判断一直当成通过。
            read_context: () => Promise.resolve({ schemaVersion: 2, messages: fresh }),
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

describe('facade 追加提交：写入前的任何异常都不得升级为「工作流致命停止」', () => {
  // 真机 `st-run-20260912T05452458-e1b1969ef725` 的 API-WRITE-001 / API-BOUND-002 等 12 条路径：
  // 一条 `VibeFlowWorkflowError: node 'commit_message_append' failed` 让整页 ERA 进入致命状态，
  // 其后同页所有门面提交都收到 `ERA_API_CANCELLED: ERA 服务宿主已停止`（receipt 里连
  // `status`/`scope`/`state.statData` 都没有），侧车也停在上一次的值。写入前的准备步骤
  // （校验 + 重读依据）因此必须和写入本身一样，只产出「失败收据」，不允许抛出去。
  it('重读依据失败时返回失败收据而不是抛出', async () => {
    const cause = Object.assign(new Error('读不到当前聊天。'), {
      code: 'ERA_READ_CONTEXT_FAILED',
    });
    const wrapped = Object.assign(new Error("capability 'era.tavern.messages.read_context' failed"), {
      code: 'VF_CAPABILITY_FAILED',
      cause,
    });

    const result = await facadeAppend(
      {
        'era.api.commit.rechecked': {
          value: {
            capabilityInput: {
              messageId: 3,
              content: 'next',
              sourceBasis: { identity: { characterId: 'c', chatId: 'chat', groupId: null }, messages: [] },
            },
          },
        },
      },
      {},
      {
        capabilities: {
          'era.tavern.messages': {
            read_context: () => Promise.reject(wrapped),
            update_content: () => Promise.resolve({ status: 'committed' }),
          },
        },
      },
    );

    const append = result.facade_commit_append_result as { status: string; observed?: { message?: string; code?: string } };
    expect(append.status).toBe('failed');
    expect(append.observed?.message).toContain('读不到当前聊天');
    expect(append.observed?.code).toBe('ERA_READ_CONTEXT_FAILED');
  });

  it('缺少写入参数时返回失败收据而不是抛出', async () => {
    const result = await facadeAppend(
      { 'era.api.commit.rechecked': { value: { request: { kind: 'append' } } } },
      {},
      { capabilities: {} },
    );

    const append = result.facade_commit_append_result as { status: string; observed?: { message?: string } };
    expect(append.status).toBe('failed');
    expect(String(append.observed?.message)).toContain('缺少消息写入参数');
  });

  it('回读阶段读不到聊天时也走 failed 路由而不是抛出', async () => {
    const { verifyCommitNode } = await import('../../../javascript_project/service/nodes/api/facade_nodes');
    const wrapped = Object.assign(new Error("capability 'era.tavern.messages.read_context' failed"), {
      code: 'VF_CAPABILITY_FAILED',
      cause: Object.assign(new Error('读不到当前聊天。'), { code: 'ERA_READ_CONTEXT_FAILED' }),
    });

    const result = await verifyCommitNode(
      {
        'era.api.commit.append.result': {
          value: { status: 'committed', context: { messageId: 3, committedContent: 'next' } },
        },
      },
      {},
      {
        capabilities: {
          'era.tavern.messages': { read_context: () => Promise.reject(wrapped) },
        },
      },
    );

    expect(result.commit_readback_route).toBe('failed');
    const failure = result.facade_commit_readback_failure as { error?: { code?: string; message?: string } };
    expect(failure.error?.message).toContain('读不到当前聊天');
  });
});
