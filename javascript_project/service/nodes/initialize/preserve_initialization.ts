interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.initialize.plan": Envelope<unknown> }>): any {
  return { preserved_resource_changes: inputs["era.initialize.plan"].value as Readonly<Record<string, unknown>> };
}
