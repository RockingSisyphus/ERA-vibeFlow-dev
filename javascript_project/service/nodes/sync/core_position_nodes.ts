import {
  acceptOperationResult,
  acceptStageCallTable,
  advanceInvalidFloor,
  advanceSourcePosition,
  classifySourceBlock,
  finalizeFloor,
  forkPosition,
  withPlan,
  markCompletedCommand,
  markSkippedCall,
  prepareFloorOrigin,
  prepareSealedCandidate,
  routeBlockLifecycle,
  routeStagePosition,
  seedCommandOperations,
} from "../../base_lib/sync/position_source.ts";
import { type PositionState } from "../../base_lib/sync/sync_contracts.ts";
import {
  consumeStagePrefix,
  rejectStageOperation,
} from "../../base_lib/agent/agent_stage_program.ts";
import { metaWith } from "../../base_lib/domain/sync/sync_divergence.ts";
import {
  callAnchor,
  currentFunctionBlock,
  replaceFunctionText,
} from "../../base_lib/sync/function_block_execution.ts";
import { seedStageOperations as seedCalls } from "../../base_lib/domain/commands/operation_expressions.ts";
import { type OperationState } from "../../base_lib/domain/commands/operation_state.ts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/accept_operation_result.ts。 */
export function AcceptOperationResultNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = acceptOperationResult(
    inputs["era.sync.position.state"].value,
    inputs["era.command.operation.result"].value,
  );
  return {
    accept_operation_result_position_state: result.state,
    accept_operation_result_operation_origin_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/accept_stage_call_table.ts。 */
export function AcceptStageCallTableNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  return {
    accept_stage_call_table_position_state: acceptStageCallTable(
      inputs["era.sync.position.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/advance_invalid_floor.ts。 */
export function AdvanceInvalidFloorNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  return {
    advance_invalid_floor_position_state: advanceInvalidFloor(
      inputs["era.sync.position.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/advance_source_position.ts。 */
export function AdvanceSourcePositionNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  return {
    advance_source_position_position_state: advanceSourcePosition(
      inputs["era.sync.position.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/classify_source_block.ts。 */
export function ClassifySourceBlockNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = classifySourceBlock(inputs["era.sync.position.state"].value);
  return {
    classify_source_block_position_state: result.state,
    classify_source_block_source_block_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/finalize_floor.ts。 */
export function FinalizeFloorNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  return {
    finalize_floor_position_state: finalizeFloor(
      inputs["era.sync.position.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/finish_position_step.ts。 */
export function finishPositionStep(position: PositionState): any {
  let state = position.state;
  if (position.consumedSource) {
    const frame = position.position?.originalFrame;
    if (frame?.phase === "applying")
      state = {
        ...state,
        functionFrame: { ...frame, remaining: frame.remaining - 1 },
      };
    else state = consumeStagePrefix(state, position.position?.sourceMessageId);
  }
  return rejectStageOperation(state, position.diagnosticsBefore);
}
export function FinishPositionStepNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  return {
    finish_position_step_block_step_pending: finishPositionStep(
      inputs["era.sync.position.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/install_author_frame.ts。 */
export function installAuthorFrame(input: PositionState): PositionState {
  let state = forkPosition(input),
    p = state.position,
    plan: any = state.state.work.plan;
  p.selected[p.index] = p.ensured.mk;
  state = withPlan(state, {
    ...plan,
    meta: metaWith(plan.meta, p.selected, p.editLogs, p.functionEditLogs),
  });
  const id = `${state.state.work.step.stepId}:call:${p.index}:${plan.execution.blockIndex}`;
  state.state = {
    ...state.state,
    functionFrame: {
      id,
      callIndex: plan.execution.blockIndex,
      appliedBlocks: 0,
      phase: "start",
      remaining: 0,
      request: null,
    },
  };
  const { text } = currentFunctionBlock(state.state);
  state.state = replaceFunctionText(
    state.state,
    text.slice(0, p.block.call.end) +
      callAnchor(state.state) +
      text.slice(p.block.call.end),
  );
  return state;
}
export function InstallAuthorFrameNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  return {
    install_author_frame_position_state: installAuthorFrame(
      inputs["era.sync.position.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/mark_completed_command.ts。 */
export function MarkCompletedCommandNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  return {
    mark_completed_command_position_state: markCompletedCommand(
      inputs["era.sync.position.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/mark_skipped_call.ts。 */
export function MarkSkippedCallNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  return {
    mark_skipped_call_position_state: markSkippedCall(
      inputs["era.sync.position.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/prepare_floor_origin.ts。 */
export function PrepareFloorOriginNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = prepareFloorOrigin(inputs["era.sync.position.state"].value);
  return {
    prepare_floor_origin_position_state: result.state,
    prepare_floor_origin_floor_origin_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/prepare_sealed_candidate.ts。 */
export function PrepareSealedCandidateNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  return {
    prepare_sealed_candidate_position_state: prepareSealedCandidate(
      inputs["era.sync.position.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/route_block_lifecycle.ts。 */
export function RouteBlockLifecycleNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = routeBlockLifecycle(inputs["era.sync.block.step.state"].value);
  return {
    route_block_lifecycle_position_state: result.state,
    route_block_lifecycle_block_lifecycle_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/route_stage_position.ts。 */
export function RouteStagePositionNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = routeStagePosition(inputs["era.sync.position.state"].value);
  return {
    route_stage_position_position_state: result.state,
    route_stage_position_stage_position_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/seed_command_operations.ts。 */
export function SeedCommandOperationsNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = seedCommandOperations(inputs["era.sync.position.state"].value);
  return {
    seed_command_operations_operation_state: result.operations,
    seed_command_operations_position_state: result.state,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/seed_stage_operations.ts。 */
export function seedStageOperations(input: PositionState): {
  state: PositionState;
  operations: OperationState;
} {
  const state = forkPosition(input),
    plan: any = state.state.work.plan,
    stage: any = state.state.stageOutcome;
  const work = stage.stageWorkInput,
    program = work.program;
  state.position.operationOrigin = "stage-calls";
  return {
    state,
    operations: seedCalls({
      calls: program.calls,
      stat: plan.stat,
      statFunc: plan.statFunc,
      sourceKey: work.session.sourceKey ?? work.stageFloor.mk,
      drawOffset: work.session.nextDrawOffset ?? 0,
      validationError: program.validationError,
    }),
  };
}
export function SeedStageOperationsNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = seedStageOperations(inputs["era.sync.position.state"].value);
  return {
    seed_stage_operations_operation_state: result.operations,
    seed_stage_operations_position_state: result.state,
  };
}
