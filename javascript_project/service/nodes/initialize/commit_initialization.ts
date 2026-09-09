import type {
  InitializationActionV1,
  InitializationCommitOutcomeV1,
  InitializationPlanV1,
} from "../../base_lib/initialization_transaction.ts";
interface Envelope<T> { readonly value: T; }
interface Context {
  readonly capabilities: {
    readonly "era.tavern.variables": { readonly commit: (input: Readonly<Record<string, unknown>>) => Promise<unknown> };
    readonly "era.tavern.worldbook": {
      readonly create: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
      readonly bind: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
      readonly replace_entries: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
    };
    readonly "era.tavern.regex": { readonly upsert: (input: Readonly<Record<string, unknown>>) => Promise<unknown> };
    readonly "era.tavern.character": {
      readonly write_main_greeting: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
      readonly patch_external_statusbar: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
      readonly patch_single_floor: (input: Readonly<{ characterId: string; enabled: boolean }>) => Promise<unknown>;
    };
  };
}
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function confirmed(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.ok === true && Object.prototype.hasOwnProperty.call(value, "value")) return confirmed(value.value);
  return ["committed", "completed", "created", "exists", "bound", "updated"].includes(String(value.status)) || value.committed === true;
}
function unwrap(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!isRecord(current) || current.ok !== true || !Object.prototype.hasOwnProperty.call(current, "value")) break;
    current = current.value;
  }
  return current;
}
function greetingRefreshStatus(value: unknown): InitializationCommitOutcomeV1["greetingRefreshStatus"] {
  const response = unwrap(value);
  if (!isRecord(response) || !isRecord(response.chatRefresh)) return "not-applicable";
  const status = response.chatRefresh.status;
  return status === "refreshed" || status === "preserved" || status === "not-applicable"
    ? status
    : "not-applicable";
}
async function apply(action: InitializationActionV1, context: Context): Promise<unknown> {
  switch (action.kind) {
    case "patch-external-statusbar":
      return context.capabilities["era.tavern.character"].patch_external_statusbar({ characterId: action.characterId, patch: action.patch });
    case "patch-single-floor":
      return context.capabilities["era.tavern.character"].patch_single_floor({ characterId: action.characterId, enabled: action.enabled });
    case "replace-settings":
      return context.capabilities["era.tavern.variables"].commit({ scope: { type: "script" }, variables: action.settings, purpose: "era-initialize-settings" });
    case "create-worldbook":
      return context.capabilities["era.tavern.worldbook"].create({ name: action.name, purpose: "era-initialize" });
    case "bind-worldbook":
      return context.capabilities["era.tavern.worldbook"].bind({ name: action.name, purpose: "era-initialize" });
    case "replace-worldbook-entries":
      return context.capabilities["era.tavern.worldbook"].replace_entries({ name: action.name, entries: action.entries, purpose: "era-initialize" });
    case "upsert-regex":
      return context.capabilities["era.tavern.regex"].upsert({ regex: action.regex, purpose: "era-initialize" });
    case "update-main-greeting":
      return context.capabilities["era.tavern.character"].write_main_greeting({ expected: action.expected, next: action.next, purpose: "era-initialize" });
  }
}
function outcome(
  plan: InitializationPlanV1,
  status: InitializationCommitOutcomeV1["status"],
  appliedActions: number,
  failure: Readonly<Record<string, unknown>> | null,
  refreshStatus: InitializationCommitOutcomeV1["greetingRefreshStatus"] = "not-applicable",
) {
  const value: InitializationCommitOutcomeV1 = {
    schemaVersion: 1,
    plan,
    status,
    appliedActions,
    greetingRefreshStatus: refreshStatus,
    failure,
  };
  return { resource_commit_result: value as unknown as Readonly<Record<string, unknown>> };
}
export async function run(
  inputs: Readonly<{ "era.initialize.commit.request": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const plan = inputs["era.initialize.commit.request"].value as InitializationPlanV1;
  if (plan.disposition === "failed") return outcome(plan, "failed", 0, plan.failure);
  if (plan.actions.length === 0) return outcome(plan, "no-op", 0, null);
  let appliedActions = 0;
  let refreshStatus: InitializationCommitOutcomeV1["greetingRefreshStatus"] = "not-applicable";
  for (const action of plan.actions) {
    let response: unknown;
    try { response = await apply(action, context); }
    catch (error) {
      return outcome(plan, appliedActions === 0 ? "failed" : "fatal", appliedActions, { code: "ERA_INITIALIZE_COMMIT_FAILED", message: errorMessage(error), category: /abort|cancel|取消/i.test(errorMessage(error)) ? "cancelled" : "tavern", retryable: false }, refreshStatus);
    }
    if (!confirmed(response)) {
      return outcome(plan, "fatal", appliedActions, { code: "ERA_INITIALIZE_COMMIT_UNKNOWN", message: `初始化动作 ${action.kind} 返回未知确认状态。`, category: "tavern", retryable: false }, refreshStatus);
    }
    if (action.kind === "update-main-greeting") refreshStatus = greetingRefreshStatus(response);
    appliedActions += 1;
  }
  return outcome(plan, "committed", appliedActions, null, refreshStatus);
}
