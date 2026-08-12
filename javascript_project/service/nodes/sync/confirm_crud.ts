interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{ "era.sync.work": Envelope<unknown> }>,
): any {
  return {
    crud_logical_result: inputs["era.sync.work"].value as Readonly<
      Record<string, unknown>
    >,
  };
}
