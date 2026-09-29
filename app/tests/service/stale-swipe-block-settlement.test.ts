import { describe, expect, it, vi } from 'vitest';
import { PublishBlockApplicationNode } from '../../../javascript_project/service/nodes/sync/shared_block_state_adapters';
import { finalize } from '../../../javascript_project/service/nodes/sync/finalize_block_step';
import { run as commit } from '../../../javascript_project/service/nodes/sync/commit_sync';
import { run as settle } from '../../../javascript_project/service/nodes/sync/settle_saved_batch';
import { buildSyncNonCommitResult } from '../../../javascript_project/service/base_lib/sync/sync_result_policy';

const event = {
  schemaVersion: 1,
  eventId: 'swipe-b',
  sequence: 34,
  type: 'message_swiped',
  source: 'tavern',
  occurredAt: 1000,
  args: [],
  encodedBytes: 1,
};

function fixture(
  options: {
    reason?: string;
    source?: string;
    written?: boolean;
    functionFrame?: boolean;
    stageOutcome?: boolean;
  } = {},
) {
  const sourceEvent = { ...event, source: options.source ?? event.source };
  const step = {
    kind: 'execute',
    stepId: 'sync-b',
    index: 0,
    taskRoute: 'sync',
    sourceSequences: [34],
    events: [sourceEvent],
    sources: [{ event: sourceEvent, relation: 'primary' }],
    task: {
      id: 'sync-b',
      kind: 'sync',
      reason: options.reason ?? 'history-changed',
      context: 'latest-message-with-mk',
      primaryEvent: sourceEvent,
      sourceEvents: [sourceEvent],
      target: { kind: 'auto' },
      fullRebuild: false,
    },
  };
  const work = {
    schemaVersion: 1,
    step,
    disposition: 'commit',
    plan: { status: 'ready', stat: { branch: 'B' }, statFunc: {}, meta: { SidecarId: 'sidecar-b' } },
    payload: null,
    failure: null,
  };
  const state = {
    work,
    done: false,
    sourceBasis: { identity: { characterId: 'card', chatId: 'chat', groupId: null }, messages: [] },
    ...(options.functionFrame
      ? { functionFrame: { id: 'call', phase: 'waiting', request: null, remaining: 0, appliedBlocks: 0, callIndex: 0 } }
      : {}),
    ...(options.stageOutcome ? { stageOutcome: { candidate: true } } : {}),
  };
  const rejected = Object.assign(new Error('消息写入目标已变化：swipe (#2)。'), {
    code: 'ERA_MESSAGE_WRITE_TARGET_CHANGED',
    reason: 'swipe',
    written: options.written ?? false,
  });
  const writeWorking = vi.fn(() => {
    throw { code: 'VF_CAPABILITY_FAILED', cause: rejected };
  });
  const capabilities = {
    'era.tavern.sidecar': {
      read_working: () => ({ working: { version: 1, record: { state: {} }, stage: null } }),
      write_working: writeWorking,
    },
    'era.lifecycle.admission': { schedule: vi.fn(), cancel: vi.fn() },
  };
  return { work, state, capabilities, writeWorking };
}

describe('过时 Swipe 的块发布结算', () => {
  it('旧普通历史同步在无副作用的目标拒绝后空操作结算，并安排新历史同步', async () => {
    const { work, state, capabilities, writeWorking } = fixture();
    const published = PublishBlockApplicationNode(
      { 'era.command_compaction.result': { value: { ...work, blockStepState: state } } },
      {},
      { capabilities },
    );
    expect(writeWorking).toHaveBeenCalledOnce();
    expect(published.block_step_done).toBe(true);
    expect(published.block_step_state_after.work).toMatchObject({
      disposition: 'no-op',
      plan: null,
      payload: null,
      initialPresentation: null,
      failure: { code: 'ERA_MESSAGE_WRITE_TARGET_CHANGED' },
    });

    const envelope = finalize({
      'era.sync.block.step.state.next': { value: published.block_step_state_after },
    }).batch_save_request;
    const committed = (await commit({ 'era.tavern.commit.request': { value: envelope } }, {}, { capabilities }))
      .sync_commit_result;
    const completed = settle(
      { 'era.tavern.commit.result': { value: committed } },
      {},
      { capabilities },
    ).completed_sync_result;
    expect(capabilities['era.lifecycle.admission'].schedule).toHaveBeenCalledWith(
      expect.objectContaining({ event: { type: 'era.facade.sync', source: 'era-api', args: [{ mode: 'full' }] } }),
    );
    const result = buildSyncNonCommitResult(completed.work);
    expect(result.status).toBe('no-op');
    expect(result.settlements).toMatchObject([{ sequence: 34, status: 'completed' }]);
    expect(result.diagnostics).toMatchObject([{ code: 'ERA_MESSAGE_WRITE_TARGET_CHANGED' }]);
    expect(result).not.toHaveProperty('stateUpdate');
  });

  it.each([
    ['API 来源', { source: 'era-api' }],
    ['候选同步', { reason: 'swipe-regeneration' }],
    ['已写入', { written: true }],
    ['作者函数', { functionFrame: true }],
    ['候选阶段', { stageOutcome: true }],
  ])('%s 保持失败回执', (_label, options) => {
    const { work, state, capabilities } = fixture(options);
    const published = PublishBlockApplicationNode(
      { 'era.command_compaction.result': { value: { ...work, blockStepState: state } } },
      {},
      { capabilities },
    );
    expect(published.block_step_state_after.work.disposition).toBe('failed');
  });
});
