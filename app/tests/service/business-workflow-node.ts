import { generationRequestInputs, batchExecutionFixture, generationStepFixture } from './workflow-input-fixture';
import { createRequire } from 'node:module';
import { runWithIoMocks } from './workflow-io-sandbox.mjs';
const { importBuiltWorkflow } = createRequire(import.meta.url)('../../scripts/import-generated-service.mjs');
let module: Promise<any> | undefined;
/** 使用实际通信子图；仅IO边界由原测试夹具提供。 */
export async function businessWorkflowNode(
  entry: string,
  inputs: any,
  _params: any = {},
  context: any = {},
): Promise<any> {
  module ??= importBuiltWorkflow(
    new URL('../../../reports/service-test-workflows/business-nodes/workflow.js', import.meta.url).href,
  );
  const workflow = await module;
  const values = Object.fromEntries(Object.entries(inputs).map(([key, value]: any) => [key, value.value]));
  if (entry === 'era.agent.execute_session_v2') {
    const neutral = generationRequestInputs(values['era.agent.generation.request']);
    values['era.step.request.routed'] ??= neutral.step;
    values['era.batch.execution.state'] ??= neutral.batch;
  }
  if (values['era.step.request.routed'])
    values['era.step.request.routed'] = generationStepFixture(values['era.step.request.routed']);
  if (values['era.batch.execution.state'])
    values['era.batch.execution.state'] = batchExecutionFixture(
      values['era.step.request.routed'],
      values['era.batch.execution.state'],
    );
  // 原节点调用点可能同时提供兄弟步骤的输入；按正式命名入口选择其声明的部分。
  const keys = new Set(workflow.workflowDescriptor.entries[entry].inputs.map((input: any) => input.key));
  try {
    return await runWithIoMocks(workflow, Object.fromEntries(Object.entries(values).filter(([key]) => keys.has(key))), {
      ...context,
      entry,
    });
  } catch (error: any) {
    let reason = error;
    while (reason?.code?.startsWith('VF_') && reason.cause) reason = reason.cause;
    if (reason === error) throw error;
    throw Object.assign(new Error(reason.message, { cause: error }), { code: reason.code, name: reason.name });
  }
}
