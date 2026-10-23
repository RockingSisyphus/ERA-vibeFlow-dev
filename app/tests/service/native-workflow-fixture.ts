import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type {
  EraApplyMessageCommandsResult,
  EraCrudResult,
  EraCrudDiagnostic,
} from '../../../javascript_project/service/base_lib/domain/commands/crud_parser';
import type { EraSyncPlanV1 } from '../../../javascript_project/service/base_lib/domain/sync/sync_types';
import type { EraAgentExecutedCallV1 } from '../../../javascript_project/service/base_lib/agent/agent_flow_types';
/** 内存沙箱通过正式 AOT 子图验证行为；此处只准备输入与读取输出，不调度业务步骤。 */
import {
  seedCommandOperations,
  operationResult,
} from '../../../javascript_project/service/base_lib/domain/commands/operation_state';
import { seedStageOperations } from '../../../javascript_project/service/base_lib/domain/commands/operation_expressions';
import { preparePreview, previewResult } from '../../../javascript_project/service/base_lib/sync/readonly_preview';
import { planSyncWork as prepareWork } from '../../../javascript_project/service/base_lib/sync/sync_work_preparation';
import { AgentFunctionCallFailure } from '../../../javascript_project/service/base_lib/agent/agent_flow_types';
export { AgentFunctionCallFailure };
export * from '../../../javascript_project/service/base_lib/domain/commands/crud_parser';
export * from '../../../javascript_project/service/base_lib/domain/commands/crud_mutations';
export {
  normalizeMessage,
  payloadFor,
  prepareSyncPlanningInput,
  stableBase36Token,
} from '../../../javascript_project/service/base_lib/sync/sync_work_preparation';
const { importBuiltWorkflow } = createRequire(import.meta.url)('../../scripts/import-generated-service.mjs');
const modules = new Map<string, { source: string; module: Promise<any> }>();
async function execute(name: string, inputs: any, context: any = {}) {
  const directory = new URL(`../../../reports/service-test-workflows/${name}/`, import.meta.url);
  const source = readFileSync(new URL(`../${name}-source.txt`, directory), 'utf8');
  if (modules.get(name)?.source !== source) {
    // 与原生探针共用加载器：保留App依赖解析、跳过再次转译，watch重建后加载新实例。
    modules.set(name, { source, module: importBuiltWorkflow(new URL('workflow.js', directory).href) });
  }
  return (await modules.get(name)!.module).runWorkflowAsync(inputs, {
    capabilities: context.capabilities ?? {},
    trace: 'off',
  });
}

