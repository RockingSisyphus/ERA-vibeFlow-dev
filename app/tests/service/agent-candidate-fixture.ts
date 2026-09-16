import { contextWith } from './memory-lifecycle-fixture';
import { run as generate } from '../../../javascript_project/service/nodes/agent/execute_generation_session';
import { run as seed } from '../../../javascript_project/service/nodes/agent/candidate_seed';
import { run as unpack } from '../../../javascript_project/service/nodes/agent/candidate_unpack';
import { run as finishCandidate } from '../../../javascript_project/service/nodes/agent/candidate_finish';
import { run as prepare } from '../../../javascript_project/service/nodes/agent/prepare_stage_blocks';
import { run as advance } from '../../../javascript_project/service/nodes/sync/drive_message_blocks';
import { run as prepareWork } from '../../../javascript_project/service/nodes/sync/prepare_block_work';
import { run as publish } from '../../../javascript_project/service/nodes/sync/publish_block_application';
import { run as finish } from '../../../javascript_project/service/nodes/agent/finish_stage_blocks';
import { recordFor } from '../../../javascript_project/service/base_lib/sidecar_binding';

/** Executes the actual candidate/body nodes with a memory-only Tavern storage fixture. */
export function createCandidateRunner(originalStep: any, originalBatch: any, runtime: any, context: any) {
  const identity = { characterId: null, groupId: null, ...context?.identity };
  let working: any = {
    version: 0,
    dirty: false,
    work: null,
    sourceBasis: null,
    record: recordFor(
      'era_chat_12345678-1234-4234-8234-123456789abc',
      identity,
      {
        statData: context?.state?.statData ?? {},
        statFunc: context?.state?.statFunc ?? {},
        eraMeta: context?.state?.eraMeta ?? {},
      },
      null,
    ),
  };
  const agent = runtime.capabilities['era.tavern.agent'];
  const capabilities = {
    ...runtime.capabilities,
    'era.tavern.agent': { clear_session: () => {}, ...agent },
    'era.tavern.sidecar': runtime.capabilities['era.tavern.sidecar'] ?? {
      read_working: () => ({ working: structuredClone(working) }),
      write_working: (input: any) => {
        working = { ...input, version: working.version + 1 };
        return { working };
      },
    },
  };
  const fallback = contextWith(context?.latestMessage?.message ?? '').step;
  const dispatch = originalStep.dispatchContext ?? fallback.dispatchContext;
  const step = {
    ...fallback,
    ...originalStep,
    sources: originalStep.sources ?? [{ relation: 'primary', event: originalStep.task?.primaryEvent }],
    stepId: originalStep.stepId ?? 'candidate-test',
    task: { ...originalStep.task, primaryEvent: { occurredAt: 1, ...originalStep.task?.primaryEvent } },
    dispatchContext: { ...dispatch, sourceBasis: dispatch.sourceBasis ?? { identity, messages: dispatch.messages } },
  };
  const batch = {
    schemaVersion: 1,
    ...originalBatch,
    nextState: { consecutiveMk: null, consecutiveProcessingCount: 0, scopeWindow: {}, ...originalBatch?.nextState },
  };
  return async (request: any) => {
    let candidate = seed(
      {
        'era.agent.generation.request': { value: request },
        'era.step.request.routed': { value: step },
        'era.batch.execution.state': { value: batch },
      },
      {},
      { capabilities },
    ).candidate_state;
    for (let attempts = 0; attempts < 20; attempts++) {
      const inputs = unpack({ 'era.agent.candidate.state': { value: candidate } });
      const raw = await generate(
        {
          'era.agent.generation.request': { value: inputs.generation_request },
          'era.step.request.routed': { value: inputs.routed_step },
          'era.batch.execution.state': { value: inputs.execution_state },
        },
        {},
        { capabilities },
      );
      let state = prepare(
        { 'era.agent.generation.raw': { value: raw.generation_outcome } },
        {},
        { capabilities },
      ).block_step_state;
      for (let blocks = 0; !state.done; blocks++) {
        if (blocks > 500) throw new Error('candidate block fixture stalled');
        const pending = (await advance({ 'era.sync.block.step.state': { value: state } }, {}, { capabilities }))
          .block_step_pending;
        const work = prepareWork({ 'era.sync.block.step.pending': { value: pending } }).expression_command_result;
        state = publish(
          { 'era.command_compaction.result': { value: work } },
          {},
          { capabilities },
        ).block_step_state_after;
      }
      const applied = finish(
        { 'era.sync.block.step.state.next': { value: state } },
        {},
        { capabilities },
      ).applied_generation_outcome;
      const result = finishCandidate({
        'era.agent.candidate.state': { value: candidate },
        'era.agent.generation.outcome': { value: applied },
      });
      if (result.candidate_done) return { generation_outcome: result.candidate_outcome, working };
      candidate = result.candidate_state_after;
    }
    throw new Error('candidate retries exceeded configured limit');
  };
}
