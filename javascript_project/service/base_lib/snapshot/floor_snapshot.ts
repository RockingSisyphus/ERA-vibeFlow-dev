/** 从活动消息正文读取 ERA 消息键。 */
export function messageMk(text: string): string | null {
  const block = text.match(/<era_data>(\{[\s\S]*?\})<\/era_data>/iu)?.[1];
  return block?.match(/"era-message-key"\s*=\s*"([^"]+)"/u)?.[1] ?? null;
}
export type { EraDataTransformDirection } from '../../../../base_lib/data_view/data_view.js';
import { pathSegments, selectedMks } from '../../../../base_lib/data_view/data_view.js';
export { selectedMks, transformEraData, removeMetaFields } from '../../../../base_lib/data_view/data_view.js';
export { projectPublicState } from './public_state.js';
export interface EraFloorSnapshot {
  readonly messageId: number;
  readonly mk: string;
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
}

export interface EraFloorProjectionInput {
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly meta: Readonly<Record<string, unknown>>;
}

/**
 * ERA 按楼变量与函数投影的唯一纯实现。
 *
 * 输入只包含 Sidecar 最新状态、完整修改日志与 SelectedMks；输出仅包含调用方
 * 请求的有限楼层，不维护或持久化逐楼快照。
 */

const clone = <T>(value: T): T => structuredClone(value);

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);


function logs(meta: Readonly<Record<string, unknown>>, key: string): Record<string, unknown> {
  return isRecord(meta[key]) ? clone(meta[key]) : {};
}

function parseLog(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (isRecord(raw)) return [raw];
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/gu, ''));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function floorLogPathSegments(path: unknown): string[] {
  return Array.isArray(path) ? path.map(String) : pathSegments(String(path), false);
}

function canTraverse(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function own(target: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : undefined;
}

function define(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value: clone(value), enumerable: true, configurable: true, writable: true });
}

function setAtPath(target: unknown, path: unknown, value: unknown): void {
  if (!canTraverse(target)) return;
  const segments = floorLogPathSegments(path);
  if (segments.length === 0) return;
  let cursor = target;
  for (let index = 0; index < segments.length; index += 1) {
    const key = segments[index];
    if (index === segments.length - 1) {
      define(cursor, key, value);
      return;
    }
    const child = own(cursor, key);
    if (canTraverse(child)) cursor = child;
    else {
      const replacement = /^(?:0|[1-9]\d*)$/u.test(segments[index + 1]) ? [] : {};
      define(cursor, key, replacement);
      cursor = own(cursor, key) as Record<string, unknown>;
    }
  }
}

function unsetAtPath(target: unknown, path: unknown): void {
  if (!canTraverse(target)) return;
  const segments = floorLogPathSegments(path);
  if (segments.length === 0) return;
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const child = own(cursor, segments[index]);
    if (!canTraverse(child)) return;
    cursor = child;
  }
  delete cursor[segments.at(-1)!];
}

function applyVariableForward(stat: unknown, rawLog: unknown): unknown {
  for (const entry of parseLog(rawLog)) {
    if (!isRecord(entry) || !entry.path) continue;
    const operation = String(entry.op ?? '').toLowerCase();
    if (operation === 'insert' || operation === 'update') setAtPath(stat, entry.path, entry.value_new);
    else if (operation === 'delete') unsetAtPath(stat, entry.path);
  }
  return stat;
}

function applyVariableRollback(stat: unknown, rawLog: unknown): unknown {
  const entries = parseLog(rawLog);
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!isRecord(entry) || !entry.path) continue;
    const operation = String(entry.op ?? '').toLowerCase();
    if (operation === 'insert') unsetAtPath(stat, entry.path);
    else if (operation === 'update' || operation === 'delete') {
      if (Object.prototype.hasOwnProperty.call(entry, 'value_old')) setAtPath(stat, entry.path, entry.value_old);
      else unsetAtPath(stat, entry.path);
    }
  }
  return stat;
}

