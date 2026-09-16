import { describe, expect, it } from 'vitest';
import { isEraDispatchContextV3 } from '../../../packages/era-contracts/index.js';
import { contextWith, identity } from './memory-lifecycle-fixture';
import {
  readWindowNode,
  readTargetNode,
  validateCommitNode,
  commitFailureNode,
} from '../../../javascript_project/service/nodes/api/facade_nodes';
import {
  buildTransaction,
  inspectWindow,
  validateCommit,
} from '../../../javascript_project/service/base_lib/facade_api_engine';

function fixture() {
  const context = contextWith('original');
  const execution: any = {
    schemaVersion: 1,
    nextState: {
      consecutiveMk: null,
      consecutiveProcessingCount: 0,
      scopeWindow: { token: null, messageId: null, messageAdmission: null, branchAdmission: null },
    },
  };
  const request = {
    task: { ...context.step.task, kind: 'api', eventType: 'era.facade.commit', args: [] },
    sources: context.step.sources,
    dispatchContext: { ...context.step.dispatchContext, dispatchClass: 'api' },
    detail: { scope: 'always', windowToken: 7, operations: [{ edit: { hp: 70 } }] },
  };
  const messages = context.step.dispatchContext.sourceBasis.messages;
  const current = { ...identity, lifecycleToken: 7 };
  const inspected = inspectWindow(request, execution, current, { schemaVersion: 2, messages });
  const admitted: any = validateCommit(inspected);
  const transaction: any = buildTransaction(admitted.context);
  const capabilities = {
    'era.tavern.messages': { read_context: async (): Promise<any> => ({ schemaVersion: 2, messages }) },
    'era.tavern.identity': { read: () => current },
    'era.tavern.sidecar': { read_working: () => ({ working: null }) },
  };
  return { request, execution, transaction, capabilities, messages };
}

describe('API内存应用之前的读取与目标保护', () => {
  it('阶段API从工作草稿提取纯楼层身份，派发合同仍有效', async () => {
    const f = fixture();
    const floor = { chatId: identity.chatId, messageId: 1, swipeId: 0, mk: 'draft' };
    (f.capabilities['era.tavern.sidecar'].read_working as any) = () => ({
      working: {
        dirty: true,
        stage: { ...floor, phase: 'story' },
        work: null,
      },
    });
    const result = await readWindowNode(
      {
        'era.api.request': { value: f.request },
        'era.batch.execution.state': { value: f.execution },
      },
      {},
      { capabilities: f.capabilities },
    );
    const dispatch = result.facade_commit_inspected.request.dispatchContext;
    expect(dispatch.floorIdentity).toEqual(floor);
    expect(isEraDispatchContextV3(dispatch)).toBe(true);
  });
  it('无关消息增加可以进入新消息列表，原目标和写入依据保留', async () => {
    const f = fixture();
    f.capabilities['era.tavern.messages'].read_context = async () => ({
      schemaVersion: 2,
      messages: [
        ...f.messages,
        { schemaVersion: 1, messageId: 1, role: 'assistant', swipeIndex: 0, activeText: 'unrelated' },
      ],
    });
    const result = await readTargetNode(
      { 'era.api.commit.transaction': { value: f.transaction } },
      {},
      { capabilities: f.capabilities },
    );
    expect(result.facade_commit_target.messages).toHaveLength(2);
    expect(result.facade_commit_target.latest).toEqual(f.transaction.latest);
    expect(result.facade_commit_target.sourceBasis).toEqual(f.transaction.sourceBasis);
  });
  it.each(['text', 'swipe', 'delete'])('目标%s改变不能用新正文刷新原写入依据', async kind => {
    const f = fixture();
    f.capabilities['era.tavern.messages'].read_context = async () => ({
      schemaVersion: 2,
      messages:
        kind === 'delete'
          ? []
          : f.messages.map((message: any) => ({
              ...message,
              ...(kind === 'text' ? { activeText: 'user edited' } : { swipeIndex: 1 }),
            })),
    });
    const result = await readTargetNode(
      { 'era.api.commit.transaction': { value: f.transaction } },
      {},
      { capabilities: f.capabilities },
    );
    expect(result.facade_commit_target.sourceBasis).toEqual(f.transaction.sourceBasis);
    expect(result.facade_commit_target.latest).toEqual(f.transaction.latest);
  });
  it('读取失败返回真实失败回执，下一次正常请求仍被接纳', async () => {
    const f = fixture();
    const read = f.capabilities['era.tavern.messages'].read_context;
    f.capabilities['era.tavern.messages'].read_context = async () => {
      throw new Error('read failed');
    };
    const inspected = await readWindowNode(
      { 'era.api.request': { value: f.request }, 'era.batch.execution.state': { value: f.execution } },
      {},
      { capabilities: f.capabilities },
    );
    const validated = validateCommitNode({ 'era.api.commit.inspected': { value: inspected.facade_commit_inspected } });
    expect(validated.commit_admission_route).toBe('failed');
    const failed = commitFailureNode({
      'era.api.commit.failure_context': { value: validated.facade_commit_validation_failure },
    });
    expect(failed.facade_commit_failed_result.status).toBe('failed');
    expect(failed.facade_commit_failed_result.diagnostics[0].message).toBe('read failed');
    f.capabilities['era.tavern.messages'].read_context = read;
    const next = await readWindowNode(
      { 'era.api.request': { value: f.request }, 'era.batch.execution.state': { value: f.execution } },
      {},
      { capabilities: f.capabilities },
    );
    expect(
      validateCommitNode({ 'era.api.commit.inspected': { value: next.facade_commit_inspected } })
        .commit_admission_route,
    ).toBe('commit');
  });
});
