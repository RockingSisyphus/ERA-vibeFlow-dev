import type { PlannedStepV1 } from "../../base_lib/service_types.ts";
import { inspectSidecar, recordFor, stateFromRecord } from "../../base_lib/sidecar_binding.ts";

interface Envelope<T> {
  readonly value: T;
}

type Context = any;

interface CommitRequest {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly mk: string;
  readonly messageUpdate: null | {
    readonly messageId: number;
    readonly content: string;
  };
  readonly metaUpdate: Readonly<Record<string, unknown>>;
  readonly messageWriteRequired: boolean;
  readonly variableWriteRequired: boolean;
}

type FailureCategory = "input" | "domain" | "tavern" | "cancelled";

interface MkFailure {
  readonly code: string;
  readonly message: string;
  readonly category: FailureCategory;
  readonly retryable: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function outcome(
  request: CommitRequest,
  status: "committed" | "failed" | "fatal",
  messageChanged: boolean,
  variablesChanged: boolean,
  error: MkFailure | null,
) {
  return {
    mk_commit_outcome: {
      schemaVersion: 1,
      step: request.step,
      status,
      mk: request.mk,
      messageChanged,
      variablesChanged,
      failure: error,
    },
  };
}

function unwrapSuccessful(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.ok === false) {
    const detail = isRecord(value.error) ? value.error.message : value.error;
    throw new Error(String(detail ?? "宿主提交返回失败。"));
  }
  return value.ok === true && Object.prototype.hasOwnProperty.call(value, "value")
    ? value.value
    : value;
}

function isConfirmed(value: unknown): boolean {
  const unwrapped = unwrapSuccessful(value);
  if (!isRecord(unwrapped)) return false;
  return (
    unwrapped.status === "committed" ||
    unwrapped.status === "completed" ||
    unwrapped.committed === true
  );
}

function variablesRecord(value: unknown, depth = 0): Record<string, unknown> {
  const unwrapped = unwrapSuccessful(value);
  if (!isRecord(unwrapped) || depth > 4) {
    throw new TypeError("变量回读结果不是对象。");
  }
  if (
    Object.prototype.hasOwnProperty.call(unwrapped, "ERAMetaData") ||
    Object.prototype.hasOwnProperty.call(unwrapped, "meta")
  ) {
    return unwrapped;
  }
  for (const key of ["variables", "value", "data", "chat"]) {
    if (isRecord(unwrapped[key])) {
      return variablesRecord(unwrapped[key], depth + 1);
    }
  }
  return unwrapped;
}

function observedMeta(value: unknown): Readonly<Record<string, unknown>> {
  const variables = variablesRecord(value);
  if (isRecord(variables.ERAMetaData)) return variables.ERAMetaData;
  if (isRecord(variables.meta)) return variables.meta;
  return {};
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] && deepEqual(left[key], right[key]),
      )
    );
  }
  return false;
}

