import type {
  EraApiTaskV1,
  EraPlannedSourceV1,
  EraSyncTaskV1,
} from "@era/vibeflow-contracts";

interface Envelope<T> { readonly value: T; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function messageArray(value: unknown, depth = 0): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value) || depth > 4) return [];
  if (value.ok === false) return [];
  for (const key of ["messages", "value", "data", "chat"]) {
    const nested = value[key];
    if (Array.isArray(nested)) return nested;
    if (isRecord(nested)) {
      const found = messageArray(nested, depth + 1);
      if (found.length > 0) return found;
    }
  }
  return [];
}

function messageId(value: unknown, fallback: number): number {
  if (!isRecord(value)) return fallback;
  const raw = value.messageId;
  return Number.isSafeInteger(raw) && Number(raw) >= 0 ? Number(raw) : fallback;
}

export function run(inputs: Readonly<{
  "era.api.request": Envelope<unknown>;
  "era.tavern.messages.read_context.outcome": Envelope<unknown>;
}>): any {
  const request = inputs["era.api.request"].value;
  if (!isRecord(request) || !isRecord(request.task) || !Array.isArray(request.sources)) {
    throw new TypeError("forceSync 请求缺少 API task 或来源。");
  }
  const apiTask = request.task as unknown as EraApiTaskV1;
  const sources = request.sources as unknown as readonly EraPlannedSourceV1[];
  const detail = isRecord(request.detail) ? request.detail : {};
  const mode = typeof detail.mode === "string" ? detail.mode : "auto";
  const messages = messageArray(inputs["era.tavern.messages.read_context.outcome"].value);
  let failure: Readonly<Record<string, unknown>> | null = null;
  let target: EraSyncTaskV1["target"] = { kind: "auto" };
  let fullRebuild = false;

  if (mode === "full") {
    fullRebuild = true;
  } else if (mode === "latest") {
    const latest = messages.at(-1);
    if (latest === undefined) {
      failure = { code: "ERA_FORCE_SYNC_EMPTY_CHAT", message: "聊天记录为空，无法执行 latest 强制同步。" };
    } else {
      target = { kind: "message", messageId: messageId(latest, messages.length - 1), stopAfterTarget: false };
    }
  } else if (mode === "rollbackTo") {
    if (!Number.isSafeInteger(detail.message_id) || Number(detail.message_id) < 0) {
      failure = { code: "ERA_FORCE_SYNC_MESSAGE_ID_INVALID", message: "rollbackTo 模式需要非负整数 message_id。" };
    } else {
      target = { kind: "message", messageId: Number(detail.message_id), stopAfterTarget: true };
    }
  } else if (mode !== "auto") {
    failure = { code: "ERA_FORCE_SYNC_MODE_UNSUPPORTED", message: `不支持的 forceSync 模式：${mode}` };
  }

  const task: EraSyncTaskV1 = {
    id: `${apiTask.id}:force-sync`,
    sourceEvents: apiTask.sourceEvents,
    primaryEvent: apiTask.primaryEvent,
    context: "latest-message-with-mk",
    kind: "sync",
    reason: "manual",
    target,
    fullRebuild,
  };
  const step = {
    kind: "execute",
    stepId: `${apiTask.id}:force-sync`,
    index: 0,
    taskRoute: "sync",
    sourceSequences: sources.map((source) => source.event.sequence),
    events: sources.map((source) => source.event),
    task,
    sources,
    dispatchContext: request.dispatchContext,
  } as const;
  const route: "sync" | "failed" = failure === null ? "sync" : "failed";
  return {
    force_sync_route: route,
    force_sync_step: step,
    force_sync_failure: { request, failure } as Readonly<Record<string, unknown>>,
  };
}
