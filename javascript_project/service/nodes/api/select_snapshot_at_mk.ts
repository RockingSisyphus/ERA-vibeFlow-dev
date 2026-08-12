interface Envelope<T> { readonly value: T; }

export function run(inputs: Readonly<{
  "era.api.query.request": Envelope<Readonly<Record<string, unknown>>>;
}>): any {
  return {
    snapshot_at_mk_query: {
      ...inputs["era.api.query.request"].value,
      queryType: "getSnapshotAtMk",
    },
  };
}
