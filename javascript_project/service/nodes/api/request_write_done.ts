interface Envelope<T> {
  readonly value: T;
}

interface Source {
  readonly eventId: string;
  readonly sequence: number;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function sources(value: unknown): Source[] {
  const raw = record(value).sources;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const source = record(item);
    const event = record(source.event);
    return typeof event.eventId === "string" &&
      Number.isSafeInteger(event.sequence)
      ? [{ eventId: event.eventId, sequence: event.sequence as number }]
      : [];
  });
}

export function run(
  inputs: Readonly<{
    "era.api.request": Envelope<unknown>;
  }>,
): any {
  return {
    request_write_done_result: {
      status: "no-op",
      settlements: sources(inputs["era.api.request"].value).map((source) => ({
        ...source,
        status: "completed",
        taskId: "era:requestWriteDone",
        relation: "primary",
      })),
      notifications: [
        { type: "era:internal:replayWriteDone", args: [] },
      ],
      diagnostics: [],
    },
  };
}
