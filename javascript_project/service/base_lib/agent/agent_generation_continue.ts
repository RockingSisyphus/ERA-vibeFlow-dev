/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
/** Resume an approved stage at its original commit point. */
import { writeSessionProgress, isRecord, chatKey, stateContext, latestMessage, sessionObject, outcome, requestIdentity} from "./agent_generation_context.ts";
import { runSettlementProgress, retryStoryProgress } from "./agent_generation_settlement.ts";
import { buildStoryInjection } from "./agent_report_text.ts";
import { joinStageParts } from "./agent_stage_layout.ts";
import type { EraAgentConfigurationV2, EraAgentPlanningOutputV1 } from "./agent_configuration.ts";
import type { EraAgentFloorCandidateV1 } from "@era/vibeflow-contracts";
import type { GenerationTrigger, GenerationRequest, AgentOutcome } from "./agent_flow_types.ts";

/** 只保留等待期间另行追加的事务；已在原消息或已完成阶段中的作者记录不再复制。 */
function additionalTransactions(current: string, original: string, stageContent: string): string[] {
    const covered = new Map<string, number>();
    for (const content of [original, stageContent]) {
        const counts = new Map<string, number>();
        for (const match of content.matchAll(/<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu)) {
            const transaction = match[0];
            const count = (counts.get(transaction) ?? 0) + 1;
            counts.set(transaction, count);
            covered.set(transaction, Math.max(covered.get(transaction) ?? 0, count));
        }
    }
    return [...current.matchAll(/<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu)]
        .map(match => match[0])
        .filter(transaction => {
            const count = covered.get(transaction) ?? 0;
            if (count === 0) return true;
            covered.set(transaction, count - 1);
            return false;
        });
}

export function* continueAgentStageProgress(capability: any, configuration: EraAgentConfigurationV2, rawContext: Record<string, unknown>, trigger: GenerationTrigger, request: GenerationRequest, output: (result: AgentOutcome) => unknown): Generator<any, unknown, any> {
    const session = sessionObject(rawContext);
    const pending = session && isRecord(session.pendingStage) ? session.pendingStage : null;
    if (!session ||
        !pending ||
        !isRecord(trigger.retry) ||
        pending.completionId !== trigger.retry.completionId)
        return output(outcome("execute-only", "no-op"));
    if (trigger.retry.cancelled === true) {
        if (pending.next === "native-story")
            yield { kind: "resource", capability: capability, operation: "stop_native_generation", input: {} };
        yield { kind: "resource", capability: capability, operation: "clear_session", input: { chatKey: chatKey(rawContext) } };
        return output(outcome("execute-only", "no-op", [], {
            status: "generation-cancelled",
        }));
    }
    const expected = isRecord(pending.identity) ? pending.identity : null;
    if (expected &&
        (!request.identity ||
            (typeof expected.mk === "string" &&
                expected.mk !== request.identity.mk) ||
            expected.messageId !== request.identity.messageId ||
            expected.swipeId !== request.identity.swipeId))
        return output(outcome("execute-only", "no-op"));
    const resumed: Record<string, unknown> = {
        ...session,
        pendingStage: null,
        preState: stateContext(rawContext),
    };
    const current = String(latestMessage(rawContext)?.message ?? "");
    const original = String(pending.originalMessage ?? "");
    const stageContent = isRecord(resumed.stageMemory)
        ? String(resumed.stageMemory.content ?? "")
        : "";
    if (pending.next !== "commit" && expected) {
        const added = additionalTransactions(current, original, stageContent);
        if (added.length)
            resumed.baseMessage = joinStageParts([resumed.baseMessage, ...added]);
    }
    yield* writeSessionProgress(capability, {
        chatKey: chatKey(rawContext),
        session: resumed,
    });
    if (pending.next === "native-story") {
        yield { kind: "resource", capability: capability, operation: "inject_once", input: {
                id: `era-agent-story-${trigger.eventId}`,
                content: buildStoryInjection({
                    plan: resumed.plan as unknown as EraAgentPlanningOutputV1,
                    results: Array.isArray(resumed.functionResults)
                        ? (resumed.functionResults as Record<string, never>[])
                        : [],
                }),
            } };
        // The planning floor is still an in-memory future message. Native
        // generation must create it before the ordinary save path can write it.
        return output(outcome("legacy-ignore", "committed"));
    }
    const identity = requestIdentity(request);
    if (pending.next === "manual-story")
        return output(outcome("execute-legacy", "committed", [], undefined, yield* retryStoryProgress(capability, configuration, rawContext, resumed, identity, trigger.eventId)));
    if (pending.next === "settlement" && configuration.settlement.enabled)
        return output(outcome("execute-legacy", "committed", [], undefined, yield* runSettlementProgress(capability, configuration, rawContext, resumed, identity, resumed.initialPresentation === true, trigger.eventId)));
    const story = typeof resumed.story === "string" ? resumed.story : "";
    const candidate = isRecord(pending.candidate)
        ? ({
            ...pending.candidate,
            ...(expected && typeof expected.mk !== "string"
                ? { mk: identity.mk }
                : {}),
        } as unknown as EraAgentFloorCandidateV1)
        : {
            messageId: identity.messageId,
            swipeId: identity.swipeId,
            mk: identity.mk,
            content: isRecord(resumed.stageMemory) &&
                typeof resumed.stageMemory.content === "string"
                ? resumed.stageMemory.content
                : joinStageParts([
                    resumed.baseMessage,
                    resumed.planningDraft,
                    resumed.planReport,
                    story,
                ]),
            extra: {
                era_agent: { schemaVersion: 1, status: "story-complete" },
            },
            terminalStatus: "story-complete" as const,
            requiresInitialPresentation: resumed.initialPresentation === true,
        };
    const appended = additionalTransactions(current, original, candidate.content).join("\n");
    const transaction = typeof resumed.transaction === "string" ? resumed.transaction : "";
    const content = appended
        ? transaction && candidate.content.endsWith(transaction)
            ? candidate.content.slice(0, -transaction.length) +
                appended +
                "\n" +
                transaction
            : candidate.content + "\n" + appended
        : candidate.content;
    yield* writeSessionProgress(capability, {
        chatKey: chatKey(rawContext),
        observationEventId: trigger.eventId,
        session: {
            ...resumed,
            pendingStage: null,
            status: candidate.terminalStatus,
        },
    });
    return output(outcome("execute-legacy", "committed", [], undefined, {
        ...candidate,
        content,
    }));
}
