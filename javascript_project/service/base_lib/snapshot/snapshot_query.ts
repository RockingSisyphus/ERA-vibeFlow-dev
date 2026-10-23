import {unescapeEraData, removeMetaFields} from "../../../../base_lib/data_view/data_view.ts";
export {unescapeEraData, removeMetaFields} from "../../../../base_lib/data_view/data_view.ts";
/** Five public snapshot queries; shared history replay lives in snapshot_history.ts. */
import {
  isRecord,
  isPlainRecord,
  cloneSnapshotValue,
  calculateStatAt,
  calculateAllStatsBetweenMks,
  type EraSnapshotQueryType,
  type EraSnapshotVariables,
  type EraSnapshotQueryInput,
  type EraSnapshotItem,
  type EraSnapshotErrorResult,
  type EraQueryResultPayload,
  type EraSnapshotQueryFailure,
  type EraStatSnapshot,
} from "./snapshot_history.ts";
export {
  cloneSnapshotValue,
  parseEditLog,
  rollbackStatToMK,
  calculateStatForward,
  calculateStatAt,
  calculateAllStatsBetweenMks,
  findLatestNewValue,
  type EraSnapshotQueryType,
  type EraSnapshotVariables,
  type EraSnapshotMessageContext,
  type EraSnapshotQueryInput,
  type EraSnapshotItem,
  type EraSnapshotErrorResult,
  type EraQueryResultPayload,
  type EraSnapshotQueryFailure,
  type EraStatSnapshot,
  type EraEditLogEntry,
} from "./snapshot_history.ts";

function selectedMksOf(
  variables: EraSnapshotVariables,
): readonly (string | null)[] {
  const selected = variables.meta.SelectedMks;
  return Array.isArray(selected)
    ? (cloneSnapshotValue(selected) as (string | null)[])
    : [];
}

function editLogsOf(
  variables: EraSnapshotVariables,
): Readonly<Record<string, unknown>> {
  const logs = variables.meta.EditLogs;
  return isPlainRecord(logs) ? cloneSnapshotValue(logs) : {};
}

function statAtMkOrNull(
  targetMk: string,
  selectedMks: readonly (string | null)[],
  editLogs: Readonly<Record<string, unknown>>,
): unknown | null {
  try {
    if (!targetMk || !selectedMks.includes(targetMk)) return null;
    return calculateStatAt(targetMk, selectedMks, editLogs);
  } catch {
    return null;
  }
}

function statsBetweenMksOrNull(
  startMk: unknown,
  endMk: unknown,
  selectedMks: readonly (string | null)[],
  editLogs: Readonly<Record<string, unknown>>,
): EraStatSnapshot[] | null {
  try {
    const validMks = selectedMks.filter((mk): mk is string => !!mk);
    if (validMks.length === 0) return [];
    if (startMk && !validMks.includes(String(startMk))) return null;
    if (endMk && !validMks.includes(String(endMk))) return null;
    const actualStart = startMk ? String(startMk) : validMks[0];
    const actualEnd = endMk ? String(endMk) : validMks[validMks.length - 1];
    return calculateAllStatsBetweenMks(
      actualStart,
      actualEnd,
      selectedMks,
      editLogs,
    );
  } catch {
    return null;
  }
}

function messageContent(message: unknown): string | null {
  if (!isRecord(message)) return null;
  if (typeof message.activeText === "string") return message.activeText;
  if (typeof message.mes === "string") return message.mes;
  if (Array.isArray(message.swipes)) {
    const swipeIndex = Number(message.swipe_id ?? 0);
    const content = message.swipes[swipeIndex];
    return typeof content === "string" && content ? content : null;
  }
  return typeof message.message === "string" ? message.message : null;
}

/** 保持候选基线的 ERA 元数据优先、role 回退判定。 */
export function isUserMessage(message: unknown): boolean {
  const content = messageContent(message);
  if (content !== null) {
    const block = content.match(/<era_data>({.*?})<\/era_data>/)?.[1];
    if (block) {
      const key = block.match(/"era-message-key"\s*=\s*"(.*?)"/)?.[1];
      const type = block.match(/"era-message-type"\s*=\s*"(.*?)"/)?.[1];
      if (key && type) return type === "user";
    }
  }
  return isRecord(message) && message.role === "user";
}

