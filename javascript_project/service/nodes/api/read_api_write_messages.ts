interface Context {
  readonly capabilities: {
    readonly "era.tavern.messages": {
      readonly read_context: (
        input: Readonly<{ projection: "era-active-message-v1"; range: string | number; purpose?: string }>,
      ) => Promise<unknown>;
    };
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function run(
  _inputs: Readonly<Record<string, unknown>>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  try {
    const value = await context.capabilities[
      "era.tavern.messages"
    ].read_context({
      projection: "era-active-message-v1",
      range: "0-{{lastMessageId}}",
      purpose: "era-api-message-write",
    });
    return { api_write_messages_raw: { ok: true, value } };
  } catch (error) {
    return {
      api_write_messages_raw: {
        ok: false,
        error: {
          code: "ERA_API_WRITE_MESSAGES_READ_FAILED",
          message: errorMessage(error),
        },
      },
    };
  }
}
