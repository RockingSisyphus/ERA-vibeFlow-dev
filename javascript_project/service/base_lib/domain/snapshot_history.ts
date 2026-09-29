/**
 * ERA 历史状态与五类公开查询的纯计算实现。
 *
 * 本模块只接收已经由 Capability 读取并规范化为 JSON 的变量和消息上下文，
 * 不读取 Tavern、时间、随机数或任何模块级状态，也不执行持久化写入。
 */

import { cloneEraPortableJsonV1 } from "@era/vibeflow-contracts";

export type EraSnapshotQueryType =
  | "getCurrentVars"
  | "getSnapshotAtMk"
  | "getSnapshotsBetweenMks"
  | "getSnapshotAtMId"
  | "getSnapshotsBetweenMIds";

export interface EraSnapshotVariables {
  readonly stat: unknown;
  readonly meta: Readonly<Record<string, unknown>>;
}

export interface EraSnapshotMessageContext {
  readonly messages: readonly unknown[];
}

export interface EraSnapshotQueryInput {
  readonly queryType: EraSnapshotQueryType;
  readonly request: unknown;
  readonly variables: EraSnapshotVariables;
  readonly messageContext: EraSnapshotMessageContext;
}

export interface EraSnapshotItem {
  readonly mk: string;
  readonly message_id: number;
  readonly is_user: boolean;
  readonly stat: unknown;
  readonly statWithoutMeta: unknown;
}

export interface EraSnapshotErrorResult {
  readonly error: string;
  readonly stat?: null;
}

export interface EraQueryResultPayload {
  readonly queryType: EraSnapshotQueryType;
  readonly request: unknown;
  readonly result: unknown;
  readonly selectedMks: readonly (string | null)[];
  readonly editLogs: Readonly<Record<string, unknown>>;
}

export interface EraSnapshotQueryFailure {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly category: "input" | "domain";
    readonly retryable: false;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}

export interface EraStatSnapshot {
  readonly mk: string;
  readonly message_id: number;
  readonly stat: unknown;
}

export interface EraEditLogEntry {
  readonly op?: unknown;
  readonly path?: unknown;
  readonly value_old?: unknown;
  readonly value_new?: unknown;
  readonly [key: string]: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function defineOwn(
  target: Record<string, unknown> | unknown[],
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

/** 通过统一 codec 创建不共享引用的可移植 JSON 副本。 */
export function cloneSnapshotValue<T>(value: T): T {
  return cloneEraPortableJsonV1(value) as T;
}

function unescapeString(value: string): string {
  return value
    .replace(/__DOT__/g, ".")
    .replace(/__DQUOTE__/g, '"')
    .replace(/__SQUOTE__/g, "'");
}

/** 递归反转义 ERA 的字符串键与字符串值。 */
export function unescapeEraData<T>(value: T): T {
  if (Array.isArray(value)) {
    const result = new Array<unknown>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      if (index in value) result[index] = unescapeEraData(value[index]);
    }
    return result as T;
  }
  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      defineOwn(result, unescapeString(key), unescapeEraData(value[key]));
    }
    return result as T;
  }
  return (typeof value === "string" ? unescapeString(value) : value) as T;
}

/** 深度移除所有纯对象中以 `$` 开头的字段，不修改输入。 */
export function removeMetaFields<T>(value: T): T {
  if (Array.isArray(value)) {
    const result = new Array<unknown>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      if (index in value) result[index] = removeMetaFields(value[index]);
    }
    return result as T;
  }
  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (!key.startsWith("$")) {
        defineOwn(result, key, removeMetaFields(value[key]));
      }
    }
    return result as T;
  }
  return value;
}

/** 兼容数组、单对象、JSON 数组字符串和 fenced JSON 数组。 */
export function parseEditLog(raw: unknown): readonly unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw !== null && typeof raw === "object") return [raw];
  if (typeof raw !== "string") return [];
  const source = raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  try {
    const parsed: unknown = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pathSegments(path: unknown): string[] {
  if (Array.isArray(path)) return path.map((segment) => String(segment));
  const source = String(path);
  const result: string[] = [];
  if (source.charCodeAt(0) === 46) result.push("");
  source.replace(
    /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,
    (match: string, number: string, quote: string, substring: string) => {
      result.push(
        quote ? substring.replace(/\\(\\)?/g, "$1") : number || match,
      );
      return match;
    },
  );
  return result;
}

function isArrayIndex(value: string): boolean {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) return false;
  const index = Number(value);
  return Number.isSafeInteger(index) && index >= 0 && index < 4_294_967_295;
}

