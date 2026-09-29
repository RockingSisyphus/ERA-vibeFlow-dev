/** Resume an approved stage at its original commit point. */
import { writeSession, isRecord, chatKey, stateContext, latestMessage, sessionObject, outcome, requestIdentity, type AgentCapability } from "./agent_generation_context.ts";
import { runSettlement, retryStory } from "./agent_generation_settlement.ts";
import { buildStoryInjection } from "./agent_report_text.ts";
import type { EraAgentConfigurationV2, EraAgentPlanningOutputV1 } from "./agent_configuration.ts";
import type { EraAgentFloorCandidateV1 } from "@era/vibeflow-contracts";
import type { GenerationTrigger, GenerationRequest, AgentOutcome } from "./agent_flow_types.ts";

export async function continueAgentStage(
  capability: AgentCapability,
  configuration: EraAgentConfigurationV2,
  rawContext: Record<string, unknown>,
  trigger: GenerationTrigger,
  request: GenerationRequest,
  output: (result: AgentOutcome) => unknown,
): Promise<unknown> {
      const session = sessionObject(rawContext);
      const pending =
        session && isRecord(session.pendingStage) ? session.pendingStage : null;
      if (
        !session ||
        !pending ||
        !isRecord(trigger.retry) ||
        pending.completionId !== trigger.retry.completionId
      )
        return output(outcome("execute-only", "no-op"));
      if (trigger.retry.cancelled === true) {
        if (pending.next === "native-story")
          capability.stop_native_generation({});
        capability.clear_session({ chatKey: chatKey(rawContext) });
        return output(
          outcome("execute-only", "no-op", [], {
            status: "generation-cancelled",
          }),
        );
      }
      const expected = isRecord(pending.identity) ? pending.identity : null;
      if (
        expected &&
        (!request.identity ||
          (typeof expected.mk === "string" &&
            expected.mk !== request.identity.mk) ||
          expected.messageId !== request.identity.messageId ||
          expected.swipeId !== request.identity.swipeId)
      )
        return output(outcome("execute-only", "no-op"));
      const resumed: Record<string, unknown> = {
        ...session,
        pendingStage: null,
        preState: stateContext(rawContext),
      };
      if (pending.next !== "commit" && expected) {
        const oldTx = [
          ...String(pending.originalMessage ?? "").matchAll(
            /<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu,
          ),
        ].map((match) => match[0]);
        const added = [
          ...String(latestMessage(rawContext)?.message ?? "").matchAll(
            /<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu,
          ),
        ]
          .map((match) => match[0])
          .filter((tx) => {
            const index = oldTx.indexOf(tx);
            if (index < 0) return true;
            oldTx.splice(index, 1);
            return false;
          });
        if (added.length)
          resumed.baseMessage = [resumed.baseMessage, ...added]
            .filter(Boolean)
            .join("\n");
      }
      writeSession(capability, {
        chatKey: chatKey(rawContext),
        session: resumed,
      });
      if (pending.next === "native-story") {
        capability.inject_once({
          id: `era-agent-story-${trigger.eventId}`,
          content: buildStoryInjection({
            plan: resumed.plan as unknown as EraAgentPlanningOutputV1,
            results: Array.isArray(resumed.functionResults)
              ? (resumed.functionResults as Record<string, never>[])
              : [],
          }),
        });
        // The planning floor is still an in-memory future message. Native
        // generation must create it before the ordinary save path can write it.
        return output(outcome("legacy-ignore", "committed"));
      }
      const identity = requestIdentity(request);
      if (pending.next === "manual-story")
        return output(
          outcome(
            "execute-legacy",
            "committed",
            [],
            undefined,
            await retryStory(
              capability,
              configuration,
              rawContext,
              resumed,
              identity,
              trigger.eventId,
            ),
          ),
        );
      if (pending.next === "settlement" && configuration.settlement.enabled)
        return output(
          outcome(
            "execute-legacy",
            "committed",
            [],
            undefined,
            await runSettlement(
              capability,
              configuration,
              rawContext,
              resumed,
              identity,
              resumed.initialPresentation === true,
              trigger.eventId,
            ),
          ),
        );
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
            content:
              isRecord(resumed.stageMemory) &&
              typeof resumed.stageMemory.content === "string"
                ? resumed.stageMemory.content
                : [
                    resumed.baseMessage,
                    resumed.planningDraft,
                    resumed.planReport,
                    story,
                  ]
                    .filter(Boolean)
                    .join("\n"),
            extra: {
              era_agent: { schemaVersion: 1, status: "story-complete" },
            },
            terminalStatus: "story-complete" as const,
            requiresInitialPresentation: resumed.initialPresentation === true,
          };
      const current = String(latestMessage(rawContext)?.message ?? "");
      const previousTransactions = [
        ...String(pending.originalMessage ?? "").matchAll(
          /<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu,
        ),
      ].map((match) => match[0]);
      const remaining = [...previousTransactions];
      const appended = [
        ...current.matchAll(/<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu),
      ]
        .map((match) => match[0])
        .filter((tx) => {
          const index = remaining.indexOf(tx);
          if (index < 0) return true;
          remaining.splice(index, 1);
          return false;
        })
        .join("\n");
      const transaction =
        typeof resumed.transaction === "string" ? resumed.transaction : "";
      const content = appended
        ? transaction && candidate.content.endsWith(transaction)
          ? candidate.content.slice(0, -transaction.length) +
            appended +
            "\n" +
            transaction
          : candidate.content + "\n" + appended
        : candidate.content;
      writeSession(capability, {
        chatKey: chatKey(rawContext),
        observationEventId: trigger.eventId,
        session: {
          ...resumed,
          pendingStage: null,
          status: candidate.terminalStatus,
        },
      });
      return output(
        outcome("execute-legacy", "committed", [], undefined, {
          ...candidate,
          content,
        }),
      );
}
