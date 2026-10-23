import { prepareEraSync } from "../domain/sync/sync_prepare.ts";
import { readMkMessageText } from "../domain/mk_engine.ts";
import type {
  EraSyncInputV1,
  EraSyncPlanV1,
  EraSyncMessageUpdateV1,
  EraSealedCompactionCandidateV1,
} from "../domain/sync/sync_types.ts";
import * as source from "./position_source.ts";
import type { PositionState } from "./sync_contracts.ts";
import type { OperationState } from "../domain/commands/operation_state.ts";

export interface PreviewState {
  input: EraSyncInputV1;
  plan: EraSyncPlanV1;
  updates: EraSyncMessageUpdateV1[];
  candidates: EraSealedCompactionCandidateV1[];
  done: boolean;
  position?: PositionState;
  route?: string;
}
export function preparePreview(input: EraSyncInputV1): PreviewState {
  return {
    input,
    plan: prepareEraSync(input),
    updates: [],
    candidates: [],
    done: false,
  };
}
/** 只选择一个正文位置；循环与指令执行都由调用方工作流承担。 */
export function selectPreviewPosition(input: PreviewState): PreviewState {
  const routed = source.routeBlockLifecycle({
    work: { plan: input.plan, step: {}, disposition: "commit" } as any,
    done: input.done,
    sourceBasis: null,
  });
  if (routed.route === "terminal")
    return { ...input, done: true, route: "terminal" };
  const origin = source.prepareFloorOrigin(routed.state);
  origin.state.position.formal = false;
  if (origin.route === "invalid")
    return { ...input, position: origin.state, route: "invalid" };
  const classified = source.classifySourceBlock(origin.state);
  return { ...input, position: classified.state, route: classified.route };
}
export function previewOperations(state: PreviewState): OperationState {
  return source.seedCommandOperations(state.position!).operations;
}
function acceptPosition(
  state: PreviewState,
  position: PositionState,
): PreviewState {
  const plan = position.state.work.plan!;
  return {
    ...state,
    plan,
    done: position.state.done,
    position: undefined,
    updates: [...state.updates, ...plan.messageUpdates],
    candidates: [...state.candidates, ...plan.sealedCompactionCandidates],
  };
}
export function acceptPreviewOperations(
  state: PreviewState,
  operations: OperationState,
): PreviewState {
  const position = {
    ...state.position!,
    position: {
      ...state.position!.position,
      operationOrigin: "command",
      operationResult: operations,
    },
  };
  return acceptPosition(
    state,
    source.advanceSourcePosition(source.markCompletedCommand(position)),
  );
}
export function advancePreviewPosition(state: PreviewState): PreviewState {
  if (state.route === "terminal") {
    const plan = state.plan;
    return {
      ...state,
      plan:
        plan.status !== "failed" && plan.execution
          ? { ...plan, execution: null }
          : plan,
      done: true,
    };
  }
  if (state.route === "invalid")
    return acceptPosition(state, source.advanceInvalidFloor(state.position!));
  const position =
    state.route === "skip"
      ? source.markSkippedCall(state.position!)
      : source.prepareSealedCandidate(source.finalizeFloor(state.position!));
  return acceptPosition(state, source.advanceSourcePosition(position));
}
export function previewResult(state: PreviewState): EraSyncPlanV1 {
  if (state.plan.status === "failed") return state.plan;
  const byId = new Map(
    state.updates.map((update) => [update.messageId, update]),
  );
  return {
    ...state.plan,
    messageUpdates: [...byId.values()].filter((update) => {
      const original = state.input.messages[update.messageIndex];
      return (
        original === undefined ||
        readMkMessageText(original) !==
          (update.content.kind === "text" ? update.content.text : "")
      );
    }),
    sealedCompactionCandidates: state.candidates,
  };
}
