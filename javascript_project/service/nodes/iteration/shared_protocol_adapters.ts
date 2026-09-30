// Adapters with identical declared base libraries share this source.
import { planProtocolBatch, type CollectionReductionV1, reduceForProtocolSlice, type EraServiceStateV1, type EraTransportEventV1, validateTransportEvent, createInitialServiceState, type BatchPlanV1, type BatchFinalizationV1, type PlannedStepV1, type BatchExecutionStateV1, type TaskResultV1 } from "../../base_lib/service_protocol_collection.ts";
import { failCoverage, finalizeBatch, createExecutionState, buildBatchResult, mergeTaskResult, selectCurrentStep, createProtocolIgnoreResult } from "../../base_lib/service_protocol_execution.ts";

type CyclePhase = "collect" | "execute";
interface CycleState {
  readonly schemaVersion: 1;
  readonly phase: CyclePhase;
  readonly payload: object;
}
type CycleInput = Readonly<Record<string, { readonly value: unknown }>>;

function wrapCycle(phase: CyclePhase, payload: object): CycleState {
  return { schemaVersion: 1, phase, payload };
}

function readCycle(inputs: CycleInput, phase?: CyclePhase): CycleState {
  const value = (inputs["era.service.cycle.state"] ?? inputs["era.service.cycle.routed"])?.value;
  if (
    value === null || typeof value !== "object" ||
    (value as CycleState).schemaVersion !== 1 ||
    ((value as CycleState).phase !== "collect" &&
      (value as CycleState).phase !== "execute") ||
    (value as CycleState).payload === null ||
    typeof (value as CycleState).payload !== "object" ||
    (phase !== undefined && (value as CycleState).phase !== phase)
  ) {
    throw new TypeError("ERA 服务阶段状态无效");
  }
  return value as CycleState;
}

export function BeginCycleNode(inputs: CycleInput): any {
  return { cycle_state_initial: wrapCycle("collect", inputs["era.service.state"].value as EraServiceStateV1) };
}

export function RouteCycleNode(inputs: CycleInput): any {
  const cycle = readCycle(inputs);
  return { cycle_route: cycle.phase, cycle_state_routed: cycle };
}

export function UnpackCollectCycleNode(inputs: CycleInput): any {
  return { service_state_current: readCycle(inputs, "collect").payload as EraServiceStateV1 };
}

export function CarryWaitCycleNode(inputs: CycleInput): any {
  const reduction = inputs["era.collection.reduction"].value as CollectionReductionV1;
  return { wait_cycle_state: wrapCycle("collect", reduction.nextState) };
}

export function BeginExecutionCycleNode(inputs: CycleInput): any {
  return { prepared_cycle_state: wrapCycle("execute", inputs["era.batch.execution.state"].value as BatchExecutionStateV1) };
}

export function UnpackExecutionCycleNode(inputs: CycleInput): any {
  return { execution_state: readCycle(inputs, "execute").payload as BatchExecutionStateV1 };
}

export function RouteCompletionCycleNode(inputs: CycleInput): any {
  return {
    completion_route: inputs["era.step.done"].value === true ? "finish" : "continue",
    routed_execution_state: inputs["era.batch.execution.state.next"].value,
  };
}

export function CarryExecutionCycleNode(inputs: CycleInput): any {
  return { settled_cycle_state: wrapCycle("execute", inputs["era.batch.execution.state"].value as BatchExecutionStateV1) };
}

export function PromoteDoneCycleNode(inputs: CycleInput): any {
  return { execution_state_after: inputs["era.batch.execution.state"].value as BatchExecutionStateV1 };
}

export function ResumeCollectCycleNode(inputs: CycleInput): any {
  return { finished_cycle_state: wrapCycle("collect", inputs["era.service.state.next"].value as EraServiceStateV1) };
}

// Original node: nodes/batch/coverage_failure.ts
interface CoverageFailure_Envelope<T> {
  readonly value: T;
}

export function CoverageFailureNode(inputs: Readonly<{
  "era.batch.execution.state": CoverageFailure_Envelope<unknown>;
}>): any {
  return {
    coverage_failure_state: failCoverage(
      inputs["era.batch.execution.state"].value as BatchExecutionStateV1,
    ),
  };
}

// Original node: nodes/batch/finalize_batch.ts
interface FinalizeBatch_Envelope<T> {
  readonly value: T;
}

export function FinalizeBatchNode(inputs: Readonly<{
  "era.batch.execution.state.after": FinalizeBatch_Envelope<unknown>;
}>): any {
  return {
    batch_finalization: finalizeBatch(
      inputs["era.batch.execution.state.after"].value as BatchExecutionStateV1,
    ),
  };
}

// Original node: nodes/batch/plan_batch.ts
interface PlanBatch_Envelope<T> {
  readonly value: T;
}

export function PlanBatchNode(inputs: Readonly<{
  "era.collection.reduction": PlanBatch_Envelope<unknown>;
}>): any {
  return {
    batch_plan: planProtocolBatch(
      inputs["era.collection.reduction"].value as CollectionReductionV1,
    ),
  };
}

// Original node: nodes/batch/validate_coverage.ts
interface ValidateCoverage_Envelope<T> {
  readonly value: T;
}

export function ValidateCoverageNode(inputs: Readonly<{
  "era.batch.plan": ValidateCoverage_Envelope<unknown>;
}>): any {
  const result = createExecutionState(
    inputs["era.batch.plan"].value as BatchPlanV1,
  );
  return {
    coverage_route: result.route,
    execution_state: result.state,
  };
}

// Original node: nodes/iteration/reduce_collection.ts
interface ReduceCollection_Envelope<T> {
  readonly value: T;
}

