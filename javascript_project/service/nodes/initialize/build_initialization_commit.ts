interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.initialize.changes": Envelope<unknown> }>): any {
  return { resource_commit_request: inputs["era.initialize.changes"].value as Readonly<Record<string, unknown>> };
}
