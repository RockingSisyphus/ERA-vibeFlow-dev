interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.batch.fatal": Envelope<boolean>;
}>): any {
  return {
    fatal_route: inputs["era.batch.fatal"].value
      ? ("fatal" as const)
      : ("continue" as const),
  };
}
