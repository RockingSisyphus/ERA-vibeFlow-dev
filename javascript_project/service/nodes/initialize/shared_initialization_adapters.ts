import { type EraSyncTaskV1 } from "@era/vibeflow-contracts";
import {
  buildInitializationDirectResult,
  type InitializationCommitOutcomeV1,
  planInitialization,
  type InitializationContextV1,
} from "../../base_lib/initialization_transaction.ts";
import { prepared, type NodeInputs } from "../../base_lib/task_continuation.ts";
import { type PlannedStepV1 } from "../../base_lib/service_types.ts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/initialize/shared_initialization_adapters.ts。 */
// Adapters with identical declared base libraries share this source.

// Original node: nodes/initialize/finalize_initialization.ts
interface FinalizeInitialization_Envelope<T> {
  readonly value: T;
}
export function FinalizeInitializationNode(
  inputs: Readonly<{
    "era.initialize.commit.result": FinalizeInitialization_Envelope<unknown>;
  }>,
): any {
  const outcome = inputs["era.initialize.commit.result"]
    .value as InitializationCommitOutcomeV1;
  const plan = outcome.plan;
  const shouldSync =
    plan.operation === "startup" &&
    (outcome.status === "committed" || outcome.status === "no-op");
  if (plan.step.kind !== "execute")
    throw new TypeError("初始化结果缺少 execute 步骤。");
  const original = plan.step;
  const task: EraSyncTaskV1 = {
    id: `${original.task.id}:startup-sync`,
    sourceEvents: original.task.sourceEvents,
    primaryEvent: original.task.primaryEvent,
    context: "latest-message-with-mk",
    kind: "sync",
    reason: "history-changed",
    target: { kind: "auto" },
    fullRebuild: false,
  };
  const step = {
    kind: "execute",
    stepId: `${original.stepId}:startup-sync`,
    index: original.index,
    taskRoute: "sync",
    sourceSequences: original.sourceSequences,
    events: original.events,
    task,
    sources: original.sources,
    dispatchContext: original.dispatchContext,
  } as const;
  return {
    initialize_completion_route: shouldSync
      ? ("sync" as const)
      : ("finish" as const),
    startup_sync_step: step,
    initialize_direct_result: buildInitializationDirectResult(outcome),
  };
}

// Original node: nodes/initialize/plan_initialization.ts
interface PlanInitialization_Envelope<T> {
  readonly value: T;
}
export function PlanInitializationNode(
  inputs: Readonly<{
    "era.initialize.context": PlanInitialization_Envelope<unknown>;
  }>,
): any {
  const plan = planInitialization(
    inputs["era.initialize.context"].value as InitializationContextV1,
  );
  const route: "no-op" | "reconcile" =
    plan.actions.length === 0 ? "no-op" : "reconcile";
  return {
    initialization_route: route,
    initialization_plan: plan as unknown as Readonly<Record<string, unknown>>,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/initialize/prepare_continuation.ts。 */
export function prepareStartupContinuation(inputs: NodeInputs): any {
  return {
    prepare_startup_continuation_prepared_task: prepared(
      "sync",
      {
        step: inputs["era.initialize.startup.sync.step"].value,
        executionState: inputs["era.batch.execution.state"].value,
      },
      inputs["era.task.continuation.context"].value,
    ),
  };
}
export function prepareResourceResult(inputs: NodeInputs): any {
  return {
    prepare_resource_result_prepared_task: prepared(
      "direct",
      inputs["era.initialize.direct.result"].value,
      inputs["era.task.continuation.context"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/initialize/read_initialization_context.ts。 */
interface readinitializationcontextEnvelope<T> {
  readonly value: T;
}
interface Context {
  readonly capabilities: {
    readonly "era.tavern.identity": {
      readonly read: (input: Readonly<Record<string, unknown>>) => unknown;
    };
    readonly "era.tavern.variables": {
      readonly read: (
        input: Readonly<Record<string, unknown>>,
      ) => Promise<unknown>;
    };
    readonly "era.tavern.worldbook": {
      readonly read: (
        input: Readonly<Record<string, unknown>>,
      ) => Promise<unknown>;
    };
    readonly "era.tavern.regex": {
      readonly read: (
        input: Readonly<Record<string, unknown>>,
      ) => Promise<unknown>;
    };
    readonly "era.tavern.character": {
      readonly read_main_greeting: (
        input: Readonly<Record<string, unknown>>,
      ) => Promise<unknown>;
    };
  };
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export async function ReadInitializationContextNode(
  inputs: Readonly<{
    "era.step.request.routed": readinitializationcontextEnvelope<unknown>;
  }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const step = inputs["era.step.request.routed"].value as PlannedStepV1;
  const dispatchContext = ("dispatchContext" in step ? step.dispatchContext : undefined) as
    Readonly<Record<string, unknown>> | undefined;
  let identityRaw: unknown = null;
  let scriptVariablesRaw: unknown = null;
  let messagesRaw: unknown = null;
  let worldbookRaw: unknown = null;
  let regexRaw: unknown = null;
  let characterRaw: unknown = null;
  let readFailure: Readonly<Record<string, unknown>> | null = null;
  try {
    [identityRaw, scriptVariablesRaw, worldbookRaw, regexRaw, characterRaw] =
      await Promise.all([
        Promise.resolve(
          context.capabilities["era.tavern.identity"].read({
            purpose: "era-initialize",
          }),
        ),
        context.capabilities["era.tavern.variables"].read({
          scope: { type: "script" },
          purpose: "era-initialize",
        }),
        context.capabilities["era.tavern.worldbook"].read({
          purpose: "era-initialize",
        }),
        context.capabilities["era.tavern.regex"].read({
          purpose: "era-initialize",
        }),
        context.capabilities["era.tavern.character"].read_main_greeting({
          purpose: "era-initialize",
        }),
      ]);
    if (dispatchContext?.status !== "ready")
      throw new TypeError("初始化任务缺少可用的统一派发上下文。");
    messagesRaw = { schemaVersion: 2, messages: dispatchContext.messages };
  } catch (error) {
    readFailure = {
      code: "ERA_INITIALIZE_READ_FAILED",
      message: message(error),
      category: "tavern",
      retryable: false,
    };
  }
  const result: InitializationContextV1 = {
    schemaVersion: 1,
    step,
    identityRaw,
    scriptVariablesRaw,
    messagesRaw,
    worldbookRaw,
    regexRaw,
    characterRaw,
    readFailure,
  };
  return {
    initialization_context: result as unknown as Readonly<
      Record<string, unknown>
    >,
  };
}
