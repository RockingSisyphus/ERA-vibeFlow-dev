import { prepareApiWriteNodeResult } from "../../base_lib/domain/api_write_engine.ts";
interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.api.write.request": Envelope<unknown> }>): any {
  const output = prepareApiWriteNodeResult(inputs["era.api.write.request"].value, "era:updateByObject", "value");
  return { update_object_directive: output.value as Readonly<Record<string, unknown>> };
}
