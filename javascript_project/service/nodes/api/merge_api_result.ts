import type { EraTaskResultV1 } from "@era/vibeflow-contracts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.task.result.merged": Envelope<unknown>;
}>): {
  readonly api_task_result: EraTaskResultV1 &
    Readonly<Record<string, unknown>>;
} {
  return {
    api_task_result: inputs["era.task.result.merged"].value as EraTaskResultV1 &
      Readonly<Record<string, unknown>>,
  };
}
