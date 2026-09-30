import {
  buildNoHostOutcome,
  type DispatchSeedV1,
  dispatchContextOf,
  type DispatchPreparationOutcomeV1,
  planDispatchPreparation,
  type DispatchCanonicalContextV1,
  preserveDispatchPreparation,
  type DispatchPreparationPlanV1,
  classifyDispatch,
} from "../../base_lib/dispatch_preparation.ts";
import {
  type BatchExecutionStateV1,
  type PlannedStepV1,
} from "../../base_lib/service_types.ts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/dispatch/shared_dispatch_adapters.ts。 */
// Adapters with identical declared base libraries share this source.

// Original node: nodes/dispatch/build_no_host_context.ts
interface BuildNoHostContext_Envelope<T> {
  readonly value: T;
}
export function BuildNoHostContextNode(
  inputs: Readonly<{
    "era.dispatch.seed": BuildNoHostContext_Envelope<unknown>;
  }>,
): any {
  return {
    no_host_outcome: buildNoHostOutcome(
      inputs["era.dispatch.seed"].value as DispatchSeedV1,
    ),
  };
}

// Original node: nodes/dispatch/finalize_dispatch_context.ts
interface FinalizeDispatchContext_Envelope<T> {
  readonly value: T;
}
export function FinalizeDispatchContextNode(
  inputs: Readonly<{
    "era.dispatch.preparation.outcome": FinalizeDispatchContext_Envelope<unknown>;
  }>,
): any {
  const outcome = inputs["era.dispatch.preparation.outcome"]
    .value as DispatchPreparationOutcomeV1;
  const step = outcome.seed.step;
  const preparedTaskRoute =
    step.kind === "execute"
      ? step.taskRoute === "agent-generation-session" &&
        step.task.primaryEvent.type === "era.ui.agent_configuration"
        ? "agent-settings"
        : step.taskRoute
      : "ignore";
  const taskFamilyRoute =
    preparedTaskRoute === "initialize" ||
    preparedTaskRoute === "api" ||
    preparedTaskRoute === "agent-generation-session"
      ? preparedTaskRoute
      : "simple";
  return {
    prepared_routed_step: {
      ...step,
      dispatchContext: dispatchContextOf(outcome),
    },
    prepared_task_route: preparedTaskRoute,
    task_family_route: taskFamilyRoute,
  };
}

// Original node: nodes/dispatch/plan_message_preparation.ts
interface PlanMessagePreparation_Envelope<T> {
  readonly value: T;
}
export function PlanMessagePreparationNode(
  inputs: Readonly<{
    "era.dispatch.canonical_context": PlanMessagePreparation_Envelope<unknown>;
  }>,
): any {
  const plan = planDispatchPreparation(
    inputs["era.dispatch.canonical_context"]
      .value as DispatchCanonicalContextV1,
  );
  // 状态任务把消息更新暂存在 V3 派发上下文中，由同步事务一次性提交。
  // 只有纯 update-mk 任务仍沿用独立的预提交写入链。
  const shouldPrecommit =
    plan.seed.dispatchClass === "update-mk" &&
    plan.status === "ready" &&
    (plan.messageWriteRequired || plan.variableWriteRequired);
  return {
    dispatch_preparation_plan: plan,
    precommit_route: shouldPrecommit ? "commit" : "no-op",
  };
}

// Original node: nodes/dispatch/preserve_prepared_context.ts
interface PreservePreparedContext_Envelope<T> {
  readonly value: T;
}
export function PreservePreparedContextNode(
  inputs: Readonly<{
    "era.dispatch.preparation.plan": PreservePreparedContext_Envelope<unknown>;
  }>,
): any {
  return {
    preserved_preparation_outcome: preserveDispatchPreparation(
      inputs["era.dispatch.preparation.plan"]
        .value as DispatchPreparationPlanV1,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/dispatch/classify_context.ts。 */
interface classifycontextEnvelope<T> {
  readonly value: T;
}

export function ClassifyContextNode(
  inputs: Readonly<{
    "era.step.request": classifycontextEnvelope<unknown>;
    "era.batch.execution.state": classifycontextEnvelope<unknown>;
  }>,
): any {
  const { seed, route } = classifyDispatch(
    inputs["era.step.request"].value as PlannedStepV1,
    inputs["era.batch.execution.state"].value as BatchExecutionStateV1,
  );
  return { dispatch_seed: seed, context_route: route };
}
