interface Envelope<T> { readonly value: T; }

export function run(inputs: Readonly<{
  "era.api.query.request": Envelope<Readonly<Record<string, unknown>>>;
}>): any {
  return {
    current_vars_query: {
      ...inputs["era.api.query.request"].value,
      queryType: "getCurrentVars",
    },
  };
}
