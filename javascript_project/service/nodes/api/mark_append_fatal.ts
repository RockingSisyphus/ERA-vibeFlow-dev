interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{ "era.api.write.append.result": Envelope<unknown> }>,
): any {
  return {
    fatal_append_result: inputs["era.api.write.append.result"].value as Readonly<
      Record<string, unknown>
    >,
  };
}
