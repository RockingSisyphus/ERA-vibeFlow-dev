import {
  classifyGeneration,
  prepareGeneration,
} from "../../base_lib/agent/agent_flow_policy.ts";
import {
  type GenerationFacts,
  type GenerationDecision,
  type AgentTransition,
  type AgentOutcome,
} from "../../base_lib/agent/agent_flow_types.ts";
import { prepared, type NodeInputs } from "../../base_lib/task_continuation.ts";
import { buildAgentTaskResult } from "../../base_lib/agent/agent_task_result.ts";
import { type PlannedStepV1 } from "../../base_lib/service_types.ts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/agent/shared_agent_flow_adapters.ts。 */
// Adapters with identical declared base libraries share this source.

// Original node: nodes/agent/classify_generation_event.ts
export function ClassifyGenerationEventNode(
  inputs: Readonly<Record<string, unknown>>,
): any {
  return {
    generation_decision: classifyGeneration(
      (inputs["era.agent.generation.facts"] as { value: GenerationFacts })
        .value,
    ),
  };
}

// Original node: nodes/agent/prepare_generation_phase.ts
export function PrepareGenerationPhaseNode(
  inputs: Readonly<Record<string, unknown>>,
): any {
  return {
    generation_request: prepareGeneration(
      (inputs["era.agent.generation.decision"] as { value: GenerationDecision })
        .value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/agent/task_continuation.ts。 */
export function prepareCandidateContinuation(inputs: NodeInputs): any {
  return {
    prepare_candidate_continuation_prepared_task: prepared(
      "candidate",
      inputs["era.agent.candidate.state"].value,
      inputs["era.task.continuation.context"].value,
    ),
  };
}
export function unpackFinishContext(inputs: NodeInputs): any {
  const continuation = inputs["era.task.continuation.context"].value;
  return {
    unpack_finish_context_finish_step: continuation.step,
    unpack_finish_context_finish_batch: continuation.executionState,
    unpack_finish_context_candidate_outcome:
      inputs["era.agent.candidate.outcome"].value,
    unpack_finish_context_finish_context: continuation,
  };
}
export function prepareLegacyContinuation(inputs: NodeInputs): any {
  return {
    prepare_legacy_continuation_prepared_task: prepared(
      inputs["era.task.route"].value,
      {
        step: inputs["era.step.request.routed"].value,
        executionState: inputs["era.batch.execution.state"].value,
      },
      inputs["era.task.continuation.context"].value,
    ),
  };
}
export function prepareDirectContinuation(inputs: NodeInputs): any {
  return {
    prepare_direct_continuation_prepared_task: prepared(
      "direct",
      inputs["era.task.result"].value,
      inputs["era.task.continuation.context"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/agent/build_agent_result.ts。 */
export function BuildAgentResultNode(
  inputs: Readonly<Record<string, unknown>>,
): any {
  return {
    agent_task_result_direct: buildAgentTaskResult(
      (inputs["era.agent.session.transition"] as { value: AgentTransition })
        .value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/agent/build_settings_result.ts。 */
export function BuildSettingsResultNode(
  inputs: Readonly<Record<string, unknown>>,
): any {
  const step = (inputs["era.step.request.routed"] as { value: PlannedStepV1 })
    .value;
  const outcome = (
    inputs["era.agent.settings.outcome"] as { value: AgentOutcome }
  ).value;
  return {
    settings_result: buildAgentTaskResult({
      schemaVersion: 1,
      step,
      ...outcome,
    }),
  };
}