export async function applyOperations(state: any, context: any = {}) {
  return (await execute('operations', { 'era.command.operation.state': state }, context)).operation_result;
}
export async function applyMessageCommands(input: any): Promise<EraApplyMessageCommandsResult> {
  return operationResult(await applyOperations(seedCommandOperations(input)));
}
async function applyRoots(
  type: string,
  roots: readonly unknown[],
  stat: unknown,
  context: any = {},
): Promise<EraApplyMessageCommandsResult> {
  const state = seedCommandOperations({
    content: '',
    initialStat: stat,
    initialStatFunc: context.statFunc,
    messageId: context.messageId ?? 0,
    meta: context.meta ?? {},
    messageStartStat: context.layerStartStat,
    messageStartStatFunc: context.layerStartStatFunc,
    randomSourceKey: context.randomCursor?.sourceKey,
    randomDrawOffset: context.randomCursor?.drawOffset,
  });
  state.commands = [{ type, data: roots }] as any;
  const completed = await applyOperations(state);
  if (context.randomCursor && completed.randomCursor)
    context.randomCursor.drawOffset = completed.randomCursor.drawOffset;
  return operationResult(completed);
}
export async function applyInsert(roots: readonly unknown[], stat: unknown): Promise<EraCrudResult> {
  const { finalStat, editLog } = await applyRoots('insert', roots, stat);
  return { finalStat, editLog };
}
export async function applyDelete(roots: readonly unknown[], stat: unknown): Promise<EraCrudResult> {
  const { finalStat, editLog } = await applyRoots('delete', roots, stat);
  return { finalStat, editLog };
}
export async function applyEditWithDiagnostics(
  roots: readonly unknown[],
  stat: unknown,
  context: any,
): Promise<EraCrudResult & { readonly diagnostics: readonly EraCrudDiagnostic[] }> {
  const { finalStat, editLog, diagnostics } = await applyRoots('edit', roots, stat, context);
  return { finalStat, editLog, diagnostics };
}
export async function applyEdit(roots: readonly unknown[], stat: unknown, context: any): Promise<EraCrudResult> {
  const { finalStat, editLog } = await applyEditWithDiagnostics(roots, stat, context);
  return { finalStat, editLog };
}
export async function planEraSync(input: any): Promise<EraSyncPlanV1> {
  return previewResult((await execute('preview', { 'era.sync.preview.state': preparePreview(input) })).preview_result);
}
export async function planSyncWork(input: any) {
  const work = prepareWork(input);
  if (!work.plan || work.plan.status === 'failed' || !work.plan.execution) return work;
  // Work preparation has already supplied the normalized source and history origin.
  const preview = {
    input: { messages: work.plan.messages },
    plan: work.plan,
    updates: [],
    candidates: [],
    done: false,
  };
  const completed = previewResult((await execute('preview', { 'era.sync.preview.state': preview })).preview_result);
  if (completed.status === 'failed') return { ...work, plan: completed };
  // 派发已暂存的 MK/占位符写入也属于本次事务；预演只增加后续正文结果。
  const updates = new Map(
    [...work.plan.messageUpdates, ...completed.messageUpdates].map(update => [update.messageId, update]),
  );
  return { ...work, plan: { ...completed, messageUpdates: [...updates.values()] } };
}
export async function applySealedCommandCompactionToWork(work: any) {
  return (await execute('compaction', { 'era.expression.command.result': work })).command_compaction_result;
}
export async function applySealedCommandCompaction(plan: any): Promise<EraSyncPlanV1> {
  if (plan.status === 'failed') return plan;
  return (
    await applySealedCommandCompactionToWork({
      schemaVersion: 1,
      step: {},
      disposition: 'commit',
      plan,
      payload: null,
      failure: null,
    })
  ).plan;
}
/** 给生成场景提供完整入口 DTO；用例只指定它要观察的事件与消息事实。 */
export function generationStepFixture(partial: any) {
  const envelope = (event: any) => ({
    schemaVersion: 1,
    occurredAt: 1,
    source: 'tavern',
    args: [],
    encodedBytes: 2,
    ...event,
  });
  const event = envelope(partial.task.primaryEvent);
  const events = [event];
  const dispatch = partial.dispatchContext ?? {
    schemaVersion: 3,
    generationCycleIdentity: null,
    floorIdentity: null,
    stagedMessageUpdates: [],
    agentFloorCandidate: null,
    status: 'ready',
    dispatchClass: 'sync',
    requirement: 'none',
    messages: [],
    processingMessage: null,
    processingMk: null,
    messageChanged: false,
    variablesChanged: false,
    failure: null,
  };
  return {
    stepId: 'generation-step',
    index: 0,
    sourceSequences: [event.sequence],
    ...partial,
    events,
    sources: [{ relation: 'primary', event }],
    task: {
      id: 'generation-task',
      kind: 'sync',
      reason: 'manual',
      target: { kind: 'auto' },
      fullRebuild: false,
      context: dispatch.requirement,
      ...partial.task,
      primaryEvent: event,
      sourceEvents: events,
    },
    dispatchContext: {
      ...dispatch,
      messages: dispatch.messages.map((message: any) => ({ schemaVersion: 1, ...message })),
    },
  };
}
export async function prepareAgentSessionNode(inputs: any, _params: any, runtime: any) {
  return execute(
    'generation',
    { 'era.step.request.routed': inputs['era.step.request.routed'].value },
    { capabilities: { 'era.tavern.sidecar': { read_working: () => ({ working: null }) }, ...runtime.capabilities } },
  );
}
export async function executeAgentFunctionCalls(
  input: any,
): Promise<{ results: EraAgentExecutedCallV1[]; nextDrawOffset: number }> {
  const state = await applyOperations(
    seedStageOperations({
      calls: [...input.calls],
      stat: input.statData,
      statFunc: input.statFunc,
      sourceKey: input.sourceKey,
      drawOffset: input.drawOffset ?? 0,
    }),
  );
  if (state.failure) throw new AgentFunctionCallFailure(state.failure.message, state.stageCallTable.errorResults ?? []);
  return { results: state.stageCallTable.results, nextDrawOffset: state.randomCursor.drawOffset };
}
