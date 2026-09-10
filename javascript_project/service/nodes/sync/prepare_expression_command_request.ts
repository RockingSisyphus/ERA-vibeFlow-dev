import { prepareSyncPlanningInput } from "../../base_lib/sync_planning.ts";
import type { SyncContextV1 } from "../../base_lib/sync_contracts.ts";
interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.sync.context": Envelope<unknown> }>): any {
 return { expression_command_request: prepareSyncPlanningInput(inputs["era.sync.context"].value as SyncContextV1) };
}
