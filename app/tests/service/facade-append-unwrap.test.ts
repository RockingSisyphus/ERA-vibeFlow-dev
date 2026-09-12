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
