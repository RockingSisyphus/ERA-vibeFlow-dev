import type {NodeRunContext} from "@vibeflow/plugin";

export function run(inputs: Record<string, {value: unknown}>, _params: unknown, context: NodeRunContext) {
  context.capabilities["vibeflow.port"].send({port: "era.service.out", value: inputs["era.batch.result"].value}, {signal: context.signal});
  return {};
}
