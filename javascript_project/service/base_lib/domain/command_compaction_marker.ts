/**
 * 已封存命令层压缩的轻量调度标记。
 *
 * 它不是完整性校验，也不参与变量语义；仅用于避免对同一条、内容未变化的
 * assistant 消息重复请求纯压缩器。消息编辑、分支切换或 MK 变化都会自然使
 * contentHash 不匹配，从而再次进入候选队列。
 */

import { cloneSnapshotValue } from "./snapshot_query.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export const COMMAND_COMPACTION_META_KEY = "CommandCompaction";

export interface CommandCompactionMarkerV1 {
  readonly version: 1;
  readonly mk: string;
  readonly contentHash: string;
  /** Selected MK prefix at proof time; makes branch changes invalidate the hint. */
  readonly lineageHash: string;
  readonly status: "compacted" | "partial" | "unchanged";
}

/** Deterministic browser/Node hash. It is a scheduling hint, never an integrity gate. */
export function commandCompactionContentHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

export function commandCompactionLineageHash(
  selectedPrefix: readonly (string | null)[],
): string {
  return commandCompactionContentHash(JSON.stringify(selectedPrefix));
}

export function commandCompactionMarkersOf(
  meta: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return isPlainRecord(meta[COMMAND_COMPACTION_META_KEY])
    ? cloneSnapshotValue(meta[COMMAND_COMPACTION_META_KEY])
    : {};
}

export function commandCompactionMarkerIsCurrent(
  marker: unknown,
  mk: string,
  content: string,
  selectedPrefix: readonly (string | null)[],
): boolean {
  return (
    isPlainRecord(marker) &&
    marker.version === 1 &&
    marker.mk === mk &&
    marker.contentHash === commandCompactionContentHash(content) &&
    marker.lineageHash === commandCompactionLineageHash(selectedPrefix) &&
    (marker.status === "compacted" ||
      marker.status === "partial" ||
      marker.status === "unchanged")
  );
}

export function withCommandCompactionMarkers(
  meta: Readonly<Record<string, unknown>>,
  markers: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    ...(cloneSnapshotValue(meta) as Record<string, unknown>),
    [COMMAND_COMPACTION_META_KEY]: cloneSnapshotValue(markers),
  };
}