function messageIsUser(
  messages: readonly unknown[],
  messageId: number,
): boolean {
  const message = messages[messageId];
  return message ? isUserMessage(message) : false;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function snapshotItem(
  mk: string,
  messageId: number,
  stat: unknown,
  messages: readonly unknown[],
): EraSnapshotItem {
  return {
    mk,
    message_id: messageId,
    is_user: messageIsUser(messages, messageId),
    stat: unescapeEraData(stat),
    statWithoutMeta: unescapeEraData(removeMetaFields(stat)),
  };
}

/** 当前 Sidecar 快照的纯结果计算，供 Facade 读取与历史查询复用。 */
export function queryCurrentVars(
  variables: EraSnapshotVariables,
  messages: readonly unknown[],
): EraSnapshotItem | EraSnapshotErrorResult {
  try {
    const selectedMks = selectedMksOf(variables);
    const messageId = selectedMks.length - 1;
    const selected = selectedMks[messageId];
    const mk = selected || "";
    return snapshotItem(mk, messageId, variables.stat, messages);
  } catch (error) {
    return { error: `获取当前变量时发生错误: ${errorMessage(error)}` };
  }
}

/** `era:getSnapshotAtMk` 的纯结果计算。 */
export function querySnapshotAtMk(
  request: unknown,
  variables: EraSnapshotVariables,
  messages: readonly unknown[],
): EraSnapshotItem | EraSnapshotErrorResult {
  try {
    const mk = isRecord(request) ? request.mk : undefined;
    if (!mk) throw new Error('请求缺少 "mk" 参数。');
    const selectedMks = selectedMksOf(variables);
    const editLogs = editLogsOf(variables);
    const stat = statAtMkOrNull(String(mk), selectedMks, editLogs);
    if (stat !== null) {
      const messageId = selectedMks.indexOf(String(mk));
      return snapshotItem(String(mk), messageId, stat, messages);
    }
    return { error: `找不到 MK "${String(mk)}" 对应的快照。`, stat: null };
  } catch (error) {
    return { error: `获取快照时发生错误: ${errorMessage(error)}` };
  }
}

/** `era:getSnapshotsBetweenMks` 的纯结果计算。 */
export function querySnapshotsBetweenMks(
  request: unknown,
  variables: EraSnapshotVariables,
  messages: readonly unknown[],
): EraSnapshotItem[] | EraSnapshotErrorResult {
  try {
    const startMk = isRecord(request) ? request.startMk : undefined;
    const endMk = isRecord(request) ? request.endMk : undefined;
    const results = statsBetweenMksOrNull(
      startMk,
      endMk,
      selectedMksOf(variables),
      editLogsOf(variables),
    );
    if (!results) return [];
    return results.map((item) =>
      snapshotItem(item.mk, item.message_id, item.stat, messages),
    );
  } catch (error) {
    return { error: `获取批量快照时发生错误: ${errorMessage(error)}` };
  }
}

/** `era:getSnapshotAtMId` 的纯结果计算。 */
export function querySnapshotAtMId(
  request: unknown,
  variables: EraSnapshotVariables,
  messages: readonly unknown[],
): EraSnapshotItem | EraSnapshotErrorResult {
  try {
    const messageId = isRecord(request) ? request.message_id : undefined;
    if (typeof messageId !== "number") {
      throw new Error('请求缺少 "message_id" 参数或类型不正确。');
    }
    const selectedMks = selectedMksOf(variables);
    if (messageId < 0 || messageId >= selectedMks.length) {
      throw new Error(
        `Message ID ${messageId} 超出范围 [0, ${selectedMks.length - 1}]。`,
      );
    }
    const mk = selectedMks[messageId];
    if (!mk) {
      return {
        error: `Message ID ${messageId} 处没有找到有效的 MK。`,
        stat: null,
      };
    }
    const stat = statAtMkOrNull(mk, selectedMks, editLogsOf(variables));
    if (stat !== null) return snapshotItem(mk, messageId, stat, messages);
    return {
      error: `获取快照失败，MK: ${mk} (来自 Message ID: ${messageId})。可能该快照已被清理。`,
      stat: null,
    };
  } catch (error) {
    return { error: `获取快照时发生错误: ${errorMessage(error)}` };
  }
}

function looseArrayRead(
  values: readonly (string | null)[],
  index: unknown,
): string | null | undefined {
  return (values as unknown as Record<string, string | null>)[String(index)];
}

/** `era:getSnapshotsBetweenMIds` 的纯结果计算。 */
export function querySnapshotsBetweenMIds(
  request: unknown,
  variables: EraSnapshotVariables,
  messages: readonly unknown[],
): EraSnapshotItem[] | EraSnapshotErrorResult {
  try {
    const selectedMks = selectedMksOf(variables);
    const rawStart = isRecord(request) ? request.startId : undefined;
    const rawEnd = isRecord(request) ? request.endId : undefined;
    const startIndex = rawStart ?? 0;
    const endIndex = rawEnd ?? selectedMks.length - 1;
    if (
      Number(startIndex) > Number(endIndex) ||
      Number(startIndex) < 0 ||
      Number(endIndex) >= selectedMks.length
    ) {
      throw new Error(
        `ID 范围 [${String(startIndex)}, ${String(endIndex)}] 无效或超出范围 [0, ${selectedMks.length - 1}]。`,
      );
    }
    const startMk = looseArrayRead(selectedMks, startIndex);
    const endMk = looseArrayRead(selectedMks, endIndex);
    if (!startMk || !endMk) {
      throw new Error("指定的 ID 范围内没有找到有效的起始或结束 MK。");
    }
    const results = statsBetweenMksOrNull(
      startMk,
      endMk,
      selectedMks,
      editLogsOf(variables),
    );
    if (!results) return [];
    return results.map((item) =>
      snapshotItem(item.mk, item.message_id, item.stat, messages),
    );
  } catch (error) {
    return { error: `获取批量快照时发生错误: ${errorMessage(error)}` };
  }
}

function isQueryType(value: unknown): value is EraSnapshotQueryType {
  return (
    value === "getCurrentVars" ||
    value === "getSnapshotAtMk" ||
    value === "getSnapshotsBetweenMks" ||
    value === "getSnapshotAtMId" ||
    value === "getSnapshotsBetweenMIds"
  );
}

/**
 * 形成 Facade history 查询使用的完整可序列化结果。
 * 查询参数错误保留在 payload.result 中；非五类查询才返回稳定失败 DTO。
 */
export function executeSnapshotQuery(
  input: EraSnapshotQueryInput,
): EraQueryResultPayload | EraSnapshotQueryFailure {
  if (!input || !isQueryType(input.queryType)) {
    return {
      error: {
        code: "ERA_QUERY_TYPE_UNSUPPORTED",
        message: `不支持的 ERA 快照查询类型：${String(input?.queryType)}`,
        category: "input",
        retryable: false,
      },
    };
  }
  if (
    !input.variables ||
    !isPlainRecord(input.variables.meta) ||
    !input.messageContext ||
    !Array.isArray(input.messageContext.messages)
  ) {
    return {
      error: {
        code: "ERA_QUERY_CONTEXT_INVALID",
        message: "ERA 快照查询缺少规范化变量或消息上下文。",
        category: "input",
        retryable: false,
      },
    };
  }

  const messages = input.messageContext.messages;
  let result: unknown;
  switch (input.queryType) {
    case "getCurrentVars":
      result = queryCurrentVars(input.variables, messages);
      break;
    case "getSnapshotAtMk":
      result = querySnapshotAtMk(input.request, input.variables, messages);
      break;
    case "getSnapshotsBetweenMks":
      result = querySnapshotsBetweenMks(
        input.request,
        input.variables,
        messages,
      );
      break;
    case "getSnapshotAtMId":
      result = querySnapshotAtMId(input.request, input.variables, messages);
      break;
    case "getSnapshotsBetweenMIds":
      result = querySnapshotsBetweenMIds(
        input.request,
        input.variables,
        messages,
      );
      break;
  }

  return {
    queryType: input.queryType,
    request:
      input.request === undefined
        ? undefined
        : cloneSnapshotValue(input.request),
    result,
    selectedMks: selectedMksOf(input.variables),
    editLogs: editLogsOf(input.variables),
  };
}
