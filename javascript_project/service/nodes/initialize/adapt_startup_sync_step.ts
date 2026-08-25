export function run(inputs: any): any {
  return {
    routed_startup_sync_step: inputs["era.initialize.startup.sync.step"].value,
    routed_startup_execution_state: inputs["era.batch.execution.state"].value,
  };
}