interface ReduceCollection_Params {
  readonly _global?: Readonly<Record<string, unknown>>;
}

export function ReduceCollectionNode(
  inputs: Readonly<{
    "era.service.state.current": ReduceCollection_Envelope<unknown>;
    "era.transport.event": ReduceCollection_Envelope<unknown>;
  }>,
  params: ReduceCollection_Params,
): any {
  const result = reduceForProtocolSlice(
    inputs["era.service.state.current"].value as EraServiceStateV1,
    inputs["era.transport.event"].value as EraTransportEventV1,
    params._global ?? {},
  );
  return {
    collection_reduction: result.reduction,
    collection_control: result.control,
  };
}

// Original node: nodes/iteration/route_iteration.ts
interface RouteIteration_Envelope<T> {
  readonly value: T;
}

export function RouteIterationNode(inputs: Readonly<{
  "era.collection.reduction": RouteIteration_Envelope<unknown>;
}>): any {
  const reduction = inputs["era.collection.reduction"].value as CollectionReductionV1;
  return { iteration_route: reduction.route };
}

// Original node: nodes/iteration/validate_transport.ts
interface ValidateTransport_Envelope<T> {
  readonly value: T;
}

interface ValidateTransport_Params {
  readonly _global?: Readonly<Record<string, unknown>>;
}

export function ValidateTransportNode(
  inputs: Readonly<{ "era.transport.event.raw": ValidateTransport_Envelope<unknown> }>,
  params: ValidateTransport_Params,
): any {
  return {
    transport_event: validateTransportEvent(
      inputs["era.transport.event.raw"].value,
      params._global ?? {},
    ),
  };
}

// Original node: nodes/lifecycle/initialize_state.ts
export function InitializeStateNode(): any {
  return { service_state_initial: createInitialServiceState() };
}

// Original node: nodes/publish/build_outbound.ts
interface BuildOutbound_Envelope<T> {
  readonly value: T;
}

export function BuildOutboundNode(inputs: Readonly<{
  "era.batch.finalization": BuildOutbound_Envelope<unknown>;
}>): any {
  const result = buildBatchResult(
    inputs["era.batch.finalization"].value as BatchFinalizationV1,
  );
  return {
    batch_result_frame: result.frame,
    batch_fatal_flag: result.frame.fatal,
    post_batch_state: result.state,
  };
}

// Original node: nodes/publish/continue_state.ts
interface ContinueState_Envelope<T> {
  readonly value: T;
}

export function ContinueStateNode(inputs: Readonly<{
  "era.service.state.post_batch": ContinueState_Envelope<unknown>;
}>): any {
  return {
    continued_state_next:
      inputs["era.service.state.post_batch"].value as EraServiceStateV1,
  };
}

// Original node: nodes/publish/raise_fatal.ts
interface RaiseFatal_Envelope<T> {
  readonly value: T;
}

export function RaiseFatalNode(_inputs: Readonly<{
  "era.service.state.post_batch": RaiseFatal_Envelope<unknown>;
}>): { readonly fatal_state_next: EraServiceStateV1 } {
  throw new Error("ERA_SERVICE_FATAL_AFTER_BATCH_RESULT");
}

// Original node: nodes/step/dispatch_task.ts
interface DispatchTask_Envelope<T> {
  readonly value: T;
}

export function DispatchTaskNode(inputs: Readonly<{
  "era.step.request.routed": DispatchTask_Envelope<unknown>;
  "era.task.route": DispatchTask_Envelope<unknown>;
  "era.batch.execution.state": DispatchTask_Envelope<unknown>;
}>): any {
  const route = inputs["era.task.route"].value;
  if (
    route !== "sync" && route !== "update-mk" &&
    route !== "agent-settings" && route !== "ignore"
  ) {
    throw new TypeError("简单任务节点只接受已准备的 sync、update-mk、agent-settings 或 ignore 路由。");
  }
  return {
    simple_task_route: route,
    routed_step_for_task: inputs["era.step.request.routed"].value,
    execution_state_for_task: inputs["era.batch.execution.state"].value,
  };
}

// Original node: nodes/step/merge_task_result.ts
interface MergeTaskResult_Envelope<T> {
  readonly value: T;
}

export function MergeTaskResultNode(inputs: Readonly<{
  "era.batch.execution.state": MergeTaskResult_Envelope<unknown>;
  "era.task.result": MergeTaskResult_Envelope<unknown>;
}>): any {
  const result = mergeTaskResult(
    inputs["era.batch.execution.state"].value as BatchExecutionStateV1,
    inputs["era.task.result"].value as TaskResultV1,
  );
  return {
    execution_state_next: result.state,
    step_done: result.done,
  };
}

// Original node: nodes/step/select_step.ts
interface SelectStep_Envelope<T> {
  readonly value: T;
}

export function SelectStepNode(inputs: Readonly<{
  "era.batch.execution.state": SelectStep_Envelope<unknown>;
}>): any {
  const state = inputs["era.batch.execution.state"].value as BatchExecutionStateV1;
  return {
    selected_step: selectCurrentStep(state),
    prepared_execution_state: state,
  };
}

// Original node: nodes/step/task_ignore.ts
interface TaskIgnore_Envelope<T> {
  readonly value: T;
}

export function TaskIgnoreNode(
  inputs: Readonly<{
    "era.step.request.routed": TaskIgnore_Envelope<unknown>;
  }>,
): any {
  const step = inputs["era.step.request.routed"].value as PlannedStepV1;
  if (step.kind !== "ignore") {
    throw new TypeError("忽略任务节点只接受 kind=ignore 的严格步骤");
  }
  return { ignore_task_result: createProtocolIgnoreResult(step) };
}