export async function run(
  inputs: Readonly<{ "era.mk.commit.request": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const request = inputs["era.mk.commit.request"].value as CommitRequest;
  let messageChanged = false;
  if (request.messageWriteRequired) {
    if (request.messageUpdate === null) {
      return outcome(
        request,
        "failed",
        false,
        false,
        failure(
          "ERA_UPDATE_MK_MESSAGE_REQUEST_INVALID",
          "消息写入标记存在，但提交请求没有文本更新。",
          "input",
        ),
      );
    }
    let result: unknown;
    try {
      result = await context.capabilities[
        "era.tavern.messages"
      ].update_content({
        messageId: request.messageUpdate.messageId,
        content: request.messageUpdate.content,
        purpose: "era-update-mk",
        refresh: "affected",
      });
    } catch (error) {
      const cancelled = isCancellation(error);
      return outcome(
        request,
        "failed",
        false,
        false,
        failure(
          cancelled
            ? "ERA_UPDATE_MK_MESSAGE_CANCELLED"
            : "ERA_UPDATE_MK_MESSAGE_COMMIT_FAILED",
          errorMessage(error),
          cancelled ? "cancelled" : "tavern",
        ),
      );
    }
    try {
      if (!isConfirmed(result)) {
        return outcome(
          request,
          "fatal",
          false,
          false,
          failure(
            "ERA_UPDATE_MK_MESSAGE_COMMIT_UNKNOWN",
            "消息写入返回了未知确认状态。",
            "tavern",
          ),
        );
      }
    } catch (error) {
      return outcome(
        request,
        "failed",
        false,
        false,
        failure(
          "ERA_UPDATE_MK_MESSAGE_COMMIT_FAILED",
          errorMessage(error),
          "tavern",
        ),
      );
    }
    messageChanged = true;
  }

  if (!request.variableWriteRequired) {
    return outcome(request, "committed", messageChanged, false, null);
  }

  let variableCommit: unknown;
  let nextRecord: unknown = null;
  try {
    const current = await context.capabilities["era.tavern.sidecar"].read_current({});
    const pointer = current !== null && typeof current === "object" ? (current as Record<string, unknown>).meta : null;
    const id = pointer !== null && typeof pointer === "object" ? (pointer as Record<string, unknown>).SidecarId : null;
    if (typeof id !== "string") throw new TypeError("ERA Sidecar 指针不可用。");
    const stored = await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: id });
    const facts = inspectSidecar(current, stored);
    if (facts.current === null || facts.record === null || facts.status !== "matched") throw new TypeError("ERA Sidecar 状态不可用。");
    const eraMeta = { ...request.metaUpdate } as Record<string, unknown>;
    delete eraMeta.SidecarId;
    nextRecord = recordFor(id, facts.current, { ...stateFromRecord(facts.record), eraMeta }, facts.record);
    variableCommit = await context.capabilities["era.tavern.sidecar"].write_record({ sidecarId: id, record: nextRecord });
    if (isConfirmed(variableCommit)) await context.capabilities["era.tavern.sidecar"].commit_metadata({ sidecarId: id, snapshot: nextRecord as Record<string, unknown> });
  } catch (error) {
    const cancelled = isCancellation(error);
    return outcome(
      request,
      messageChanged ? "fatal" : "failed",
      messageChanged,
      false,
      failure(
        cancelled
          ? "ERA_UPDATE_MK_VARIABLES_CANCELLED"
          : "ERA_UPDATE_MK_VARIABLES_COMMIT_FAILED",
        errorMessage(error),
        cancelled ? "cancelled" : "tavern",
      ),
    );
  }
  try {
    if (!isConfirmed(variableCommit)) {
      return outcome(
        request,
        "fatal",
        messageChanged,
        false,
        failure(
          "ERA_UPDATE_MK_VARIABLES_COMMIT_UNKNOWN",
          "变量写入返回了未知确认状态。",
          "tavern",
        ),
      );
    }
  } catch (error) {
    return outcome(
      request,
      messageChanged ? "fatal" : "failed",
      messageChanged,
      false,
      failure(
        "ERA_UPDATE_MK_VARIABLES_COMMIT_FAILED",
        errorMessage(error),
        "tavern",
      ),
    );
  }

  let observed: unknown;
  try {
    const record = nextRecord as { readonly sidecarId: string };
    observed = await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: record.sidecarId });
  } catch (error) {
    const cancelled = isCancellation(error);
    return outcome(
      request,
      "fatal",
      messageChanged,
      true,
      failure(
        cancelled
          ? "ERA_UPDATE_MK_CONFIRM_CANCELLED"
          : "ERA_UPDATE_MK_CONFIRM_READ_FAILED",
        errorMessage(error),
        cancelled ? "cancelled" : "tavern",
      ),
    );
  }
  try {
    const current = await context.capabilities["era.tavern.sidecar"].read_current({});
    const facts = inspectSidecar(current, observed);
    if (facts.record === null || !deepEqual({ ...facts.record.state.eraMeta, SidecarId: facts.record.sidecarId }, request.metaUpdate)) {
      return outcome(
        request,
        "fatal",
        messageChanged,
        true,
        failure(
          "ERA_UPDATE_MK_CONFIRM_MISMATCH",
          "变量回读的 ERAMetaData 与提交候选不一致。",
          "tavern",
        ),
      );
    }
  } catch (error) {
    return outcome(
      request,
      "fatal",
      messageChanged,
      true,
      failure(
        "ERA_UPDATE_MK_CONFIRM_INVALID",
        errorMessage(error),
        "tavern",
      ),
    );
  }
  return outcome(request, "committed", messageChanged, true, null);
}
