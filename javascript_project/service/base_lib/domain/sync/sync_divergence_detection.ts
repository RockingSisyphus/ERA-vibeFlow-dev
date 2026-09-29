/** Pure detection of the earliest divergent or unfinished sealed floor. */
import { commandCompactionMarkerIsCurrent,commandCompactionMarkersOf } from "../commands/command_compaction_marker.ts";
import { hasAppliedBlockRecords } from "../commands/message_function_calls.ts";
import { messageContentVersion,readMessageKey,readMkMessageText,type EraMkMessageV1 } from "../mk_engine.ts";
import { cloneSnapshotValue,parseEditLog } from "../snapshot_history.ts";
import type { EraSyncDivergenceV1 } from "./sync_types.ts";

/** 读取当前消息列表的有效 MK 链；缺失或损坏 MK 显式为 null。 */
export function currentSelectedMks(
  messages: readonly EraMkMessageV1[],
): readonly (string | null)[] {
  return messages.map((message) => readMessageKey(message));
}

export function difference(
  values: readonly (string | null)[],
  exclusions: readonly (string | null)[],
): (string | null)[] {
  return values.filter((value) => !exclusions.includes(value));
}

export function editLogsAreEmpty(
  mks: readonly (string | null)[],
  meta: Readonly<Record<string, unknown>>,
): boolean {
  const logs = meta.EditLogs !== null && typeof meta.EditLogs === "object" && !Array.isArray(meta.EditLogs)
    ? meta.EditLogs as Record<string, unknown> : {};
  const functionLogs = meta.FunctionEditLogs !== null && typeof meta.FunctionEditLogs === "object" && !Array.isArray(meta.FunctionEditLogs)
    ? meta.FunctionEditLogs as Record<string, unknown> : {};
  for (const mk of mks) {
    if (!mk) continue;
    if (parseEditLog(logs[mk]).length > 0 || parseEditLog(functionLogs[mk]).length > 0) return false;
  }
  return true;
}

function firstUncompactedSealedAssistant(
  messages: readonly EraMkMessageV1[],
  meta: Readonly<Record<string, unknown>>,
): number | null {
  const markers = commandCompactionMarkersOf(meta);
  for (let index = 0; index < messages.length - 1; index += 1) {
    const message = messages[index];
    if (message.role !== "assistant" || message.content.kind !== "text")
      continue;
    if (
      !messages
        .slice(index + 1)
        .some((candidate) => candidate.role === "assistant")
    )
      continue;
    const content = readMkMessageText(message);
    if (
      !/<((?:Variable|Function)(?:Insert|Edit|Delete))>\s*[\s\S]*?<\/\1>/iu.test(
        content,
      )
    )
      continue;
    const mk = readMessageKey(message);
    const marker = mk === null ? null : markers[mk];
    const selectedPrefix = messages
      .slice(0, index)
      .map((candidate) => readMessageKey(candidate));
    if (
      mk === null ||
      !commandCompactionMarkerIsCurrent(marker, mk, content, selectedPrefix)
    )
      return index;
  }
  return null;
}

/**
 * 把重算起点收紧到「最早带已应用记录的楼层」。
 *
 * 只在记录楼层更靠前时才改变结论：它更靠后时常规分歧点已经覆盖它，不需要动。
 */
function tightenToAppliedRecords(
  divergence: EraSyncDivergenceV1,
  messages: readonly EraMkMessageV1[],
): EraSyncDivergenceV1 {
  const recordFloor = firstAppliedRecordFloor(messages);
  if (recordFloor === null) return divergence;
  if (divergence.type === "FULL_RECALC" && divergence.recalcId <= recordFloor) {
    return divergence;
  }
  return { type: "FULL_RECALC", recalcId: recordFloor, cause: "divergence" };
}

/**
 * 最早带有「已应用」记录（逐块提交的进度凭据）的楼层下标。
 *
 * 这类楼层是被中断的：sidecar 里的 stat 停在它算到一半的位置，因此**必须**从它开始重算，
 * 否则「中断楼层 + 之后又来了新楼层」会让它永远算不完（常规分歧点落在它后面）。
 */
function firstAppliedRecordFloor(
  messages: readonly EraMkMessageV1[],
): number | null {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message === undefined || message.content.kind !== "text") continue;
    if (hasAppliedBlockRecords(message.content.text)) return index;
  }
  return null;
}

/**
 * 比较 current/old SelectedMks，并保留候选唯一 fast path：只删除且被删 MK
 * 的 EditLog 全部为空。
 */
export function findSyncDivergence(
  messages: readonly EraMkMessageV1[],
  oldSelectedMks: readonly (string | null)[],
  initialMeta: Readonly<Record<string, unknown>>,
  forceFullRebuild = false,
): EraSyncDivergenceV1 {
  if (forceFullRebuild) {
    return { type: "FULL_RECALC", recalcId: 0, cause: "forced" };
  }
  const versions = initialMeta.MessageContentVersions;
  if (Array.isArray(versions)) {
    const changed = messages.findIndex(
      (message, index) =>
        index < versions.length &&
        versions[index] !== messageContentVersion(readMkMessageText(message)),
    );
    if (changed >= 0)
      return { type: "FULL_RECALC", recalcId: changed, cause: "divergence" };
  }
  const current = currentSelectedMks(messages);
  const minimum = Math.min(current.length, oldSelectedMks.length);
  let firstMismatch = -1;
  for (let index = 0; index < minimum; index += 1) {
    if (current[index] !== oldSelectedMks[index]) {
      firstMismatch = index;
      break;
    }
  }
  if (firstMismatch === -1 && current.length !== oldSelectedMks.length) {
    firstMismatch = minimum;
  }
  // Appending a new assistant makes a previous assistant floor immutable. Re-open
  // only the earliest uncompressed sealed interval so that real chat traffic,
  // rather than a later manual full sync, performs the promised compaction.
  if (firstMismatch === minimum && current.length > oldSelectedMks.length) {
    const sealedIndex = firstUncompactedSealedAssistant(messages, initialMeta);
    if (sealedIndex !== null && sealedIndex < firstMismatch) {
      return {
        type: "FULL_RECALC",
        recalcId: sealedIndex,
        cause: "divergence",
      };
    }
  }
  if (firstMismatch === -1) {
    return tightenToAppliedRecords(
      {
        type: "FULL_RECALC",
        recalcId: messages.length > 0 ? messages.length - 1 : 0,
        cause: "no-divergence",
      },
      messages,
    );
  }
  const deleted = difference(oldSelectedMks, current);
  const added = difference(current, oldSelectedMks);
  if (
    added.length === 0 &&
    deleted.length > 0 &&
    editLogsAreEmpty(deleted, initialMeta)
  ) {
    return tightenToAppliedRecords(
      {
        type: "FAST_SYNC",
        firstMismatch,
        newSelectedMks: cloneSnapshotValue(current),
      },
      messages,
    );
  }
  return tightenToAppliedRecords(
    {
      type: "FULL_RECALC",
      recalcId: firstMismatch,
      cause: "divergence",
    },
    messages,
  );
}
