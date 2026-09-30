import type {
  BatchExecutionStateV1,
  PlannedStepV1,
  TaskResultV1,
} from "./service_types.ts";

/** 当前在途任务的局部接续；不入 FIFO，不跨 Service 迭代持久化。 */
export interface TaskContinuation {
  readonly origin: "sync" | "initialize" | "api" | "agent";
  readonly step: PlannedStepV1;
  readonly executionState: BatchExecutionStateV1;
  readonly apiContext?: any;
}
export interface ExecutionRequest {
  readonly kind: "sync" | "commit" | "candidate" | "update-mk" | "direct";
  readonly payload: any;
}
export interface PreparedTask {
  readonly request: ExecutionRequest;
  readonly continuation: TaskContinuation;
}
export interface ExecutedTask {
  readonly kind: "sync" | "commit" | "update-mk" | "direct";
  readonly value: TaskResultV1;
  readonly continuation: TaskContinuation;
}
export type NodeInputs = Readonly<Record<string, { readonly value: any }>>;

export function prepared(
  kind: ExecutionRequest["kind"],
  payload: any,
  continuation: TaskContinuation,
): PreparedTask {
  return { request: { kind, payload }, continuation };
}

/** 每条执行分支带回同一接续对象；专用请求仅在选中分支提取。 */
export function executionPorts(task: PreparedTask): any {
  const { request, continuation } = task;
  return {
    execution_route: request.kind,
    execution_request: request,
    continuation,
    execution_step: request.payload.step ?? continuation.step,
    execution_batch:
      request.payload.executionState ?? continuation.executionState,
  };
}
