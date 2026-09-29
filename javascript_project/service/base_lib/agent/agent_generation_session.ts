export { agentConfigurationVersion,agentRequestContext,attemptProfile,buildAgentRetryFeedback,cloneJson,ERA_AGENT_MAX_RETRIES,ERA_AGENT_SCHEMA_VERSION,isAgentEnabled,isAgentPlanningFailureMessage,isRecord,normalizeAgentConfiguration,sanitizePresetSnapshot,type EraAgentFailedAttempt } from "./agent_configuration.ts";
export type { EraAgentAttemptProfileV1,EraAgentAttemptProfileV2,EraAgentConfiguration,EraAgentConfigurationV1,EraAgentConfigurationV2,EraAgentFunctionCallV1,EraAgentModelSourceV2,EraAgentPlanningOutputV1,EraAgentPresetSnapshotV1,EraAgentPresetSnapshotV2,EraAgentRequestContext,EraAgentRolePromptV1,EraAgentStage,EraAgentStageConfigurationV1,EraAgentStageConfigurationV2 } from "./agent_configuration.ts";
export { AgentFunctionCallFailure,executeAgentFunctionCalls,type EraAgentExecutedCallV1 } from "./agent_function_calls.ts";
export { buildStoryInjection,builtinStagePrompts,countAgentCycles,extractEraMessageKey,formatAgentPlanReport,formatAgentUpdateReport,isolateStoryEraCommands,stripAgentReportsForPrompt } from "./agent_report_text.ts";
import type { JsonValue } from "@era/vibeflow-contracts";
import type { EraAgentFunctionCallV1,EraAgentPlanningOutputV1 } from "./agent_configuration.ts";
import { cloneJson,isRecord } from "./agent_configuration.ts";
import { splitAgentStageText } from "./agent_stage_text.ts";

export const ERA_AGENT_MAX_CALLS = 32;
export const ERA_AGENT_MAX_TRACE_CHARS = 131072;

export type EraAgentRetryKind = "planning" | "story" | "settlement";

/** Observation identity is explicit, independent of random sourceKey and message MK. */
function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  if (unfenced.length > ERA_AGENT_MAX_TRACE_CHARS)
    throw new RangeError(`${label}超过长度上限。`);
  let value: unknown;
  try {
    value = JSON.parse(unfenced);
  } catch (error) {
    throw new SyntaxError(
      `${label}不是严格 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isRecord(value)) throw new TypeError(`${label}必须是 JSON 对象。`);
  return value;
}

export function parsePlanningOutput(raw: string): EraAgentPlanningOutputV1 {
  const separated = splitAgentStageText(raw);
  const value = parseJsonObject(separated.json, "规划响应");
  if (!isRecord(value.storyPlan) || !Array.isArray(value.calls)) {
    throw new TypeError("规划响应必须包含 storyPlan 对象与 calls 数组。");
  }
  if (value.calls.length > ERA_AGENT_MAX_CALLS) {
    throw new RangeError(`规划函数调用不得超过 ${ERA_AGENT_MAX_CALLS} 项。`);
  }
  const calls = value.calls.map((candidate, index): EraAgentFunctionCallV1 => {
    if (
      !isRecord(candidate) ||
      typeof candidate.function !== "string" ||
      !Array.isArray(candidate.args)
    ) {
      throw new TypeError(`calls[${index}] 缺少 function 或 args。`);
    }
    const name = candidate.function.trim();
    if (!/^[A-Za-z_$][\w$]*$/u.test(name))
      throw new TypeError(`calls[${index}] 的函数名无效。`);
    if (
      !candidate.args.every(
        (item) => typeof item === "number" && Number.isFinite(item),
      )
    ) {
      throw new TypeError(`calls[${index}] 只允许有限数值参数。`);
    }
    const purpose =
      typeof candidate.purpose === "string"
        ? candidate.purpose.slice(0, 2048)
        : undefined;
    return purpose
      ? { function: name, args: candidate.args as number[], purpose }
      : { function: name, args: candidate.args as number[] };
  });
  return {
    ...(separated.before ? { instructionsBefore: separated.before } : {}),
    ...(separated.after ? { instructionsAfter: separated.after } : {}),
    storyPlan: cloneJson(value.storyPlan) as Record<string, JsonValue>,
    calls,
  };
}

export function agentRetryMatchesSession(
  retry: Record<string, unknown>,
  session: Record<string, unknown>,
): boolean {
  const attempts =
    session[
      retry.kind === "planning" ? "planningAttempts" : "settlementAttempts"
    ];
  const last = Array.isArray(attempts) ? attempts.at(-1) : null;
  const requestId =
    retry.kind === "story"
      ? session.storyRequestId
      : isRecord(last)
        ? last.requestId
        : undefined;
  return (
    (retry.requestId === undefined || retry.requestId === requestId) &&
    (retry.messageId === undefined || retry.messageId === session.messageId) &&
    (retry.cycleIndex === undefined ||
      retry.cycleIndex === session.cycleIndex) &&
    (retry.sourceKey === undefined || retry.sourceKey === session.sourceKey)
  );
}
