import type { TaskResultV1 } from "./service_types.ts";
import type { AgentTransition } from "./agent_flow_types.ts";
export function buildAgentTaskResult(
  transition: AgentTransition,
): TaskResultV1 {
  const step = transition.step;
  if (step.kind !== "execute")
    throw new TypeError("Agent 结果只接受 execute 步骤。");
  const settlements = step.sources.map((source) => {
    if (transition.mode === "legacy-ignore") {
      return {
        eventId: source.event.eventId,
        sequence: source.event.sequence,
        status: "ignored" as const,
        reason: `${source.event.type} 是生成栅栏检测事件，本身无需执行状态任务`,
      };
    }
    if (transition.status === "failed") {
      const diagnostic = transition.diagnostics[0] ?? {
        code: "ERA_AGENT_FAILED",
        message: "Agent 会话失败。",
      };
      return {
        eventId: source.event.eventId,
        sequence: source.event.sequence,
        status: "failed" as const,
        error: {
          code: diagnostic.code,
          message: diagnostic.message,
          category: "domain" as const,
          retryable: true,
        },
      };
    }
    return {
      eventId: source.event.eventId,
      sequence: source.event.sequence,
      status: "completed" as const,
      taskId: step.task.id,
      relation: source.relation,
      ...(transition.value === undefined
        ? {}
        : { value: transition.value as never }),
    };
  });
  const result: TaskResultV1 = {
    status: transition.status,
    settlements,
    notifications: [],
    diagnostics: transition.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      sequence: step.task.primaryEvent.sequence,
    })),
  };
  return result;
}
