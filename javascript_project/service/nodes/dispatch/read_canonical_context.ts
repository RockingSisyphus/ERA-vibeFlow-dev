import {
  canonicalDispatchContext,
  type DispatchCanonicalContextV1,
  type DispatchSeedV1,
} from "../../base_lib/dispatch_preparation.ts";
import { inspectSidecar, variablesForState } from "../../base_lib/sidecar_binding.ts";

interface Envelope<T> { readonly value: T; }
interface MessageReadRequest {
  readonly projection: "era-active-message-v1";
  readonly range: string | number;
  readonly purpose?: string;
}
type Context = any;
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
    const [messages, current, scriptVariables] = await Promise.all([
      messagesPromise,
      context.capabilities["era.tavern.sidecar"].read_current({}),
      context.capabilities["era.tavern.variables"].read({ scope: { type: "script" }, purpose: "era-dispatch-placeholder" }),
    ]);
    const meta = current !== null && typeof current === "object" ? (current as Record<string, unknown>).meta : null;
    const id = meta !== null && typeof meta === "object" ? (meta as Record<string, unknown>).SidecarId : null;
    const stored = typeof id === "string" ? await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: id }) : null;
    const facts = inspectSidecar(current, stored);
    const chatVariables = facts.record === null
      ? { variables: {} }
      : { variables: variablesForState(facts.record.state, facts.record.sidecarId) };
    return { canonical_dispatch_context: canonicalDispatchContext(seed, messages, chatVariables, scriptVariables) };
  } catch (error) {
    return { canonical_dispatch_context: failed(seed, error) };
  }
}
