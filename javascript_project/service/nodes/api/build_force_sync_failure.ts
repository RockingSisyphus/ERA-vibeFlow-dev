interface Envelope<T> { readonly value: T; }
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function run(inputs: Readonly<{ "era.api.force_sync.failure": Envelope<unknown> }>): any {
  const value = inputs["era.api.force_sync.failure"].value;
  const request = isRecord(value) && isRecord(value.request) ? value.request : {};
  const failure = isRecord(value) && isRecord(value.failure) ? value.failure : {};
  const sources = Array.isArray(request.sources) ? request.sources : [];
  const code = String(failure.code ?? "ERA_FORCE_SYNC_INVALID");
  const message = String(failure.message ?? "forceSync 请求无效。");
  return {
    force_sync_failure_result: {
      status: "failed",
      settlements: sources.flatMap((item) => {
        if (!isRecord(item) || !isRecord(item.event)) return [];
        return [{
          eventId: String(item.event.eventId),
          sequence: Number(item.event.sequence),
          status: "failed",
          error: { code, message, category: "input", retryable: false },
        }];
      }),
      notifications: [],
      diagnostics: [{ code, message, sequence: null }],
    },
  };
}