function canTraverse(
  value: unknown,
): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === "object";
}

function readOwn(
  target: Record<string, unknown> | unknown[],
  key: string,
): unknown {
  return Object.prototype.hasOwnProperty.call(target, key)
    ? (target as Record<string, unknown>)[key]
    : undefined;
}

function setAtPath(target: unknown, path: unknown, value: unknown): void {
  if (!canTraverse(target)) return;
  const segments = pathSegments(path);
  if (segments.length === 0) return;
  let cursor: Record<string, unknown> | unknown[] = target;
  for (let index = 0; index < segments.length; index += 1) {
    const key = segments[index];
    if (index === segments.length - 1) {
      defineOwn(cursor, key, cloneSnapshotValue(value));
      return;
    }
    const child = readOwn(cursor, key);
    if (canTraverse(child)) {
      cursor = child;
    } else {
      const replacement: Record<string, unknown> | unknown[] = isArrayIndex(
        segments[index + 1],
      )
        ? []
        : {};
      defineOwn(cursor, key, replacement);
      cursor = replacement;
    }
  }
}

function unsetAtPath(target: unknown, path: unknown): void {
  if (!canTraverse(target)) return;
  const segments = pathSegments(path);
  if (segments.length === 0) return;
  let cursor: Record<string, unknown> | unknown[] = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const child = readOwn(cursor, segments[index]);
    if (!canTraverse(child)) return;
    cursor = child;
  }
  delete (cursor as Record<string, unknown>)[segments[segments.length - 1]];
}

function hasAtPath(target: unknown, path: unknown): boolean {
  if (!canTraverse(target)) return false;
  const segments = pathSegments(path);
  if (segments.length === 0) return false;
  let cursor: unknown = target;
  for (const segment of segments) {
    if (!canTraverse(cursor)) return false;
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) return false;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return true;
}

function getAtPath(target: unknown, path: unknown): unknown {
  if (!canTraverse(target)) return undefined;
  const segments = pathSegments(path);
  let cursor: unknown = target;
  for (const segment of segments) {
    if (!canTraverse(cursor)) return undefined;
    cursor = readOwn(cursor, segment);
  }
  return cursor;
}

function editEntry(value: unknown): EraEditLogEntry | null {
  return isRecord(value) ? value : null;
}

function applyRollbackMutable(stat: unknown, log: readonly unknown[]): unknown {
  for (let index = log.length - 1; index >= 0; index -= 1) {
    const entry = editEntry(log[index]);
    if (!entry) continue;
    const operation = String(entry.op || "").toLowerCase();
    const path = String(entry.path || "");
    if (!path) continue;
    if (operation === "insert") {
      unsetAtPath(stat, path);
    } else if (operation === "update" || operation === "delete") {
      if (typeof entry.value_old === "undefined") {
        unsetAtPath(stat, path);
      } else {
        setAtPath(stat, path, entry.value_old);
      }
    }
  }
  return stat;
}

function applyForwardMutable(stat: unknown, log: readonly unknown[]): unknown {
  for (const rawEntry of log) {
    const entry = editEntry(rawEntry);
    if (!entry || !entry.path) continue;
    const operation = String(entry.op || "").toLowerCase();
    if (operation === "insert" || operation === "update") {
      setAtPath(stat, entry.path, entry.value_new);
    } else if (operation === "delete") {
      unsetAtPath(stat, entry.path);
    }
  }
  return stat;
}

/** 将当前状态逆向计算到指定 MK；空目标表示回滚到绝对初始状态。 */
export function rollbackStatToMK(
  targetMK: string | null | undefined,
  currentMK: string,
  currentStat: unknown,
  selectedMks: readonly (string | null)[],
  allLogs: Readonly<Record<string, unknown>>,
): unknown {
  const currentIndex = selectedMks.indexOf(currentMK);
  const targetIndex = targetMK ? selectedMks.indexOf(targetMK) : -1;
  if (currentIndex === -1) {
    throw new Error(`在序列中未找到当前MK: ${currentMK}`);
  }
  if (targetMK && targetIndex === -1) {
    throw new Error(`在序列中未找到目标MK: ${targetMK}`);
  }
  if (targetIndex >= currentIndex) return cloneSnapshotValue(currentStat);

  let temporary = cloneSnapshotValue(currentStat);
  for (let index = currentIndex; index > targetIndex; index -= 1) {
    const mk = selectedMks[index];
    if (!mk) continue;
    temporary = applyRollbackMutable(temporary, parseEditLog(allLogs[mk]));
  }
  return temporary;
}

