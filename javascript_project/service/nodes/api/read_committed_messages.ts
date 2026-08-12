interface Envelope<T> {
  readonly value: T;
}

interface Context {
  readonly capabilities: {
    readonly "era.tavern.messages": {
      readonly read_context: (
        input: Readonly<{
          projection: "era-active-message-v1";
          range: string;
          purpose: string;
        }>,
      ) => Promise<unknown>;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function run(
  inputs: Readonly<{ "era.api.write.append.result": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const append = inputs["era.api.write.append.result"].value;
  if (!isRecord(append) || append.status !== "committed") {
    throw new TypeError("提交后消息读取只接受已确认的消息追加结果。");
  }
  try {
    const value = await context.capabilities[
      "era.tavern.messages"
    ].read_context({
      projection: "era-active-message-v1",
      range: "0-{{lastMessageId}}",
      purpose: "era-api-post-commit-read",
    });
    return { committed_messages_raw: { ok: true, value } };
  } catch (error) {
    return {
      committed_messages_raw: {
        ok: false,
        error: {
          code: "ERA_API_POST_COMMIT_READ_FAILED",
          message: errorMessage(error),
        },
      },
    };
  }
}
