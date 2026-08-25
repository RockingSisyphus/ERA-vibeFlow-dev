interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.batch.execution.state": Envelope<unknown>;
}>): any {
  return {
    initialize_execution_state: inputs["era.batch.execution.state"].value,
  };
}