/** 从一个已知 MK 的状态正向计算到目标 MK。 */
export function calculateStatForward(
  startStat: unknown,
  startMK: string,
  targetMK: string,
  selectedMks: readonly (string | null)[],
  allLogs: Readonly<Record<string, unknown>>,
): unknown {
  const startIndex = selectedMks.indexOf(startMK);
  const targetIndex = selectedMks.indexOf(targetMK);
  if (startIndex === -1 || targetIndex === -1) {
    throw new Error(
      `在序列中未找到MK。起始MK: ${startMK}, 目标MK: ${targetMK}`,
    );
  }
  if (targetIndex <= startIndex) return cloneSnapshotValue(startStat);

  let temporary = cloneSnapshotValue(startStat);
  for (let index = startIndex + 1; index <= targetIndex; index += 1) {
    const mk = selectedMks[index];
    if (!mk) continue;
    temporary = applyForwardMutable(temporary, parseEditLog(allLogs[mk]));
  }
  return temporary;
}

/** 从空对象正向重放日志，计算目标 MK 对应的状态。 */
export function calculateStatAt(
  targetMK: string,
  selectedMks: readonly (string | null)[],
  allLogs: Readonly<Record<string, unknown>>,
): unknown {
  const targetIndex = selectedMks.indexOf(targetMK);
  if (targetIndex === -1) {
    throw new Error(`在序列中未找到目标MK: ${targetMK}`);
  }
  let temporary: unknown = {};
  for (let index = 0; index <= targetIndex; index += 1) {
    const mk = selectedMks[index];
    if (!mk) continue;
    temporary = applyForwardMutable(temporary, parseEditLog(allLogs[mk]));
  }
  return temporary;
}

/** 计算两个 MK 闭区间内所有非空 MK 的快照，并保留原消息索引。 */
export function calculateAllStatsBetweenMks(
  startMk: string,
  endMk: string,
  selectedMks: readonly (string | null)[],
  allLogs: Readonly<Record<string, unknown>>,
): EraStatSnapshot[] {
  const startIndex = selectedMks.indexOf(startMk);
  const endIndex = selectedMks.indexOf(endMk);
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return [];

  let currentStat = calculateStatAt(startMk, selectedMks, allLogs);
  const results: EraStatSnapshot[] = [
    {
      mk: startMk,
      message_id: startIndex,
      stat: cloneSnapshotValue(currentStat),
    },
  ];
  for (let index = startIndex + 1; index <= endIndex; index += 1) {
    const mk = selectedMks[index];
    if (!mk) continue;
    currentStat = applyForwardMutable(currentStat, parseEditLog(allLogs[mk]));
    results.push({
      mk,
      message_id: index,
      stat: cloneSnapshotValue(currentStat),
    });
  }
  return results;
}

/** 向前追溯指定路径最近一次写入后的值。 */
export function findLatestNewValue(
  path: string,
  startMessageId: number,
  selectedMks: readonly (string | null)[],
  allLogs: Readonly<Record<string, unknown>>,
): unknown {
  if (startMessageId < 0 || startMessageId > selectedMks.length) return null;
  for (let index = startMessageId - 1; index >= 0; index -= 1) {
    const mk = selectedMks[index];
    if (!mk) continue;
    const log = parseEditLog(allLogs[mk]);
    for (let entryIndex = log.length - 1; entryIndex >= 0; entryIndex -= 1) {
      const entry = editEntry(log[entryIndex]);
      if (!entry || !entry.path) continue;
      const entryPath = String(entry.path);
      if (entryPath === path) {
        return entry.op === "delete"
          ? null
          : cloneSnapshotValue(entry.value_new);
      }
      if (path.startsWith(`${entryPath}.`)) {
        const subPath = path.substring(entryPath.length + 1);
        if (
          isPlainRecord(entry.value_new) &&
          hasAtPath(entry.value_new, subPath)
        ) {
          return cloneSnapshotValue(getAtPath(entry.value_new, subPath));
        }
      }
    }
  }
  return null;
}
