import type {
  EraApiTaskV1,
  EraPlannedSourceV1,
  EraSyncTaskV1,
} from "@era/vibeflow-contracts";

interface Envelope<T> {
  readonly value: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function run(
  inputs: Readonly<{ "era.api.write.post_commit.context": Envelope<unknown> }>,
): any {
  const postCommit = inputs["era.api.write.post_commit.context"].value;
  if (
    !isRecord(postCommit) ||
    !isRecord(postCommit.appendResult) ||
    !isRecord(postCommit.dispatchContext)
  ) {
    throw new TypeError("只有已校验的提交后上下文可以构造共享同步步骤。");
  }
  const append = postCommit.appendResult;
  if (append.status !== "committed" || !isRecord(append.request))
    throw new TypeError("提交后上下文缺少已确认追加。");
  const carried = append.request;
  if (
    !isRecord(carried.request) ||
    !isRecord(carried.request.task) ||
    !isRecord(carried.plan)
  ) {
    throw new TypeError("消息追加结果缺少 API task 或目标消息。");
  }
  const apiTask = carried.request.task as unknown as EraApiTaskV1;
  const sources = carried.request
    .sources as unknown as readonly EraPlannedSourceV1[];
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new TypeError("写入 API 没有可结算来源。");
  }
  const messageId = carried.plan.messageId;
  if (!Number.isSafeInteger(messageId) || Number(messageId) < 0) {
    throw new TypeError("消息追加结果缺少有效目标消息 ID。");
  }
  const task: EraSyncTaskV1 = {
    id: `${apiTask.id}:state-commit`,
    sourceEvents: apiTask.sourceEvents,
    primaryEvent: apiTask.primaryEvent,
    context: "latest-message-with-mk",
    kind: "sync",
    reason: "api-write",
    target: {
      kind: "message",
      messageId: Number(messageId),
      stopAfterTarget: false,
    },
    fullRebuild: false,
  };
  const step = {
    kind: "execute",
    stepId: `${apiTask.id}:state-commit`,
    index: 0,
    taskRoute: "sync",
    sourceSequences: sources.map((source) => source.event.sequence),
    events: sources.map((source) => source.event),
    task,
    sources,
    dispatchContext: postCommit.dispatchContext,
  } as const;
  return { routed_step: step };
}
