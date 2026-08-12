import {
  type DispatchPreparationOutcomeV1,
  type DispatchPreparationPlanV1,
} from "../../base_lib/dispatch_preparation.ts";

interface Envelope<T> { readonly value: T; }
interface Context {
  readonly capabilities: {
    readonly "era.tavern.messages": { readonly update_content: (input: Readonly<Record<string, unknown>>) => Promise<unknown> };
    readonly "era.tavern.variables": { readonly commit: (input: Readonly<Record<string, unknown>>) => Promise<unknown> };
  };
}
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function confirmed(value: unknown): boolean {
  return isRecord(value) && (value.status === "committed" || value.status === "completed" || value.committed === true);
}
function failed(plan: DispatchPreparationPlanV1, error: unknown): DispatchPreparationOutcomeV1 {
  const cancelled = /abort|cancel|取消/i.test(errorMessage(error));
  return {
    ...plan,
    status: "failed",
    messageChanged: false,
    variablesChanged: false,
    failure: {
      code: cancelled ? "ERA_DISPATCH_PRECOMMIT_CANCELLED" : "ERA_DISPATCH_PRECOMMIT_FAILED",
      message: errorMessage(error),
      category: cancelled ? "cancelled" : "tavern",
      retryable: false,
    },
  };
}

export async function run(
  inputs: Readonly<{ "era.dispatch.preparation.plan": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const plan = inputs["era.dispatch.preparation.plan"].value as DispatchPreparationPlanV1;
  let messageChanged = false;
  if (plan.messageWriteRequired) {
    if (plan.messageUpdate === null) throw new TypeError("派发预提交缺少消息更新请求。");
    let response: unknown;
    try {
      response = await context.capabilities["era.tavern.messages"].update_content({
        messageId: plan.messageUpdate.messageId,
        content: plan.messageUpdate.content,
        refresh: "affected",
        purpose: "era-dispatch-prepare",
      });
    } catch (error) {
      return { committed_preparation_outcome: failed(plan, error) };
    }
    if (!confirmed(response)) throw new Error("ERA_DISPATCH_MESSAGE_COMMIT_UNKNOWN：消息预提交状态未知。");
    messageChanged = true;
  }
  if (!plan.variableWriteRequired) {
    return { committed_preparation_outcome: { ...plan, messageChanged, variablesChanged: false } };
  }
  let response: unknown;
  try {
    response = await context.capabilities["era.tavern.variables"].commit({
      scope: { type: "chat" },
      meta: plan.metaUpdate,
      purpose: "era-dispatch-prepare",
    });
  } catch (error) {
    if (messageChanged) throw new Error(`ERA_DISPATCH_PARTIAL_COMMIT：${errorMessage(error)}`);
    return { committed_preparation_outcome: failed(plan, error) };
  }
  if (!confirmed(response)) throw new Error("ERA_DISPATCH_VARIABLES_COMMIT_UNKNOWN：变量预提交状态未知。");
  return {
    committed_preparation_outcome: { ...plan, messageChanged, variablesChanged: true },
  };
}
