interface Context {
  readonly capabilities: {
    readonly "era.tavern.messages": {
      readonly read_context: (input: Readonly<{ projection: "era-active-message-v1"; range: string | number; purpose?: string }>) => Promise<unknown>;
    };
  };
}
export async function run(
  _inputs: Readonly<Record<string, unknown>>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  try {
    const value = await context.capabilities["era.tavern.messages"].read_context({
      projection: "era-active-message-v1",
      range: "0-{{lastMessageId}}",
      purpose: "era-force-sync",
    });
    return { force_sync_messages: { ok: true, value } };
  } catch (error) {
    return {
      force_sync_messages: {
        ok: false,
        error: { code: "ERA_FORCE_SYNC_READ_FAILED", message: error instanceof Error ? error.message : String(error) },
      },
    };
  }
}
