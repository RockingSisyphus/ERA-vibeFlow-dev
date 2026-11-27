/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { planGreetingRefresh, type GreetingRefreshFacts } from "../../base_lib/greeting_refresh_policy.ts";
import type { InitializationActionV1, InitializationCommitOutcomeV1, InitializationPlanV1, } from "../../base_lib/initialization_transaction.ts";
interface Envelope<T> {
    readonly value: T;
}
interface Context {
    readonly capabilities: {
        readonly "era.tavern.variables": {
            readonly commit: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
        };
        readonly "era.tavern.worldbook": {
            readonly create: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
            readonly bind: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
            readonly replace_entries: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
        };
        readonly "era.tavern.regex": {
            readonly upsert: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
        };
        readonly "era.tavern.character": {
            readonly read_greeting_refresh_context: (input: Readonly<Record<string, unknown>>) => unknown;
            readonly apply_greeting_refresh: (input: Readonly<{
                kind: "empty" | "message";
                next: string;
                updated?: string;
            }>) => Promise<unknown>;
            readonly write_main_greeting: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
            readonly patch_external_statusbar: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
            readonly patch_single_floor: (input: Readonly<{
                characterId: string;
                enabled: boolean;
            }>) => Promise<unknown>;
        };
    };
}
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function confirmed(value: unknown): boolean {
    const visited = new Set<object>();
    let current = value;
    while (isRecord(current)) {
        if (visited.has(current))
            return false;
        visited.add(current);
        if (current.ok === true && Object.prototype.hasOwnProperty.call(current, "value")) {
            current = current.value;
            continue;
        }
        return ["committed", "completed", "created", "exists", "bound", "updated"].includes(String(current.status)) || current.committed === true;
    }
    return false;
}
function unwrap(value: unknown): unknown {
    let current = value;
    for (let depth = 0; depth < 5; depth += 1) {
        if (!isRecord(current) || current.ok !== true || !Object.prototype.hasOwnProperty.call(current, "value"))
            break;
        current = current.value;
    }
    return current;
}
function greetingRefreshStatus(value: unknown): InitializationCommitOutcomeV1["greetingRefreshStatus"] {
    const response = unwrap(value);
    if (!isRecord(response) || !isRecord(response.chatRefresh))
        return "not-applicable";
    const status = response.chatRefresh.status;
    return status === "refreshed" || status === "preserved" || status === "not-applicable"
        ? status
        : "not-applicable";
}
function* applyProgress(action: InitializationActionV1, context: Context): Generator<any, unknown, any> {
    switch (action.kind) {
        case "patch-external-statusbar":
            return yield { kind: "resource", capability: "era.tavern.character", operation: "patch_external_statusbar", input: { characterId: action.characterId, patch: action.patch } };
        case "patch-single-floor":
            return yield { kind: "resource", capability: "era.tavern.character", operation: "patch_single_floor", input: { characterId: action.characterId, enabled: action.enabled } };
        case "replace-settings":
            return yield { kind: "resource", capability: "era.tavern.variables", operation: "commit", input: { scope: { type: "script" }, variables: action.settings, purpose: "era-initialize-settings" } };
        case "create-worldbook":
            return yield { kind: "resource", capability: "era.tavern.worldbook", operation: "create", input: { name: action.name, purpose: "era-initialize" } };
        case "bind-worldbook":
            return yield { kind: "resource", capability: "era.tavern.worldbook", operation: "bind", input: { name: action.name, purpose: "era-initialize" } };
        case "replace-worldbook-entries":
            return yield { kind: "resource", capability: "era.tavern.worldbook", operation: "replace_entries", input: { name: action.name, entries: action.entries, purpose: "era-initialize" } };
        case "upsert-regex":
            return yield { kind: "resource", capability: "era.tavern.regex", operation: "upsert", input: { regex: action.regex, purpose: "era-initialize" } };
        case "update-main-greeting": {
            const character = "era.tavern.character";
            const response = yield { kind: "resource", capability: character, operation: "write_main_greeting", input: { expected: action.expected, next: action.next, purpose: "era-initialize" } };
            if (!confirmed(response))
                return response;
            const facts = (yield { kind: "resource", capability: character, operation: "read_greeting_refresh_context", input: {} }) as GreetingRefreshFacts;
            const target = planGreetingRefresh(action.expected, action.next, facts);
            const chatRefresh = target.kind === "result" ? target.result : yield { kind: "resource", capability: character, operation: "apply_greeting_refresh", input: { ...target, next: action.next } };
            return { ...(unwrap(response) as Record<string, unknown>), chatRefresh };
        }
    }
}
function outcome(plan: InitializationPlanV1, status: InitializationCommitOutcomeV1["status"], appliedActions: number, failure: Readonly<Record<string, unknown>> | null, refreshStatus: InitializationCommitOutcomeV1["greetingRefreshStatus"] = "not-applicable") {
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
export function* runProgress(inputs: Readonly<{
    "era.initialize.commit.request": Envelope<unknown>;
}>, _params: Readonly<Record<string, unknown>>, context: Context): Generator<any, any, any> {
    const plan = inputs["era.initialize.commit.request"].value as InitializationPlanV1;
    if (plan.disposition === "failed")
        return outcome(plan, "failed", 0, plan.failure);
    if (plan.actions.length === 0)
        return outcome(plan, "no-op", 0, null);
    let appliedActions = 0;
    let refreshStatus: InitializationCommitOutcomeV1["greetingRefreshStatus"] = "not-applicable";
    for (const action of plan.actions) {
        let response: unknown;
        try {
            response = yield* applyProgress(action, context);
        }
        catch (error) {
            return outcome(plan, appliedActions === 0 ? "failed" : "fatal", appliedActions, { code: "ERA_INITIALIZE_COMMIT_FAILED", message: errorMessage(error), category: /abort|cancel|取消/i.test(errorMessage(error)) ? "cancelled" : "tavern", retryable: false }, refreshStatus);
        }
        if (!confirmed(response)) {
            return outcome(plan, "fatal", appliedActions, { code: "ERA_INITIALIZE_COMMIT_UNKNOWN", message: `初始化动作 ${action.kind} 返回未知确认状态。`, category: "tavern", retryable: false }, refreshStatus);
        }
        if (action.kind === "update-main-greeting")
            refreshStatus = greetingRefreshStatus(response);
        appliedActions += 1;
    }
    return outcome(plan, "committed", appliedActions, null, refreshStatus);
}
