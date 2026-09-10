import { inspectSidecar, sidecarSourceBasis, sidecarInitialId, assertSidecarCurrent, sameSidecarValue, failedSidecarContext, type SyncContextV1 } from "../../base_lib/sidecar_binding.ts";

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
  try {
    const basis = sync.status === "failed" ? null : sidecarSourceBasis(sync);
    const current = await context.capabilities["era.tavern.sidecar"].read_current({});
    const initial = inspectSidecar(current, null);
    if (basis) assertSidecarCurrent(current, basis, sidecarInitialId(sync));
    const record = initial.sidecarId === null ? null
      : await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: initial.sidecarId });
    const latest = await context.capabilities["era.tavern.sidecar"].read_current({});
    if (basis) assertSidecarCurrent(latest, basis, initial.sidecarId);
    if (!sameSidecarValue(current, latest)) throw new Error("Sidecar 读取期间来源状态已变化。");
    return { sidecar_binding_input: { sync }, sidecar_binding_facts: inspectSidecar(current, record) };
  } catch (error) {
    return { sidecar_binding_input: { sync: failedSidecarContext(sync, error) }, sidecar_binding_facts: inspectSidecar(null, null) };
  }
}
