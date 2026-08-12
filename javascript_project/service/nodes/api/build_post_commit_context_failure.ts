import type { EraFailureV1, EraTaskResultV1 } from "@era/vibeflow-contracts";

interface Envelope<T> {
  readonly value: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function run(
  inputs: Readonly<{ "era.api.write.post_commit.failure": Envelope<unknown> }>,
): any {
  const candidate = inputs["era.api.write.post_commit.failure"].value;
  if (
    !isRecord(candidate) ||
    !isRecord(candidate.appendResult) ||
    !isRecord(candidate.failure)
  ) {
    throw new TypeError("提交后上下文失败证据损坏。");
  }
  const appendRequest = candidate.appendResult.request;
  const carried =
    isRecord(appendRequest) && isRecord(appendRequest.request)
      ? appendRequest.request
      : null;
  const sources = carried?.sources;
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new TypeError("提交后上下文失败没有可结算来源。");
  }
  const failure = candidate.failure as unknown as EraFailureV1;
  const result: EraTaskResultV1 = {
    status: "failed",
    settlements: sources.map((source) => {
      if (!isRecord(source) || !isRecord(source.event)) {
        throw new TypeError("提交后上下文失败包含无效来源。");
      }
      return {
        eventId: String(source.event.eventId),
        sequence: Number(source.event.sequence),
        status: "failed" as const,
        error: failure,
      };
    }),
    notifications: [],
    diagnostics: [
      { code: failure.code, message: failure.message, sequence: null },
    ],
  };
  return { post_commit_context_task_result: result };
}
