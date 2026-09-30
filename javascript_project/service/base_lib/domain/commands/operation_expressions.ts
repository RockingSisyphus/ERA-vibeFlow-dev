import { executeExpressionLayer } from "@era/vibeflow-expression/engine";
import { cloneCrudValue, isPlainRecord } from "./crud_parser.ts";
import {
  publicEditPath,
  editDiagnostic,
  functionDiagnostic,
  getAtPath,
  setAtPath,
} from "./crud_mutations.ts";
import {
  failedCallTable,
  unknownStageFunction,
} from "../../agent/agent_flow_types.ts";
import {
  forkOperation,
  type OperationState,
  type ExpressionRequest,
  type ExpressionResponse,
} from "./operation_state.ts";

export function seedStageOperations(input: {
  calls: any[];
  stat: any;
  statFunc: Record<string, unknown>;
  sourceKey: string;
  drawOffset: number;
  validationError?: string;
}): OperationState {
  const table = {
    calls: input.calls,
    index: 0,
    results: [] as any[],
    validationError: input.validationError,
  };
  const state: OperationState = {
    mode: "stage-calls",
    commands: [],
    commandIndex: 0,
    rootIndex: 0,
    stack: [],
    stat: input.stat,
    statFunc: input.statFunc,
    messageStartStat: input.stat,
    messageStartStatFunc: input.statFunc,
    randomCursor: { sourceKey: input.sourceKey, drawOffset: input.drawOffset },
    functionGroup: null,
    stageCallTable: table,
    editLog: [],
    functionEditLog: [],
    diagnostics: [],
    done: false,
    failure: null,
    context: { messageId: 0, meta: {}, exposesFunctionState: false },
    pendingAction: null,
  };
  if (input.validationError) state.failure = { message: input.validationError };
  else {
    const index = unknownStageFunction(input.calls, input.statFunc);
    if (index >= 0) {
      const message = `函数调用表包含未知函数：${input.calls[index].function}。`;
      state.failure = { message };
      state.stageCallTable = {
        ...table,
        errorResults: failedCallTable(input.calls, [], index, message),
      };
    }
  }
  return state;
}
export function prepareValueExpression(
  state: OperationState,
): ExpressionRequest {
  const a = state.pendingAction!;
  return {
    purpose: "value",
    operationState: state,
    request: {
      initialState: cloneCrudValue(state.stat),
      snapshotState: cloneCrudValue(state.messageStartStat),
      functionLibrary: state.statFunc,
      snapshotFunctionLibrary: state.messageStartStatFunc,
      allowSnapshots: true,
      ...(state.randomCursor ? { randomContext: state.randomCursor } : {}),
      operations: [{ path: publicEditPath(a.path), expr: a.patch.$expr }],
    },
  };
}
export function prepareLibraryValidation(
  state: OperationState,
): ExpressionRequest {
  return {
    purpose: "library",
    operationState: state,
    request: {
      initialState: {},
      functionLibrary: state.functionGroup!.candidate,
      operations: [],
    },
  };
}
export function prepareStageCall(state: OperationState): ExpressionRequest {
  const call = state.pendingAction!.patch;
  return {
    purpose: "stage-call",
    operationState: state,
    request: {
      initialState: { __eraAgentResult: 0 },
      snapshotState: isPlainRecord(state.stat)
        ? cloneCrudValue(state.stat)
        : {},
      functionLibrary: cloneCrudValue(state.statFunc),
      snapshotFunctionLibrary: cloneCrudValue(state.statFunc),
      allowSnapshots: true,
      randomContext: state.randomCursor,
      operations: [
        {
          path: "__eraAgentResult",
          expr: `${call.function}(${call.args.map((value: number) => JSON.stringify(value)).join(",")})`,
        },
      ],
    },
  };
}
export function evaluateExpression(
  request: ExpressionRequest,
): ExpressionResponse {
  return {
    purpose: request.purpose,
    operationState: request.operationState,
    response: executeExpressionLayer(request.request),
  };
}
export function routeExpressionResult(input: ExpressionResponse): {
  state: OperationState;
  route: string;
} {
  const state = forkOperation(input.operationState),
    a = state.pendingAction!,
    response = input.response;
  a.response = response;
  const detail = response.diagnostics[0];
  if (input.purpose === "library") {
    if (detail)
      a.diagnostic = functionDiagnostic(
        detail.code,
        "<library>",
        detail.message,
      );
    return { state, route: detail ? "library-failed" : "library" };
  }
  const value =
    input.purpose === "value"
      ? getAtPath(response.finalState, publicEditPath(a.path))
      : response.finalState.__eraAgentResult;
  a.value = value;
  const invalid =
    !!detail || typeof value !== "number" || !Number.isFinite(value);
  if (input.purpose === "value") {
    // 失败的表达式也保留已经消耗的随机位置。
    if (state.randomCursor)
      state.randomCursor = {
        ...state.randomCursor,
        drawOffset: response.nextDrawOffset,
      };
    if (invalid)
      a.diagnostic = editDiagnostic(
        detail?.code ?? "ERA_EDIT_RESULT_NON_FINITE",
        a.path,
        detail?.message ?? "$expr 未得到有限数值结果。",
      );
    return { state, route: invalid ? "value-failed" : "value" };
  }
  if (invalid)
    a.diagnostic = {
      code: detail?.code ?? "ERA_AGENT_FUNCTION_FAILED",
      path: "",
      message: detail
        ? `${a.patch.function} 调用失败：${detail.code} ${detail.message}`.trim()
        : `${a.patch.function} 未返回有限数值。`,
    };
  return { state, route: invalid ? "stage-call-failed" : "stage-call" };
}
export function applyExpressionValue(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!;
  if (!a.path) return state;
  const value = Object.is(a.value, -0) ? 0 : a.value;
  state.stat = cloneCrudValue(state.stat);
  setAtPath(state.stat, a.path, value);
  state.context.pendingLog = {
    op: "update",
    path: a.path,
    value_old: cloneCrudValue(a.current),
    value_new: value,
  };
  return state;
}
export function acceptStageCallResult(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!,
    table = state.stageCallTable!;
  const drawOffsetStart = state.randomCursor!.drawOffset,
    drawOffsetEnd = a.response.nextDrawOffset;
  state.stageCallTable = {
    ...table,
    index: table.index + 1,
    results: [
      ...table.results,
      {
        index: table.index,
        function: a.patch.function,
        args: [...a.patch.args],
        result: a.value,
        drawOffsetStart,
        drawOffsetEnd,
      },
    ],
  };
  state.randomCursor = { ...state.randomCursor!, drawOffset: drawOffsetEnd };
  return state;
}
export function recordOperationDiagnostic(
  input: OperationState,
): OperationState {
  const state = forkOperation(input);
  state.diagnostics.push(state.pendingAction!.diagnostic!);
  return state;
}
export function failStageCallTable(input: OperationState): OperationState {
  const state = forkOperation(input),
    table = state.stageCallTable!,
    message = state.pendingAction!.diagnostic!.message;
  state.failure = { message };
  state.stageCallTable = {
    ...table,
    errorResults: failedCallTable(
      table.calls,
      table.results,
      table.index,
      message,
    ),
  };
  return state;
}
