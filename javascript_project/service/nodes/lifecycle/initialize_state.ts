import { createInitialServiceState } from "../../base_lib/service_protocol.ts";

export function run(): any {
  return { service_state_initial: createInitialServiceState() };
}
