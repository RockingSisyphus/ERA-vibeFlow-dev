import { inspectSidecar, type SyncContextV1 } from "../../base_lib/sidecar_binding.ts";

interface Ctx {
  readonly capabilities: {
    readonly "era.tavern.sidecar": {
      read_current(input: Readonly<Record<string, unknown>>): Promise<unknown>;
      read_record(input: Readonly<Record<string, unknown>>): Promise<unknown>;
    };
  };
}

export async function run(inputs: Readonly<{ "era.sync.context": { readonly value: unknown } }>, _params: Readonly<Record<string, unknown>>, context: Ctx): Promise<any> {
  const sync = inputs["era.sync.context"].value as SyncContextV1;
  const current = await context.capabilities["era.tavern.sidecar"].read_current({});
  const meta = (current as Record<string, unknown>).meta as Record<string, unknown> | null;
  const id = meta?.SidecarId;
  const record = typeof id === "string"
    ? await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: id })
    : null;
  return {
    sidecar_binding_input: { sync },
    sidecar_binding_facts: inspectSidecar(current, record),
  };
}
