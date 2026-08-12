import type { EraTaskResultV1 } from "@era/vibeflow-contracts";

interface Envelope<T> { readonly value: T; }

export function run(inputs: Readonly<{
  "era.task.result": Envelope<unknown>;
}>): {
  readonly query_api_result: EraTaskResultV1 &
    Readonly<Record<string, unknown>>;
} {
  return {
    query_api_result: inputs["era.task.result"].value as EraTaskResultV1 &
      Readonly<Record<string, unknown>>,
  };
}
