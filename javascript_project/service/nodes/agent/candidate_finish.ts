/** Candidate retries stay inside the workflow, without a stage handoff. */
export function run(inputs: any): any {
  const state = inputs["era.agent.candidate.state"].value;
  const { retryGeneration, ...outcome } =
    inputs["era.agent.generation.outcome"].value;
  return {
    candidate_state_after: retryGeneration
      ? { ...state, request: retryGeneration }
      : state,
    candidate_done: !retryGeneration,
    candidate_outcome: outcome,
  };
}
