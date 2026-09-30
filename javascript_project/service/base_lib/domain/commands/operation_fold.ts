import * as paths from "./operation_traversal.ts";
import * as functions from "./operation_functions.ts";
import * as expressions from "./operation_expressions.ts";
import { seedStageOperations } from "./operation_expressions.ts";
import {
  type OperationState,
  type ExpressionRequest,
} from "./operation_state.ts";
import { type EraAgentFunctionCallV1 } from "../../agent/agent_configuration.ts";
import {
  AgentFunctionCallFailure,
  type EraAgentExecutedCallV1,
} from "../../agent/agent_flow_types.ts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：base_lib/domain/commands/operation_fold.ts。 */
/** 只读历史/压缩重放的同步折叠。每一项动作与正式图中的真实 Node 使用同一个纯函数。 */
export function foldOperationStep(input: OperationState): OperationState {
  let { state, route } = paths.takeNextOperation(input);
  const expression = (request: ExpressionRequest): OperationState => {
    const routed = expressions.routeExpressionResult(
      expressions.evaluateExpression(request),
    );
    switch (routed.route) {
      case "value":
        return paths.appendOperationLog(
          expressions.applyExpressionValue(routed.state),
        );
      case "value-failed":
        return expressions.recordOperationDiagnostic(routed.state);
      case "library":
        return functions.applyFunctionCandidate(routed.state);
      case "library-failed":
        return functions.discardFunctionCandidate(routed.state);
      case "stage-call":
        return expressions.acceptStageCallResult(routed.state);
      case "stage-call-failed":
        return expressions.failStageCallTable(routed.state);
      default:
        throw new TypeError("未知的表达式接续分支。");
    }
  };
  switch (route) {
    case "done":
      return paths.completeOperations(state);
    case "insert": {
      const inspected = paths.inspectInsert(state);
      state =
        inspected.route === "descend"
          ? paths.pushChildPaths(inspected.state)
          : inspected.route === "apply"
            ? paths.appendOperationLog(
                paths.applyInsert(paths.inheritInsertTemplate(inspected.state)),
              )
            : paths.skipOperation(inspected.state);
      break;
    }
    case "edit": {
      const inspected = paths.inspectEdit(state);
      state =
        inspected.route === "descend"
          ? paths.pushChildPaths(inspected.state)
          : inspected.route === "assign"
            ? paths.appendOperationLog(paths.applyAssignment(inspected.state))
            : inspected.route === "expr"
              ? expression(expressions.prepareValueExpression(inspected.state))
              : paths.skipOperation(inspected.state);
      break;
    }
    case "delete": {
      const inspected = paths.inspectDelete(state);
      state =
        inspected.route === "descend"
          ? paths.pushChildPaths(inspected.state)
          : inspected.route === "apply"
            ? paths.appendOperationLog(paths.applyDelete(inspected.state))
            : paths.skipOperation(inspected.state);
      break;
    }
    case "function-group": {
      const inspected = functions.inspectFunctionGroup(state);
      state =
        inspected.route === "valid"
          ? functions.beginFunctionCandidate(inspected.state)
          : functions.discardFunctionCandidate(inspected.state);
      break;
    }
    case "function-insert":
      state = settleFunctionItem(functions.prepareFunctionInsert(state));
      break;
    case "function-edit":
      state = settleFunctionItem(functions.prepareFunctionEdit(state));
      break;
    case "function-delete": {
      const prepared = functions.prepareFunctionDelete(state);
      state =
        prepared.route === "meta"
          ? functions.beginFunctionMetaDelete(prepared.state)
          : settleFunctionItem(prepared.state);
      break;
    }
    case "function-meta-complete":
      state = settleFunctionItem(functions.finishFunctionMetaDelete(state));
      break;
    case "function-validate":
      state = expression(expressions.prepareLibraryValidation(state));
      break;
    case "stage-call":
      state = expression(expressions.prepareStageCall(state));
      break;
    case "skip":
      state = paths.skipOperation(state);
      break;
    default:
      throw new TypeError(`未知的块内操作分支：${route}`);
  }
  return paths.settleOperation(state);
}
function settleFunctionItem(input: OperationState): OperationState {
  const { state, route } = functions.checkFunctionMetadata(input);
  return route === "apply"
    ? functions.stageFunctionChange(state)
    : route === "invalid"
      ? functions.discardFunctionCandidate(state)
      : paths.skipOperation(state);
}
export function foldOperations(state: OperationState): OperationState {
  while (!state.done) state = foldOperationStep(state);
  return state;
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：base_lib/agent/agent_function_calls.ts。 */
/** 阶段调用的旧纯接口；复用正式操作图的求值步骤，保留失败事实与原随机边界。 */

export {
  AgentFunctionCallFailure,
  type EraAgentExecutedCallV1,
} from "../../agent/agent_flow_types.ts";
export function executeAgentFunctionCalls(
  input: Readonly<{
    calls: readonly EraAgentFunctionCallV1[];
    statData: unknown;
    statFunc: Readonly<Record<string, unknown>>;
    sourceKey: string;
    drawOffset?: number;
  }>,
): Readonly<{
  results: readonly EraAgentExecutedCallV1[];
  nextDrawOffset: number;
}> {
  const state = foldOperations(
    seedStageOperations({
      calls: [...input.calls],
      stat: input.statData,
      statFunc: input.statFunc as Record<string, unknown>,
      sourceKey: input.sourceKey,
      drawOffset: input.drawOffset ?? 0,
    }),
  );
  if (state.failure)
    throw new AgentFunctionCallFailure(
      state.failure.message,
      state.stageCallTable!.errorResults ?? [],
    );
  return {
    results: state.stageCallTable!.results,
    nextDrawOffset: state.randomCursor!.drawOffset,
  };
}
