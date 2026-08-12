import {
  executeSnapshotQuery,
  type EraQueryResultPayload,
  type EraSnapshotMessageContext,
  type EraSnapshotQueryFailure,
  type EraSnapshotQueryType,
  type EraSnapshotVariables,
} from "../../base_lib/domain/snapshot_query.ts";
import { cloneEraPortableJsonV1 } from "@era/vibeflow-contracts";

interface Envelope<T> {
  readonly value: T;
}

interface Source {
  readonly eventId: string;
  readonly sequence: number;
  readonly relation: "primary" | "combined" | "coalesced";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readWrapper(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.ok === false) {
    const error = isRecord(value.error) ? value.error : {};
    throw new Error(String(error.message ?? "宿主只读操作失败"));
  }
  return value.ok === true &&
    Object.prototype.hasOwnProperty.call(value, "value")
    ? value.value
    : value;
}

function nestedRecord(value: unknown, depth = 0): Record<string, unknown> {
  if (!isRecord(value) || depth > 4)
    throw new TypeError("变量读取结果不是对象");
  if (
    Object.prototype.hasOwnProperty.call(value, "stat") ||
    Object.prototype.hasOwnProperty.call(value, "meta")
  )
    return value;
  if (
    Object.prototype.hasOwnProperty.call(value, "stat_data") ||
    Object.prototype.hasOwnProperty.call(value, "ERAMetaData")
  )
    return value;
  for (const key of ["value", "variables", "data", "chat"]) {
    if (isRecord(value[key])) return nestedRecord(value[key], depth + 1);
  }
  return value;
}

function normalizeVariables(raw: unknown): EraSnapshotVariables {
  const value = nestedRecord(readWrapper(raw));
  const directMeta = isRecord(value.meta) ? value.meta : undefined;
  const chatMeta = isRecord(value.ERAMetaData) ? value.ERAMetaData : undefined;
  return {
    stat: Object.prototype.hasOwnProperty.call(value, "stat")
      ? value.stat
      : (value.stat_data ?? {}),
    meta: directMeta ?? chatMeta ?? {},
  };
}

function messageArray(value: unknown, depth = 0): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value) || depth > 4)
    throw new TypeError("消息读取结果没有 messages 数组");
  for (const key of ["messages", "chat", "value", "context", "data"]) {
    const nested = value[key];
    if (Array.isArray(nested)) return nested;
    if (isRecord(nested)) {
      try {
        return messageArray(nested, depth + 1);
      } catch {
        /* 继续尝试 */
      }
    }
  }
  if (Object.keys(value).length === 0) return [];
  throw new TypeError("消息读取结果没有 messages 数组");
}

function normalizeMessages(raw: unknown): EraSnapshotMessageContext {
  return { messages: messageArray(readWrapper(raw)) };
}

function sourcesOf(request: Record<string, unknown>): Source[] {
  if (!Array.isArray(request.sources)) return [];
  return request.sources.flatMap((item) => {
    if (!isRecord(item)) return [];
    const event = isRecord(item.event) ? item.event : {};
    if (
      typeof event.eventId !== "string" ||
      !Number.isSafeInteger(event.sequence)
    )
      return [];
    if (
      item.relation !== "primary" &&
      item.relation !== "combined" &&
      item.relation !== "coalesced"
    ) {
      return [];
    }
    return [
      {
        eventId: event.eventId,
        sequence: event.sequence as number,
        relation: item.relation,
      },
    ];
  });
}

function queryTypeOf(value: unknown): EraSnapshotQueryType {
  if (
    value === "getCurrentVars" ||
    value === "getSnapshotAtMk" ||
    value === "getSnapshotsBetweenMks" ||
    value === "getSnapshotAtMId" ||
    value === "getSnapshotsBetweenMIds"
  )
    return value;
  throw new TypeError(`无效查询类型：${String(value)}`);
}

function failurePrefix(queryType: EraSnapshotQueryType): string {
  if (queryType === "getCurrentVars") return "获取当前变量时发生错误";
  return queryType.includes("Between")
    ? "获取批量快照时发生错误"
    : "获取快照时发生错误";
}

function compatibilityPayload(
  request: Record<string, unknown>,
  queryType: EraSnapshotQueryType,
  outcome: EraQueryResultPayload | EraSnapshotQueryFailure,
): Record<string, unknown> {
  const hasRequest = Object.prototype.hasOwnProperty.call(request, "detail");
  if ("error" in outcome) {
    return {
      queryType,
      ...(hasRequest ? { request: request.detail } : {}),
      result: {
        error: `${failurePrefix(queryType)}: ${outcome.error.message}`,
      },
      selectedMks: [],
      editLogs: {},
    };
  }
  return {
    queryType: outcome.queryType,
    ...(hasRequest ? { request: outcome.request } : {}),
    result: outcome.result,
    selectedMks: outcome.selectedMks,
    editLogs: outcome.editLogs,
  };
}

export function run(
  inputs: Readonly<{
    "era.api.query.request": Envelope<unknown>;
    "era.tavern.variables.read.result": Envelope<unknown>;
    "era.tavern.messages.read_context.outcome": Envelope<unknown>;
  }>,
): any {
  const rawRequest = inputs["era.api.query.request"].value;
  if (!isRecord(rawRequest)) throw new TypeError("已选择查询必须是对象");
  const queryType = queryTypeOf(rawRequest.queryType);
  const hasRequest = Object.prototype.hasOwnProperty.call(rawRequest, "detail");
  let outcome: EraQueryResultPayload | EraSnapshotQueryFailure;
  let diagnostic: Readonly<Record<string, unknown>> | null = null;
  try {
    outcome = executeSnapshotQuery({
      queryType,
      request: hasRequest ? rawRequest.detail : undefined,
      variables: normalizeVariables(
        inputs["era.tavern.variables.read.result"].value,
      ),
      messageContext: normalizeMessages(
        inputs["era.tavern.messages.read_context.outcome"].value,
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outcome = {
      error: {
        code: "ERA_QUERY_CONTEXT_INVALID",
        message,
        category: "input",
        retryable: false,
      },
    };
    diagnostic = {
      code: "ERA_QUERY_CONTEXT_INVALID",
      message,
      sequence: null,
    };
  }

  const payload = cloneEraPortableJsonV1(
    compatibilityPayload(rawRequest, queryType, outcome),
  );
  const sources = sourcesOf(rawRequest);
  if (sources.length === 0) throw new TypeError("查询请求没有可结算来源");
  return {
    snapshot_query_task_result: {
      status: "committed",
      settlements: sources.map((source) => ({
        eventId: source.eventId,
        sequence: source.sequence,
        status: "completed",
        taskId: `api-query:${queryType}`,
        relation: source.relation,
        value: payload,
      })),
      notifications: [
        {
          type: "era:queryResult",
          args: [{ kind: "json", value: payload }],
        },
      ],
      diagnostics: diagnostic ? [diagnostic] : [],
    },
  };
}
