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


/** 选择作者调用、正文指令、阶段调用或消息收尾。 */
export function ChooseMessageActionNode(inputs: any): any {
 const lifecycle = routeBlockLifecycle(inputs['era.sync.block.step.state'].value);
 if(lifecycle.route !== 'source') return {message_position:lifecycle.state,message_action:'author'};
 const floor = prepareFloorOrigin(lifecycle.state);
 if(floor.route === 'invalid') return {message_position:advanceInvalidFloor(floor.state),message_action:'complete'};
 const stage = routeStagePosition(floor.state);
 if(stage.route === 'calls') return {message_position:stage.state,message_action:'operations'};
 const block = classifySourceBlock(stage.state);
 return {message_position:block.state,message_action:block.route === 'command' ? 'operations' : block.route === 'floor-end' ? 'message-end' : block.route};
}
/** 准备本段正文指令或生成阶段调用的有序操作。 */
export function PrepareMessageOperationsNode(inputs: any): any {
 const position = inputs['era.sync.position.state'].value;
 const result = routeStagePosition(position).route === 'calls' ? seedStageOperations(position) : seedCommandOperations(position);
 return {seed_command_operations_operation_state:result.operations,seed_command_operations_position_state:result.state};
}
/** 将完整操作结果写回正文进度或阶段结果表。 */
export function AcceptMessageOperationsNode(inputs: any): any {
 const result = acceptOperationResult(inputs['era.sync.position.state'].value,inputs['era.command.operation.result'].value);
 return {operations_position:result.route === 'command' ? advanceSourcePosition(markCompletedCommand(result.state)) : acceptStageCallTable(result.state)};
}
/** 标记已跳过的正文调用并移至下一处。 */
export function SkipMessageCallNode(inputs: any): any {
 return {skipped_position:advanceSourcePosition(markSkippedCall(inputs['era.sync.position.state'].value))};
}
/** 完成一条消息，保存整理候选并推进消息位置。 */
export function FinishMessageNode(inputs: any): any {
 return {finished_position:advanceSourcePosition(prepareSealedCandidate(finalizeFloor(inputs['era.sync.position.state'].value)))};
}
/** 整理作者或阶段进度，把结果交给正文压缩与发布。 */
export function FinishMessageStepNode(inputs: any): any {
 const state = finishPositionStep(inputs['era.sync.position.state'].value);
 return {expression_command_result:blockWorkResult(state)};
}

/** 将本次消息执行状态交给正文压缩与内存发布。 */
export function blockWorkResult(state: any): any { return {...state.work, blockStepState:state}; }
