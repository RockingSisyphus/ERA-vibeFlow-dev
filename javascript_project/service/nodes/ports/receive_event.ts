import type {NodeRunContext} from "@vibeflow/plugin";

export async function run(_inputs: unknown, _params: unknown, context: NodeRunContext) {
  const received = await context.capabilities["vibeflow.port"].receive({port: "era.service.in"}, {signal: context.signal});
  return {transport_event_raw: received.value};
}
