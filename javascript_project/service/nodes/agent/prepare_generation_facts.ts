import { stableBase36Token } from "../../base_lib/sync/sync_work_preparation.ts";
import {
  preparePreview as initializePreview,
  previewResult,
} from "../../base_lib/sync/readonly_preview.ts";
import {
  normalizeAgentConfiguration,
  isAgentEnabled,
  agentRetryMatchesSession,
} from "../../base_lib/agent/agent_generation_session.ts";
import { parseMessageKeyData } from "../../base_lib/domain/mk_engine.ts";
import {
  formatMessageKeyBlock,
  generateMessageKey,
} from "../../base_lib/domain/mk_engine.ts";
import { stripEraDataBlocks } from "../../base_lib/domain/mk_engine.ts";
import { collectGenerationFacts } from "../../base_lib/agent/agent_flow_policy.ts";
import type { PlannedStepV1 } from "../../base_lib/service_types.ts";
export async function readFacts(
  inputs: Readonly<Record<string, unknown>>,
  _params: Readonly<Record<string, unknown>>,
  runtime: {
    capabilities: {
      "era.tavern.sidecar"?: {
        read_working(input: Record<string, unknown>): any;
      };
      "era.tavern.agent": {
        read_context(
          input: Readonly<Record<string, unknown>>,
        ): Promise<unknown>;
      };
    };
  },
): Promise<any> {
  let step = (inputs["era.step.request.routed"] as { value: PlannedStepV1 })
    .value;
  let previewInput: any = null;
  let baseline: any = null;
  const diagnostics: { code: string; message: string }[] = [];
  let hostContext: unknown = null;
  try {
    hostContext = await runtime.capabilities["era.tavern.agent"].read_context({
      eventType: step.kind === "execute" ? step.task.primaryEvent.type : "",
    });
  } catch (error) {
    diagnostics.push({
      code: "ERA_AGENT_CONTEXT_UNAVAILABLE",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const working = runtime.capabilities["era.tavern.sidecar"]?.read_working(
    {},
  ).working;
  const raw = hostContext as any;
  const session = raw?.session;
  const stage = working?.stage;
  const draft = working?.work?.plan?.messages.find(
    (message: any) => message.messageId === stage?.messageId,
  );
  if (session?.stageMemory && draft && stage?.mk === session.stageMemory.mk) {
    const body = stripEraDataBlocks(draft.content.text).trimEnd();
    const prefix = stripEraDataBlocks(
      stage.phase === "planning"
        ? String(session.baseMessage ?? "")
        : [session.baseMessage, session.planningDraft, session.planReport]
            .filter(Boolean)
            .join("\n"),
    );
    const updated = {
      ...session,
      stageMemory: { ...session.stageMemory, content: draft.content.text },
    };
    if (body.startsWith(prefix)) {
      if (stage.phase === "planning")
        updated.planningDraft = body.slice(prefix.length).trimStart();
      if (stage.phase === "story")
        updated.story = body.slice(prefix.length).trimStart();
    }
    if (updated.pendingStage?.candidate)
      updated.pendingStage = {
        ...updated.pendingStage,
        candidate: {
          ...updated.pendingStage.candidate,
          content: draft.content.text,
          mk: stage.mk,
        },
      };
    hostContext = { ...raw, session: updated };
  }
  // Replacing a stage first restores its retained prefix through the history
  // engine. Native regeneration may arrive before dispatch owns an AI floor.
  const event = step.kind === "execute" ? step.task.primaryEvent : null;
  const arg = event?.args[0];
  const value = arg?.kind === "json" ? (arg.value as any) : null;
  const current = hostContext as any;
  const dispatch =
    step.kind === "execute" ? (step.dispatchContext as any) : null;
  const native =
    event?.type === "generation_started" &&
    ["regenerate", "swipe", "continue"].includes(value) &&
    !(event.args[2]?.kind === "json" && event.args[2].value === true) &&
    isAgentEnabled(normalizeAgentConfiguration(current?.configuration));
  const retryStage =
    event?.type === "era.ui.agent_retry" &&
    ["planning", "story", "settlement"].includes(value?.kind)
      ? value.kind
      : null;
  let floor = dispatch?.floorIdentity ?? null;
  if (native && !floor) {
    const last = dispatch.messages.at(-1);
    const mk =
      last?.role === "assistant"
        ? parseMessageKeyData(last.activeText)?.mk
        : null;
    if (mk) {
      floor = {
        chatId: dispatch.sourceBasis.identity.chatId,
        messageId: last.messageId,
        swipeId: last.swipeIndex ?? 0,
        mk,
      };
      step = {
        ...step,
        dispatchContext: { ...dispatch, floorIdentity: floor },
      } as PlannedStepV1;
    }
  }
  if (native && value !== "continue" && floor) {
    floor = {
      ...floor,
      mk: generateMessageKey({
        timestamp: event!.occurredAt,
        token: stableBase36Token(
          `${event!.eventId}:replacement:${floor.messageId}`,
        ),
      }),
    };
    step = {
      ...step,
      dispatchContext: { ...dispatch, floorIdentity: floor },
    } as PlannedStepV1;
  }
  if (retryStage || (native && value !== "continue")) {
    const retained = current?.session;
    if (retryStage && retained && !agentRetryMatchesSession(value, retained)) {
      diagnostics.push({
        code: "ERA_AGENT_RETRY_SOURCE_CHANGED",
        message: "当前报告对应的 Agent 周期已失效，请查看最新楼层。",
      });
    } else if (current?.state && (native || (retained && floor))) {
      const content = floor
        ? [
            retryStage ? retained.baseMessage : "",
            retryStage && retryStage !== "planning"
              ? retained.planningDraft
              : "",
            retryStage && retryStage !== "planning" ? retained.planReport : "",
            retryStage === "settlement" ? retained.story : "",
            formatMessageKeyBlock(floor.mk, "assistant"),
          ]
            .filter(Boolean)
            .join("\n")
        : null;
      previewInput = {
        messages: dispatch.messages.map((message: any) => ({
          messageId: message.messageId,
          role: message.role,
          content: {
            kind: "text",
            text:
              message.messageId === floor?.messageId
                ? content
                : message.activeText,
          },
        })),
        stat: current.state.statData,
        statFunc: current.state.statFunc,
        meta: current.state.eraMeta ?? {},
        reason: "manual",
        ...(floor
          ? { targetMessageId: floor.messageId, stopAtTarget: true }
          : {}),
        processingMk: null,
        consecutiveState: null,
      };
      baseline = { content, floor, retained, retryStage };
    }
  }
  return {
    facts: { step, hostContext, diagnostics, previewInput, baseline },
    route: previewInput ? ("preview" as const) : ("direct" as const),
  };
}
export function preparePreview(inputs: any) {
  return {
    preview: {
      ...initializePreview(
        inputs["era.agent.baseline.state"].value.previewInput,
      ),
    },
  };
}
export function finishPreview(inputs: any) {
  const facts = inputs["era.agent.baseline.state"].value;
  const plan = previewResult(inputs["era.sync.preview.state.next"].value);
  const { step, diagnostics, baseline } = facts;
  let hostContext = facts.hostContext;
  const { content, floor, retained, retryStage } = baseline;
  if (!plan.committed) {
    diagnostics.push({
      code: "ERA_AGENT_STAGE_BASELINE_FAILED",
      message: "无法根据消息与日志恢复待生成阶段的起点。",
    });
  } else {
    hostContext = {
      ...hostContext,
      state: {
        ...hostContext.state,
        statData: plan.stat,
        statFunc: plan.statFunc,
        eraMeta: plan.meta,
      },
      session: retained
        ? {
            ...retained,
            status: "unsettled",
            transaction: "",
            pendingStage: null,
            stageMemory: floor ? { ...floor, content } : null,
          }
        : null,
      stageBaseline: {
        plan,
        content,
        floor,
        phase: retryStage === "settlement" ? "story" : "planning",
      },
    };
  }
  return {
    restored_facts: {
      ...collectGenerationFacts(step, hostContext, diagnostics),
    },
  };
}
export function finishDirect(inputs: any) {
  const { step, hostContext, diagnostics } =
    inputs["era.agent.baseline.state"].value;
  return {
    direct_facts: { ...collectGenerationFacts(step, hostContext, diagnostics) },
  };
}
