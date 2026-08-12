import {
  canonicalDispatchContext,
  type DispatchCanonicalContextV1,
  type DispatchSeedV1,
} from "../../base_lib/dispatch_preparation.ts";

interface Envelope<T> { readonly value: T; }
interface MessageReadRequest {
  readonly projection: "era-active-message-v1";
  readonly range: string | number;
  readonly purpose?: string;
}
interface Context {
  readonly capabilities: {
    readonly "era.tavern.messages": { readonly read_context: (input: MessageReadRequest) => Promise<unknown> };
    readonly "era.tavern.variables": { readonly read: (input: Readonly<Record<string, unknown>>) => Promise<unknown> };
  };
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function failed(seed: DispatchSeedV1, error: unknown): DispatchCanonicalContextV1 {
  return {
    schemaVersion: 1,
    seed,
    status: "failed",
    messages: [],
    meta: {},
    placeholder: { enabled: true, value: "<StatusPlaceHolderImpl/>" },
    failure: {
      code: /abort|cancel|取消/i.test(errorMessage(error)) ? "ERA_DISPATCH_READ_CANCELLED" : "ERA_DISPATCH_READ_FAILED",
      message: errorMessage(error),
      category: /abort|cancel|取消/i.test(errorMessage(error)) ? "cancelled" : "tavern",
      retryable: false,
    },
  };
}

export async function run(
  inputs: Readonly<{ "era.dispatch.seed": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const seed = inputs["era.dispatch.seed"].value as DispatchSeedV1;
  try {
    const messagesPromise = context.capabilities["era.tavern.messages"].read_context({
      projection: "era-active-message-v1",
      range: "0-{{lastMessageId}}",
      purpose: "era-dispatch-prepare",
    });
    if (seed.requirement === "latest-message") {
      const messages = await messagesPromise;
      return {
        canonical_dispatch_context: canonicalDispatchContext(
          seed,
          messages,
          { variables: {} },
          { variables: {} },
        ),
      };
    }
    const [messages, chatVariables, scriptVariables] = await Promise.all([
      messagesPromise,
      context.capabilities["era.tavern.variables"].read({ scope: { type: "chat" }, purpose: "era-dispatch-prepare" }),
      context.capabilities["era.tavern.variables"].read({ scope: { type: "script" }, purpose: "era-dispatch-placeholder" }),
    ]);
    return { canonical_dispatch_context: canonicalDispatchContext(seed, messages, chatVariables, scriptVariables) };
  } catch (error) {
    return { canonical_dispatch_context: failed(seed, error) };
  }
}
