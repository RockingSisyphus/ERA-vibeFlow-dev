/** Candidate retries stay inside the workflow, without a stage handoff. */
export function run(inputs: any): any {
  const state = inputs["era.agent.candidate.state"].value;
  return {
    generation_request: state.request,
    routed_step: state.step,
    execution_state: state.executionState,
  };
}
