import {
  identifySealedLayers,
  compactEachSegment,
  candidateCanReplay,
  prepareCandidateOperations,
  compareCandidateReplay,
  writeSingleScopeSegments,
  updateCompactionMarkers,
  type ServiceCompactionContext,
} from "../../base_lib/sync/command_compaction.ts";

interface ReplayState {
  context: ServiceCompactionContext;
  index: number;
}
export function prepareCandidates(inputs: any) {
  return {
    candidates: {
      context: compactEachSegment(
        identifySealedLayers(inputs["era.expression.command.result"].value),
      ),
      index: 0,
    },
  };
}
export function selectCandidate(inputs: any) {
  const state: ReplayState =
    inputs["era.command_compaction.replay.state"].value;
  const index = state.context.candidates.findIndex(
    (_, i) => i >= state.index && candidateCanReplay(state.context, i),
  );
  return {
    candidate: { ...state, index },
    route: index < 0 ? ("done" as const) : ("replay" as const),
  };
}
export function prepareOperations(inputs: any) {
  const state: ReplayState =
    inputs["era.command_compaction.replay.state"].value;
  return {
    operations: { ...prepareCandidateOperations(state.context, state.index) },
  };
}
export function compareCandidate(inputs: any) {
  const state: ReplayState =
    inputs["era.command_compaction.replay.state"].value;
  const context = compareCandidateReplay(
    state.context,
    state.index,
    inputs["era.command.operation.result"].value,
  );
  return {
    compared_state: { context, index: state.index + 1 },
    compared_done: false,
  };
}
export function finishCandidates(inputs: any) {
  return {
    finished_state: inputs["era.command_compaction.replay.state"].value,
    finished_done: true,
  };
}
export function publishCandidates(inputs: any) {
  const state: ReplayState =
    inputs["era.command_compaction.replay.state.next"].value;
  return {
    command_compaction_result: {
      ...updateCompactionMarkers(writeSingleScopeSegments(state.context)),
    },
  };
}
