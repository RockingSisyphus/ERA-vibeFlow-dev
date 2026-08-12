import {
  cloneResourcePlanValue,
  planEraCharacterRegexes,
  planEraSettings,
  planEraWorldbook,
  type EraCharacterContextV1,
  type EraSettingsV1,
  type EraWorldbookEntryV1,
} from "./domain/resource_planner.ts";
import type { PlannedStepV1, TaskResultV1 } from "./service_types.ts";

export interface InitializationContextV1 {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly identityRaw: unknown;
  readonly scriptVariablesRaw: unknown;
  readonly messagesRaw: unknown;
  readonly worldbookRaw: unknown;
  readonly regexRaw: unknown;
  readonly readFailure: Readonly<Record<string, unknown>> | null;
}

export type InitializationActionV1 =
  | { readonly kind: "replace-settings"; readonly settings: EraSettingsV1 }
  | { readonly kind: "create-worldbook"; readonly name: string }
  | { readonly kind: "bind-worldbook"; readonly name: string }
  | {
      readonly kind: "replace-worldbook-entries";
      readonly name: string;
      readonly entries: readonly unknown[];
    }
  | { readonly kind: "upsert-regex"; readonly regex: Readonly<Record<string, unknown>> };

export interface InitializationPlanV1 {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly operation: "startup" | "resources" | "settings-update";
  readonly disposition: "ready" | "failed";
  readonly actions: readonly InitializationActionV1[];
  readonly diagnostics: readonly Readonly<Record<string, unknown>>[];
  readonly failure: Readonly<Record<string, unknown>> | null;
}

export interface InitializationCommitOutcomeV1 {
  readonly schemaVersion: 1;
  readonly plan: InitializationPlanV1;
  readonly status: "committed" | "no-op" | "failed" | "fatal";
  readonly appliedActions: number;
  readonly failure: Readonly<Record<string, unknown>> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unwrap(value: unknown, depth = 0): unknown {
  if (!isRecord(value) || depth > 4) return value;
  if (value.ok === false) throw new Error(String(isRecord(value.error) ? value.error.message : value.error));
  if (value.ok === true && Object.prototype.hasOwnProperty.call(value, "value")) {
    return unwrap(value.value, depth + 1);
  }
  return value;
}

function nestedRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const root = unwrap(value);
  if (!isRecord(root)) return {};
  for (const key of keys) {
    const child = root[key];
    if (isRecord(child)) return nestedRecord(child, keys);
  }
  return root;
}

function initializeTask(step: PlannedStepV1) {
  if (step.kind !== "execute" || step.task.kind !== "initialize") {
    throw new TypeError("初始化事务只接受 initialize execute 步骤。");
  }
  return step.task;
}

