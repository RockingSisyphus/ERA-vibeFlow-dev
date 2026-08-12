interface Envelope<T> {
  readonly value: T;
}

interface Context {
  readonly capabilities: {
    readonly "era.tavern.variables": {
      readonly read: (
        input: Readonly<Record<string, unknown>>,
      ) => Promise<unknown>;
    };
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function eventTypeOf(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return "unknown";
  const task = (value as Readonly<Record<string, unknown>>).task;
  if (task === null || typeof task !== "object" || Array.isArray(task))
    return "unknown";
  return String(
    (task as Readonly<Record<string, unknown>>).eventType ?? "unknown",
  );
}

export async function run(
  inputs: Readonly<{ "era.api.query.request": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  try {
    const value = await context.capabilities["era.tavern.variables"].read({
      scope: { type: "chat" },
      fields: ["stat_data", "ERAMetaData"],
      purpose: "era-snapshot-query",
    });
    return { query_variables_raw: { ok: true, value } };
  } catch (error) {
    return {
      query_variables_raw: {
        ok: false,
        error: {
          code: "ERA_QUERY_VARIABLES_READ_FAILED",
          message: errorMessage(error),
        },
        requestEventType: eventTypeOf(inputs["era.api.query.request"].value),
      },
    };
  }
}
