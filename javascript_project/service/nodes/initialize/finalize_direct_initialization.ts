import type { EraTaskResultV1 } from "@era/vibeflow-contracts";

interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{ "era.initialize.direct.result": Envelope<unknown> }>,
): { readonly initialize_direct_task_result: EraTaskResultV1 & Readonly<Record<string, unknown>> } {
  return {
    initialize_direct_task_result: inputs["era.initialize.direct.result"].value as EraTaskResultV1 & Readonly<Record<string, unknown>>,
  };
}
