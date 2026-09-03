import {
  type InitializationContextV1,
} from "../../base_lib/initialization_transaction.ts";
import type { PlannedStepV1 } from "../../base_lib/service_types.ts";

interface Envelope<T> { readonly value: T; }
interface Context {
  readonly capabilities: {
    readonly "era.tavern.identity": { readonly read: (input: Readonly<Record<string, unknown>>) => unknown };
    readonly "era.tavern.variables": { readonly read: (input: Readonly<Record<string, unknown>>) => Promise<unknown> };
    readonly "era.tavern.worldbook": { readonly read: (input: Readonly<Record<string, unknown>>) => Promise<unknown> };
    readonly "era.tavern.regex": { readonly read: (input: Readonly<Record<string, unknown>>) => Promise<unknown> };
    readonly "era.tavern.character": { readonly read_main_greeting: (input: Readonly<Record<string, unknown>>) => Promise<unknown> };
  };
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
export async function run(
  inputs: Readonly<{ "era.step.request.routed": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const step = inputs["era.step.request.routed"].value as PlannedStepV1;
  const dispatchContext = step.dispatchContext as Readonly<Record<string, unknown>> | undefined;
  let identityRaw: unknown = null;
  let scriptVariablesRaw: unknown = null;
  let messagesRaw: unknown = null;
  let worldbookRaw: unknown = null;
  let regexRaw: unknown = null;
  let characterRaw: unknown = null;
  let readFailure: Readonly<Record<string, unknown>> | null = null;
  try {
    [identityRaw, scriptVariablesRaw, worldbookRaw, regexRaw, characterRaw] = await Promise.all([
      Promise.resolve(context.capabilities["era.tavern.identity"].read({ purpose: "era-initialize" })),
      context.capabilities["era.tavern.variables"].read({ scope: { type: "script" }, purpose: "era-initialize" }),
      context.capabilities["era.tavern.worldbook"].read({ purpose: "era-initialize" }),
      context.capabilities["era.tavern.regex"].read({ purpose: "era-initialize" }),
      context.capabilities["era.tavern.character"].read_main_greeting({ purpose: "era-initialize" }),
    ]);
    if (dispatchContext?.status !== "ready") throw new TypeError("初始化任务缺少可用的统一派发上下文。");
    messagesRaw = { schemaVersion: 2, messages: dispatchContext.messages };
  } catch (error) {
    readFailure = { code: "ERA_INITIALIZE_READ_FAILED", message: message(error), category: "tavern", retryable: false };
  }
  const result: InitializationContextV1 = { schemaVersion: 1, step, identityRaw, scriptVariablesRaw, messagesRaw, worldbookRaw, regexRaw, characterRaw, readFailure };
  return { initialization_context: result as unknown as Readonly<Record<string, unknown>> };
}
