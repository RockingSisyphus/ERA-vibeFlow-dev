import { resolveSidecar, type SidecarFactsV1, type SyncContextV1 } from "../../base_lib/sidecar_binding.ts";

export function run(inputs: Readonly<{
  "era.sidecar.binding.input": { readonly value: unknown };
  "era.sidecar.binding.facts": { readonly value: unknown };
}>): any {
  const bindingInput = inputs["era.sidecar.binding.input"].value as { readonly sync: SyncContextV1 };
  const resolution = resolveSidecar(
    inputs["era.sidecar.binding.facts"].value as SidecarFactsV1,
    bindingInput.sync,
  );
  return { sidecar_binding_resolution: resolution };
}
