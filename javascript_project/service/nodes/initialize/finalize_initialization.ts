import type { EraSyncTaskV1 } from "@era/vibeflow-contracts";
import {
  buildInitializationDirectResult,
  type InitializationCommitOutcomeV1,
} from "../../base_lib/initialization_transaction.ts";
interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.initialize.commit.result": Envelope<unknown> }>): any {
  const outcome = inputs["era.initialize.commit.result"].value as InitializationCommitOutcomeV1;
  const plan = outcome.plan;
  const shouldSync = plan.operation === "startup" && (outcome.status === "committed" || outcome.status === "no-op");
  if (plan.step.kind !== "execute") throw new TypeError("初始化结果缺少 execute 步骤。");
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
    initialize_completion_route: shouldSync ? "sync" as const : "finish" as const,
    startup_sync_step: step,
    initialize_direct_result: buildInitializationDirectResult(outcome),
  };
}