function applyFunctionForward(statFunc: Record<string, unknown>, rawLog: unknown): Record<string, unknown> {
  for (const entry of parseLog(rawLog)) {
    if (!isRecord(entry) || typeof entry.name !== 'string' || !entry.name) continue;
    const operation = String(entry.op ?? '').toLowerCase();
    if ((operation === 'insert' || operation === 'update') && Object.hasOwn(entry, 'value_new')) {
      define(statFunc, entry.name, entry.value_new);
    } else if (operation === 'delete') delete statFunc[entry.name];
  }
  return statFunc;
}

function applyFunctionRollback(statFunc: Record<string, unknown>, rawLog: unknown): Record<string, unknown> {
  const entries = parseLog(rawLog);
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!isRecord(entry) || typeof entry.name !== 'string' || !entry.name) continue;
    const operation = String(entry.op ?? '').toLowerCase();
    if (operation === 'insert') delete statFunc[entry.name];
    else if (operation === 'update' || operation === 'delete') {
      if (Object.hasOwn(entry, 'value_old')) define(statFunc, entry.name, entry.value_old);
      else delete statFunc[entry.name];
    }
  }
  return statFunc;
}

function assertMessageId(messageId: number): void {
  if (!Number.isSafeInteger(messageId) || messageId < 0) throw new TypeError('messageId 必须是非负安全整数。');
}

function result(messageId: number, mk: string | null, stat: unknown, statFunc: Readonly<Record<string, unknown>>): EraFloorSnapshot {
  if (!mk) throw new RangeError(`消息 #${messageId} 没有 ERA 快照。`);
  return { messageId, mk, stat: clone(stat), statFunc: clone(statFunc) };
}

export function projectFloorSnapshot(input: EraFloorProjectionInput & { readonly messageId: number }): EraFloorSnapshot {
  assertMessageId(input.messageId);
  return projectFloorSnapshots({ ...input, messageIds: [input.messageId] })[0];
}

export function projectFloorSnapshots(input: EraFloorProjectionInput & { readonly messageIds: readonly number[] }): readonly EraFloorSnapshot[] {
  const targets = [...new Set(input.messageIds)].sort((left, right) => left - right);
  for (const target of targets) assertMessageId(target);
  if (targets.length === 0) return [];
  const mks = selectedMks(input.meta);
  const variableLogs = logs(input.meta, 'EditLogs');
  const functionLogs = logs(input.meta, 'FunctionEditLogs');
  const targetSet = new Set(targets);
  const minimum = targets[0];
  const maximum = targets.at(-1)!;
  if (maximum >= mks.length) throw new RangeError(`消息 #${maximum} 没有 ERA 快照。`);
  const output: EraFloorSnapshot[] = [];
  const forwardSteps = maximum + 1;
  const rollbackSteps = Math.max(0, mks.length - 1 - minimum);
  if (rollbackSteps < forwardSteps) {
    let stat = clone(input.stat);
    let statFunc = clone(input.statFunc);
    for (let index = mks.length - 1; index >= minimum; index -= 1) {
      const mk = mks[index];
      if (targetSet.has(index)) output.push(result(index, mk, stat, statFunc));
      if (mk) {
        stat = applyVariableRollback(stat, variableLogs[mk]);
        statFunc = applyFunctionRollback(statFunc, functionLogs[mk]);
      }
    }
    return output.sort((left, right) => left.messageId - right.messageId);
  }
  const stat = {};
  const statFunc = {};
  for (let index = 0; index <= maximum; index += 1) {
    const mk = mks[index];
    if (mk) {
      applyVariableForward(stat, variableLogs[mk]);
      applyFunctionForward(statFunc, functionLogs[mk]);
    }
    if (targetSet.has(index)) output.push(result(index, mk, stat, statFunc));
  }
  return output;
}
