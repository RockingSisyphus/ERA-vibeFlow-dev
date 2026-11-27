/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
/** Agent planning stage: same request and side-effect order as the original Node. */
import { splitAgentStageText } from "./agent_stage_text.ts";
import { joinStageParts } from "./agent_stage_layout.ts";
import { parsePlanningOutput } from "./agent_generation_session.ts";
import { AgentFunctionCallFailure, type EraAgentExecutedCallV1, } from "./agent_flow_types.ts";
import { buildAgentRetryFeedback, agentRequestContext, type EraAgentFailedAttempt, attemptProfile, type EraAgentConfigurationV2, type EraAgentPlanningOutputV1, } from "./agent_configuration.ts";
import { extractEraMessageKey, formatAgentPlanReport, } from "./agent_report_text.ts";
import { AgentSessionFailure, isRecord, failureMessage, throwHostGenerationFailure, chatKey, stateContext, latestMessage, lastUserText, sessionObject, boundedTrace, stageRequest, sessionExecution } from "./agent_generation_context.ts";
import type { GenerationTrigger } from "./agent_flow_types.ts";
export function* runPlanningProgress(capability: any, configuration: EraAgentConfigurationV2, context: Record<string, unknown>, trigger: GenerationTrigger): Generator<any, Record<string, unknown>, any> {
    const state = stateContext(context);
    const key = chatKey(context);
    const previousSession = sessionObject(context);
    const latest = latestMessage(context);
    const messageKey = latest && typeof latest.message === "string"
        ? extractEraMessageKey(latest.message)
        : null;
    const generationIdentity = isRecord(trigger.cycleIdentity)
        ? trigger.cycleIdentity
        : null;
    const sourceKey = (typeof generationIdentity?.sourceKey === "string"
        ? generationIdentity.sourceKey
        : null) ??
        messageKey ??
        `${key}:agent:${trigger.sequence}`;
    const drawOffset = previousSession?.sourceKey === sourceKey &&
        Number.isSafeInteger(previousSession.nextDrawOffset)
        ? Number(previousSession.nextDrawOffset)
        : 0;
    const retry = isRecord(context.candidateRetry) &&
        context.candidateRetry.stage === "planning"
        ? context.candidateRetry
        : null;
    const attempts: Record<string, unknown>[] = Array.isArray(retry?.attempts)
        ? [...retry.attempts]
        : [];
    let failure: EraAgentFailedAttempt | undefined = retry?.failure as EraAgentFailedAttempt | undefined;
    let correction: EraAgentFailedAttempt | undefined = failure;
    for (let attempt = Number(retry?.nextAttempt ?? 0); attempt <= configuration.planning.retryCount; attempt += 1) {
        const profile = attemptProfile(configuration.planning, attempt);
        let response: string | undefined;
        let responseValidated = false;
        const requestContext = agentRequestContext(sessionExecution(previousSession, trigger.eventId), attempt, failure);
        let requestId: string | undefined;
        let requestRoute: Record<string, unknown> | undefined;
        const userInput = [
            "请规划接下来的正式故事，并给出必要的纯函数调用表。",
            `用户输入：${lastUserText(context)}`,
            `当前变量：${JSON.stringify(state.statData)}`,
            `可用函数：${JSON.stringify(state.statFunc)}`,
            buildAgentRetryFeedback(correction),
        ]
            .filter(Boolean)
            .join("\n");
        try {
            const generated = yield { kind: "resource", capability: capability, operation: "generate", input: stageRequest(profile, "planning", userInput, `era-plan-${trigger.eventId}-${attempt}`, requestContext) };
            requestId =
                isRecord(generated) && typeof generated.requestId === "string"
                    ? generated.requestId
                    : undefined;
            requestRoute =
                isRecord(generated) && isRecord(generated.route)
                    ? generated.route
                    : undefined;
            throwHostGenerationFailure(generated);
            response =
                isRecord(generated) && typeof generated.response === "string"
                    ? generated.response
                    : "";
            let plan: EraAgentPlanningOutputV1;
            let candidateValidationError: string | null = null;
            try {
                plan = parsePlanningOutput(response);
            }
            catch (error) {
                const parts = splitAgentStageText(response);
                plan = {
                    storyPlan: {},
                    calls: [],
                    instructionsBefore: parts.before,
                    instructionsAfter: parts.after,
                };
                candidateValidationError = failureMessage(error);
            }
            // The calls execute between the surrounding blocks, against their
            // accumulated state. Generation only supplies the ordered candidate.
            const executed: {
                results: readonly EraAgentExecutedCallV1[];
                nextDrawOffset: number;
            } = {
                results: [],
                nextDrawOffset: drawOffset,
            };
            responseValidated = true;
            attempts.push({
                attempt,
                requestContext,
                status: "passed",
                response: boundedTrace(response),
                ...(requestId ? { requestId } : {}),
                ...(requestRoute ? { route: requestRoute } : {}),
                functionResults: executed.results.map((result) => ({
                    ...result,
                    status: "passed",
                    ...(plan.calls[result.index]?.purpose !== undefined
                        ? { purpose: plan.calls[result.index].purpose }
                        : {}),
                })),
                preset: profile.preset.source,
                ...(profile.preset.source === "snapshot" && profile.preset.sourceName
                    ? { presetName: profile.preset.sourceName }
                    : {}),
                modelSource: profile.modelSource,
            });
            return {
                ...(previousSession ?? {}),
                schemaVersion: 1,
                chatKey: key,
                status: "planned",
                cycleIndex: Number(previousSession?.cycleIndex ?? 0),
                sourceKey,
                configuration,
                preState: state,
                plan,
                planningDraft: joinStageParts([plan.instructionsBefore, plan.instructionsAfter]),
                functionResults: executed.results,
                nextDrawOffset: executed.nextDrawOffset,
                planningAttempts: attempts,
                candidateStartSession: previousSession,
                candidateSourceResponse: response,
                candidateValidationError,
                planReport: formatAgentPlanReport({
                    plan,
                    functionResults: executed.results,
                }),
            };
        }
        catch (error) {
            if (responseValidated)
                throw error;
            failure = { response, diagnostic: failureMessage(error), requestId };
            // A failed request must preserve the last rejected model candidate.
            if (response !== undefined)
                correction = failure;
            attempts.push({
                attempt,
                requestContext,
                status: "failed",
                response: boundedTrace(response ?? ""),
                diagnostic: failure.diagnostic,
                ...(requestId ? { requestId } : {}),
                ...(requestRoute ? { route: requestRoute } : {}),
                ...(error instanceof AgentFunctionCallFailure
                    ? { functionResults: error.functionResults }
                    : {}),
                preset: profile.preset.source,
                ...(profile.preset.source === "snapshot" && profile.preset.sourceName
                    ? { presetName: profile.preset.sourceName }
                    : {}),
                modelSource: profile.modelSource,
            });
        }
    }
    yield { kind: "resource", capability: capability, operation: "stop_native_generation", input: { reason: "planning-exhausted" } };
    const report = '<era_agent_error>{"stage":"planning","status":"failed"}</era_agent_error>';
    yield { kind: "resource", capability: capability, operation: "create_error_message", input: { message: report } };
    yield { kind: "resource", capability: capability, operation: "clear_session", input: { chatKey: key } };
    throw new AgentSessionFailure("ERA_AGENT_PLANNING_EXHAUSTED", `规划阶段在 ${configuration.planning.retryCount + 1} 次尝试后仍失败。`);
}