function characterContext(
  identity: Readonly<Record<string, unknown>>,
  worldbook: Readonly<Record<string, unknown>>,
): EraCharacterContextV1 {
  if (identity.isGroup === true || typeof identity.groupId === "string") {
    return {
      kind: "group-chat",
      ...(typeof identity.groupName === "string" ? { groupName: identity.groupName } : {}),
    };
  }
  if (typeof identity.characterName !== "string" || identity.characterName.length === 0) {
    return { kind: "no-character" };
  }
  const bindings = isRecord(worldbook.bindings) ? worldbook.bindings : {};
  return {
    kind: "character",
    characterName: identity.characterName,
    primaryWorldbook:
      typeof bindings.primary === "string" && bindings.primary.length > 0
        ? bindings.primary
        : null,
    additionalWorldbooks: Array.isArray(bindings.additional)
      ? bindings.additional.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function apiDetail(step: PlannedStepV1): unknown {
  const task = initializeTask(step);
  const first = task.args[0];
  return first?.kind === "json" ? first.value : undefined;
}

function diagnostic(code: string, message: string) {
  return { code, message, sequence: null };
}

export function planInitialization(context: InitializationContextV1): InitializationPlanV1 {
  const task = initializeTask(context.step);
  if (context.readFailure !== null) {
    return {
      schemaVersion: 1,
      step: context.step,
      operation: task.operation,
      disposition: "failed",
      actions: [],
      diagnostics: [diagnostic(String(context.readFailure.code ?? "ERA_INITIALIZE_READ_FAILED"), String(context.readFailure.message ?? "初始化读取失败。"))],
      failure: context.readFailure,
    };
  }
  const scriptVariables = nestedRecord(context.scriptVariablesRaw, ["variables", "value", "data"]);
  const rawSettings = task.operation === "settings-update" ? apiDetail(context.step) : scriptVariables;
  const settingsPlan = planEraSettings(rawSettings);
  if (settingsPlan.status === "invalid") {
    const failure = { ...settingsPlan.error, category: "input", retryable: false };
    return {
      schemaVersion: 1,
      step: context.step,
      operation: task.operation,
      disposition: "failed",
      actions: [],
      diagnostics: [diagnostic(settingsPlan.error.code, settingsPlan.error.message)],
      failure,
    };
  }

  const actions: InitializationActionV1[] = [
    { kind: "replace-settings", settings: settingsPlan.settings },
  ];
  const diagnostics: Readonly<Record<string, unknown>>[] = [];
  if (task.operation === "resources") {
    const identity = nestedRecord(context.identityRaw, ["value", "data"]);
    const worldbook = nestedRecord(context.worldbookRaw, ["value", "data"]);
    const regex = nestedRecord(context.regexRaw, ["value", "data"]);
    const character = characterContext(identity, worldbook);
    const existingNames = Array.isArray(worldbook.names)
      ? worldbook.names.filter((item): item is string => typeof item === "string")
      : [];
    const existingEntries = Array.isArray(worldbook.entries) ? worldbook.entries : [];
    const worldbookPlan = planEraWorldbook({
      context: character,
      existingWorldbookNames: existingNames,
      primaryEntries: existingEntries,
    });
    if (worldbookPlan.status === "conflict") {
      diagnostics.push(diagnostic("ERA_WORLDBOOK_CONFLICT", worldbookPlan.reason));
    } else if (worldbookPlan.status === "skipped") {
      diagnostics.push(diagnostic("ERA_WORLDBOOK_SKIPPED", worldbookPlan.reason));
    } else {
      const appendedEntries: EraWorldbookEntryV1[] = [];
      for (const action of worldbookPlan.actions) {
        if (action.kind === "create-worldbook") {
          actions.push({ kind: "create-worldbook", name: action.worldbookName });
        } else if (action.kind === "bind-primary-worldbook") {
          actions.push({ kind: "bind-worldbook", name: action.worldbookName });
        } else {
          appendedEntries.push(action.entry);
        }
      }
      if (appendedEntries.length > 0) {
        actions.push({
          kind: "replace-worldbook-entries",
          name: worldbookPlan.worldbookName,
          entries: [...cloneResourcePlanValue(existingEntries), ...appendedEntries],
        });
      }
    }

    const regexPlan = planEraCharacterRegexes({
      context: character,
      localRegexEnabled: regex.enabled === true,
      existingRegexes: Array.isArray(regex.regexes) ? regex.regexes : [],
    });
    if (regexPlan.status === "skipped") {
      diagnostics.push(diagnostic("ERA_REGEX_SKIPPED", regexPlan.reason));
    } else {
      for (const action of regexPlan.actions) {
        actions.push({
          kind: "upsert-regex",
          regex: action.regex as unknown as Readonly<Record<string, unknown>>,
        });
      }
    }

  }
  return {
    schemaVersion: 1,
    step: context.step,
    operation: task.operation,
    disposition: "ready",
    actions: cloneResourcePlanValue(actions),
    diagnostics,
    failure: null,
  };
}

function settlements(step: PlannedStepV1, status: "completed" | "failed", failure: Readonly<Record<string, unknown>> | null) {
  if (step.kind !== "execute") return [];
  return step.sources.map((source) =>
    status === "completed"
      ? { eventId: source.event.eventId, sequence: source.event.sequence, status: "completed" as const, taskId: step.task.id, relation: source.relation }
      : { eventId: source.event.eventId, sequence: source.event.sequence, status: "failed" as const, error: { code: String(failure?.code ?? "ERA_INITIALIZE_FAILED"), message: String(failure?.message ?? "初始化失败。"), category: String(failure?.category ?? "tavern") as "input" | "domain" | "tavern" | "cancelled", retryable: false } },
  );
}

export function buildInitializationDirectResult(outcome: InitializationCommitOutcomeV1): TaskResultV1 {
  const success = outcome.status === "committed" || outcome.status === "no-op";
  return {
    status: outcome.status,
    settlements: settlements(outcome.plan.step, success ? "completed" : "failed", outcome.failure),
    notifications: [],
    diagnostics: [
      ...outcome.plan.diagnostics,
      ...(outcome.failure === null ? [] : [diagnostic(String(outcome.failure.code ?? "ERA_INITIALIZE_FAILED"), String(outcome.failure.message ?? "初始化失败。"))]),
    ],
  } as TaskResultV1;
}
