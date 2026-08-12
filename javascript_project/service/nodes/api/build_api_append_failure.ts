interface Envelope<T> {
  readonly value: T;
}

interface Source {
  readonly eventId: string;
  readonly sequence: number;
  readonly relation: "primary" | "combined" | "coalesced";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sourcesOf(value: unknown): Source[] {
  if (!isRecord(value) || !isRecord(value.request)) return [];
  const appendRequest = value.request;
  const apiRequest = isRecord(appendRequest.request)
    ? appendRequest.request
    : appendRequest;
  if (!Array.isArray(apiRequest.sources)) return [];
  return apiRequest.sources.flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.event)) return [];
    if (
      typeof item.event.eventId !== "string" ||
      !Number.isSafeInteger(item.event.sequence) ||
      (item.relation !== "primary" && item.relation !== "combined" && item.relation !== "coalesced")
    ) return [];
    return [{
      eventId: item.event.eventId,
      sequence: item.event.sequence as number,
      relation: item.relation,
    }];
  });
}

export function run(
  inputs: Readonly<{ "era.api.write.append.result": Envelope<unknown> }>,
): any {
  const result = inputs["era.api.write.append.result"].value;
  if (!isRecord(result)) throw new TypeError("消息追加失败上下文损坏。");
  const fatal = result.status !== "failed";
  const error = isRecord(result.error) ? result.error : {};
  const code = String(error.code ?? (fatal ? "ERA_API_MESSAGE_APPEND_UNKNOWN" : "ERA_API_MESSAGE_APPEND_REJECTED"));
  const message = String(error.message ?? "消息追加失败。");
  const sources = sourcesOf(result);
  if (sources.length === 0) throw new TypeError("消息追加失败没有可结算来源。");
  return {
    append_failure_result: {
      status: fatal ? "fatal" : "failed",
      settlements: sources.map((source) => ({
        eventId: source.eventId,
        sequence: source.sequence,
        status: "failed",
        error: {
          code,
          message,
          category: "tavern",
          retryable: false,
          details: { phase: "message-append", commitState: fatal ? "unknown" : "not-applied" },
        },
      })),
      notifications: [],
      diagnostics: [{ code, message, sequence: null }],
    },
  };
}
