import { businessWorkflowNode } from './business-workflow-node';
import { run as prepareWork } from './prepare-block-work-fixture';
import { expect } from 'vitest';
import { contextWith, identity, sidecarId } from './memory-lifecycle-fixture';
import { run as advance } from './message-block-fixture';
import { prepare } from '../../../javascript_project/service/nodes/sync/prepare_block_step';
import { finalize } from '../../../javascript_project/service/nodes/sync/finalize_block_step';
import { recordFor } from '../../../javascript_project/service/base_lib/sidecar_binding';
import { applySealedCommandCompactionToWork } from './native-workflow-fixture';
export async function execute(
  text: string,
  options: {
    failSave?: boolean;
    context?: any;
  } = {},
) {
  const context = options.context ?? contextWith(text);
  let state = prepare({ 'era.sync.context': { value: context } }).block_step_state;
  let record = recordFor(
    sidecarId,
    identity,
    {
      statData: context.variablesRaw.stat_data,
      statFunc: context.variablesRaw.statFunc,
      eraMeta: context.variablesRaw.ERAMetaData,
    },
    null,
  );
  let working: any = { version: 0, record, work: null, sourceBasis: null, dirty: false };
  const snapshots: any[] = [];
  const writes: any[] = [];
  const saves: any[] = [];
  const notifications: any[] = [];
  const capabilities = {
    'era.lifecycle.admission': { cancel: () => ({ status: 'cancelled' }) },
    'era.tavern.functions': {
      begin: () => ({}),
      next: async () => ({ kind: 'done', error: { code: 'MISSING_TOOL', message: 'missing' } }),
      release: () => ({}),
    },
    'era.tavern.messages': {
      update_content: async (input: any) => {
        writes.push(input);
        return { status: 'committed' };
      },
    },
    'era.tavern.sidecar': {
      read_working: () => ({ working }),
      write_working: (input: any) => {
        expect(input.expectedVersion).toBe(working.version);
        working = { ...input, version: working.version + 1 };
        snapshots.push(structuredClone(working));
        return { working };
      },
      read_current: async () => ({ identity, meta: { SidecarId: sidecarId }, stat: null }),
      read_record: async () => ({ status: 'found', record }),
      write_record: async (input: any) => {
        if (options.failSave) throw new Error('save failed');
        record = input.record;
        saves.push(record);
        return { status: 'committed' };
      },
      commit_metadata: async (input: any) => {
        notifications.push(input);
        return { status: 'committed' };
      },
      present_prompt: () => undefined,
    },
  };
  for (let iterations = 0; !state.done; iterations++) {
    if (iterations > 300) throw new Error('no progress');
    const pending = (await advance({ 'era.sync.block.step.state': { value: state } }, {}, { capabilities }))
      .block_step_pending;
    const work = prepareWork({ 'era.sync.block.step.pending': { value: pending } }).expression_command_result;
    state = (
      await businessWorkflowNode(
        'era.lifecycle.publish_block_application',
        { 'era.command_compaction.result': { value: await applySealedCommandCompactionToWork(work) } },
        {},
        { capabilities },
      )
    ).block_step_state_after;
    expect(writes).toHaveLength(0);
    expect(saves).toHaveLength(0);
  }
  const frozen = finalize({ 'era.sync.block.step.state.next': { value: state } }).batch_save_request;
  const saved = (
    await businessWorkflowNode(
      'era.tavern.variables_commit',
      { 'era.tavern.commit.request': { value: frozen } },
      {},
      { capabilities },
    )
  ).sync_commit_result;
  const outcome = (
    await businessWorkflowNode(
      'era.lifecycle.settle_saved_batch',
      { 'era.tavern.commit.result': { value: saved } },
      {},
      { capabilities },
    )
  ).completed_sync_result;
  return { state, working, snapshots, writes, saves, notifications, outcome };
}
