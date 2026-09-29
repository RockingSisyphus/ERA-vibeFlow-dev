/** Position-preserving Agent numeric function calls. */
import { executeExpressionLayer } from "@era/vibeflow-expression/engine";
import { isRecord, cloneJson, type EraAgentFunctionCallV1 } from "./agent_configuration.ts";

export interface EraAgentExecutedCallV1 {
  readonly index: number;
  readonly function: string;
  readonly args: readonly number[];
  readonly result: number;
  readonly drawOffsetStart: number;
  readonly drawOffsetEnd: number;
}

/** 失败仍按原路径抛出；附带只读执行事实，不能将部分成功当成规划成功。 */
export class AgentFunctionCallFailure extends TypeError {
  constructor(
    message: string,
    readonly functionResults: readonly Record<string, unknown>[],
  ) {
    super(message);
  }
}

function failedCallTable(
  calls: readonly EraAgentFunctionCallV1[],
  completed: readonly EraAgentExecutedCallV1[],
  failedIndex: number,
  diagnostic: string,
): readonly Record<string, unknown>[] {
  return calls.map((call, index) => {
    const executed = completed.find((result) => result.index === index);
    if (executed)
      return {
        ...executed,
        ...(call.purpose !== undefined ? { purpose: call.purpose } : {}),
        status: "passed",
      };
    return {
      index,
      function: call.function,
      args: [...call.args],
      ...(call.purpose !== undefined ? { purpose: call.purpose } : {}),
      status: index === failedIndex ? "failed" : "not-executed",
      ...(index === failedIndex ? { diagnostic } : {}),
    };
  });
}

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
  let drawOffset = input.drawOffset ?? 0;
  const results: EraAgentExecutedCallV1[] = [];
  const knownFunctions = new Set([
    ...Object.keys(input.statFunc),
    "abs",
    "ceil",
    "clamp",
    "cos",
    "exp",
    "floor",
    "log",
    "max",
    "min",
    "pow",
    "random",
    "round",
    "sin",
    "sqrt",
    "tan",
  ]);
  for (const [index, call] of input.calls.entries()) {
    if (!knownFunctions.has(call.function)) {
      const diagnostic = `函数调用表包含未知函数：${call.function}。`;
      throw new AgentFunctionCallFailure(
        diagnostic,
        failedCallTable(input.calls, [], index, diagnostic),
      );
    }
  }
  for (const [index, call] of input.calls.entries()) {
    const expression = `${call.function}(${call.args.map((value) => JSON.stringify(value)).join(",")})`;
    const start = drawOffset;
    const response = executeExpressionLayer({
      initialState: { __eraAgentResult: 0 },
      snapshotState: isRecord(input.statData) ? cloneJson(input.statData) : {},
      functionLibrary: cloneJson(input.statFunc),
      snapshotFunctionLibrary: cloneJson(input.statFunc),
      allowSnapshots: true,
      randomContext: { sourceKey: input.sourceKey, drawOffset },
      operations: [{ path: "__eraAgentResult", expr: expression }],
    });
    if (response.diagnostics.length > 0) {
      const diagnostic = response.diagnostics[0];
      const message =
        `${call.function} 调用失败：${diagnostic?.code ?? "ERA_AGENT_FUNCTION_FAILED"} ${diagnostic?.message ?? ""}`.trim();
      throw new AgentFunctionCallFailure(
        message,
        failedCallTable(input.calls, results, index, message),
      );
    }
    const result = (response.finalState as Record<string, unknown>)
      .__eraAgentResult;
    if (typeof result !== "number" || !Number.isFinite(result)) {
      const message = `${call.function} 未返回有限数值。`;
      throw new AgentFunctionCallFailure(
        message,
        failedCallTable(input.calls, results, index, message),
      );
    }
    drawOffset = response.nextDrawOffset;
    results.push({
      index,
      function: call.function,
      args: [...call.args],
      result,
      drawOffsetStart: start,
      drawOffsetEnd: drawOffset,
    });
  }
  return { results, nextDrawOffset: drawOffset };
}
