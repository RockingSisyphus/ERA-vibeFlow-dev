import type { PlannedStepV1 } from "../../base_lib/service_types.ts";
interface Envelope<T> {
  readonly value: T;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function run(
  inputs: Readonly<{ "era.step.request.routed": Envelope<unknown> }>,
): any {
  const step = inputs["era.step.request.routed"].value as PlannedStepV1;
  if (step.kind !== "execute" || step.task.kind !== "update-mk") {
    throw new TypeError("统一 MK 结果只接受 update-mk execute 步骤。");
  }
  const prepared = isRecord(step.dispatchContext) ? step.dispatchContext : null;
  const ready = prepared?.status === "ready";
  const failure = isRecord(prepared?.failure) ? prepared.failure : null;
  return {
    prepared_mk_outcome: {
      schemaVersion: 1,
      step,
      status: ready
        ? prepared?.messageChanged === true ||
          prepared?.variablesChanged === true
          ? "committed"
          : "no-op"
        : "failed",
      mk:
        typeof prepared?.processingMk === "string"
          ? prepared.processingMk
          : null,
      messageChanged: prepared?.messageChanged === true,
      variablesChanged: prepared?.variablesChanged === true,
      failure: ready
        ? null
        : (failure ?? {
            code: "ERA_UPDATE_MK_CONTEXT_FAILED",
            message: "统一任务上下文准备失败。",
            category: "domain",
            retryable: false,
          }),
    },
  };
}
