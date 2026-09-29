import type { PlannedStepV1 } from "../../base_lib/service_types.ts";
import { inspectSidecar, variablesForState } from "../../base_lib/sidecar_binding.ts";
import { isRecord, normalizeLatestMessage, normalizeMeta, normalizePlaceholderSettings, type NormalizedMessage } from "../../base_lib/domain/mk_read_normalization.ts";

interface Envelope<T> {
  readonly value: T;
}

type Context = any;

type FailureCategory = "input" | "tavern" | "cancelled";

interface MkFailure {
  readonly code: string;
  readonly message: string;
  readonly category: FailureCategory;
  readonly retryable: false;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isCancellation(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true;
  return /abort|cancel|取消/i.test(errorMessage(error));
}

function failure(
  code: string,
  message: string,
  category: FailureCategory,
): MkFailure {
  return { code, message, category, retryable: false };
}

function assertUpdateMkStep(value: unknown): PlannedStepV1 {
  if (!isRecord(value) || value.kind !== "execute") {
    throw new TypeError("MK 任务要求 execute PlannedStep。");
  }
  if (value.taskRoute !== "update-mk" || !isRecord(value.task)) {
    throw new TypeError("MK 任务收到非 update-mk 路由。");
  }
  if (value.task.kind !== "update-mk" || !Array.isArray(value.sources)) {
    throw new TypeError("MK 任务缺少完整 task/sources 契约。");
  }
  if (value.sources.length === 0) {
    throw new TypeError("MK 任务没有可结算来源。");
  }
  return value as unknown as PlannedStepV1;
}

export async function run(
  inputs: Readonly<{
    "era.step.request.routed": Envelope<unknown>;
  }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  let step: PlannedStepV1;
  try {
    step = assertUpdateMkStep(inputs["era.step.request.routed"].value);
  } catch (error) {
    return {
      mk_context: {
        schemaVersion: 1,
        step: inputs["era.step.request.routed"].value,
        status: "failed",
        message: null,
        meta: null,
        placeholderSettings: null,
        failure: failure(
          "ERA_UPDATE_MK_STEP_INVALID",
          errorMessage(error),
          "input",
        ),
      },
    };
  }

  let message: NormalizedMessage;
  try {
    const raw = await context.capabilities[
      "era.tavern.messages"
    ].read_context({
      projection: "era-active-message-v1",
      range: -1,
      purpose: "era-update-mk",
    });
    message = normalizeLatestMessage(raw);
  } catch (error) {
    const cancelled = isCancellation(error);
    return {
      mk_context: {
        schemaVersion: 1,
        step,
        status: "failed",
        message: null,
        meta: null,
        placeholderSettings: null,
        failure: failure(
          cancelled
            ? "ERA_UPDATE_MK_READ_CANCELLED"
            : "ERA_UPDATE_MK_MESSAGE_READ_FAILED",
          errorMessage(error),
          cancelled ? "cancelled" : "tavern",
        ),
      },
    };
  }

  try {
    const current = await context.capabilities["era.tavern.sidecar"].read_current({});
    const pointer = current !== null && typeof current === "object" ? (current as Record<string, unknown>).meta : null;
    const id = pointer !== null && typeof pointer === "object" ? (pointer as Record<string, unknown>).SidecarId : null;
    if (typeof id !== "string") throw new TypeError("ERA Sidecar 指针不可用。");
    const stored = await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: id });
    const facts = inspectSidecar(current, stored);
    if (facts.record === null || facts.status !== "matched") throw new TypeError("ERA Sidecar 状态不可用。");
    const raw = { variables: variablesForState(facts.record.state, facts.record.sidecarId) };
    const scriptRaw = await context.capabilities["era.tavern.variables"].read({
      scope: { type: "script" },
      fields: ["在ai消息尾部生成特殊符号", "特殊符号值"],
      purpose: "era-update-mk-placeholder-settings",
    });
    return {
      mk_context: {
        schemaVersion: 1,
        step,
        status: "ready",
        message,
        meta: normalizeMeta(raw),
        placeholderSettings: normalizePlaceholderSettings(scriptRaw),
        failure: null,
      },
    };
  } catch (error) {
    const cancelled = isCancellation(error);
    return {
      mk_context: {
        schemaVersion: 1,
        step,
        status: "failed",
        message,
        meta: null,
        placeholderSettings: null,
        failure: failure(
          cancelled
            ? "ERA_UPDATE_MK_READ_CANCELLED"
            : "ERA_UPDATE_MK_VARIABLES_READ_FAILED",
          errorMessage(error),
          cancelled ? "cancelled" : "tavern",
        ),
      },
    };
  }
}
