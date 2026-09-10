/** 成功阶段的业务续体；页面等待不占用 Service FIFO。 */
export const AGENT_STAGE_CONTINUE = "era.agent.stage_continue";
export const AGENT_STAGE_NOTIFY = "era.agent.stage_completed";
export type AgentStage = "planning" | "story" | "settlement";
export interface StageHandoff {
  readonly executionId: string;
  readonly completionId: string;
  readonly trigger: string;
  readonly chatKey: string;
  readonly stage: AgentStage;
  readonly result: Readonly<Record<string, unknown>>;
  readonly messageId?: number;
  readonly mk?: string;
  readonly swipeId?: number;
}
export class AgentStageBoundary extends Error {
  constructor(
    readonly session: Record<string, unknown>,
    readonly stage: AgentStage,
    readonly result: Readonly<Record<string, unknown>>,
    readonly next: "native-story" | "manual-story" | "settlement" | "commit",
    readonly candidate?: unknown,
  ) {
    super("ERA_AGENT_STAGE_BOUNDARY");
  }
}
export function stageHandoff(input: {
  readonly stage: AgentStage;
  readonly session: Readonly<Record<string, unknown>>;
  readonly result: Readonly<Record<string, unknown>>;
  readonly chatKey: string;
  readonly eventId: string;
  readonly identity: Readonly<{
    messageId: number;
    mk?: string;
    swipeId: number;
  }> | null;
}): StageHandoff {
  const execution = input.session.execution as
    { id?: string; trigger?: string } | undefined;
  const executionId = execution?.id ?? input.eventId;
  return {
    executionId,
    completionId: `${input.eventId}:${input.stage}`,
    trigger: execution?.trigger ?? "initial",
    chatKey: input.chatKey,
    stage: input.stage,
    result: input.result,
    ...(input.identity
      ? {
          messageId: input.identity.messageId,
          ...(input.identity.mk ? { mk: input.identity.mk } : {}),
          swipeId: input.identity.swipeId,
        }
      : {}),
  };
}
