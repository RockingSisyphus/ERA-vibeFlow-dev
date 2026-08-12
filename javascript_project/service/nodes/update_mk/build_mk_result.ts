import type {
  PlannedStepV1,
  TaskResultV1,
} from "../../base_lib/service_types.ts";

interface Envelope<T> {
  readonly value: T;
}

interface MkFailure {
  readonly code: string;
  readonly message: string;
  readonly category: "input" | "domain" | "tavern" | "cancelled";
  readonly retryable: false;
}

interface CommitOutcome {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly status: "committed" | "no-op" | "failed" | "fatal";
  readonly mk: string | null;
  readonly messageChanged: boolean;
  readonly variablesChanged: boolean;
  readonly failure: MkFailure | null;
}

function taskIdentity(step: PlannedStepV1): string {
  if (step.kind !== "execute" || step.task.kind !== "update-mk") {
    throw new TypeError("MK 结果收到非 update-mk execute 步骤。");
  }
  return step.task.id;
}

function sourceKey(eventId: string, sequence: number): string {
  return `${eventId}\u0000${sequence}`;
}

function assertUniqueSources(step: PlannedStepV1): void {
  if (step.kind !== "execute") {
    throw new TypeError("MK 结果只能结算 execute 步骤。");
  }
  const seen = new Set<string>();
  for (const source of step.sources) {
    const key = sourceKey(source.event.eventId, source.event.sequence);
    if (seen.has(key)) {
      throw new TypeError(`MK 步骤含重复来源：${source.event.sequence}。`);
    }
    seen.add(key);
  }
  if (seen.size === 0) throw new TypeError("MK 步骤没有可结算来源。");
}

export function run(
  inputs: Readonly<{ "era.mk.commit.result": Envelope<unknown> }>,
): any {
  const result = inputs["era.mk.commit.result"].value as CommitOutcome;
  const step = result.step;
  assertUniqueSources(step);
  const taskId = taskIdentity(step);
  const taskStatus = result.status;
  const settlements = step.kind === "execute"
    ? step.sources.map((source) => {
        if (taskStatus === "committed" || taskStatus === "no-op") {
          return {
            eventId: source.event.eventId,
            sequence: source.event.sequence,
            status: "completed" as const,
            taskId,
            relation: source.relation,
          };
        }
        const error = result.failure ?? {
          code: "ERA_UPDATE_MK_UNKNOWN_FAILURE",
          message: "MK 任务失败但未提供错误详情。",
          category: "domain" as const,
          retryable: false as const,
        };
        if (error.category === "cancelled" && taskStatus !== "fatal") {
          return {
            eventId: source.event.eventId,
            sequence: source.event.sequence,
            status: "cancelled" as const,
            reason: error.message,
          };
        }
        return {
          eventId: source.event.eventId,
          sequence: source.event.sequence,
          status: "failed" as const,
          error,
        };
      })
    : [];

  const diagnostics = [
    {
      code: "ERA_UPDATE_MK_CONSECUTIVE_STATE_UNCHANGED",
      message:
        "消息密钥任务只校准当前激活文本与 SelectedMks，不参与连续 MK 计数。",
      sequence:
        step.kind === "execute" ? step.task.primaryEvent.sequence : null,
    },
    ...(result.failure === null
      ? []
      : [
          {
            code: result.failure.code,
            message: result.failure.message,
            sequence:
              step.kind === "execute" ? step.task.primaryEvent.sequence : null,
          },
        ]),
  ];

  const taskResult: TaskResultV1 = {
    status: taskStatus,
    settlements,
    notifications: [],
    diagnostics,
  };
  return { update_mk_task_result: taskResult };
}
