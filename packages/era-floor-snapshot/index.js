/**
 * ERA 按楼变量与函数投影的唯一纯实现。
 *
 * 输入只包含 Sidecar 最新状态、完整修改日志与 SelectedMks；输出仅包含调用方
 * 请求的有限楼层，不维护或持久化逐楼快照。
 */

const clone = value => structuredClone(value);

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function selectedMks(meta) {
  return Array.isArray(meta.SelectedMks)
    ? meta.SelectedMks.map(value => (typeof value === 'string' ? value : null))
    : [];
}

function logs(meta, key) {
  return isRecord(meta[key]) ? clone(meta[key]) : {};
}

function parseLog(raw) {
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

function pathSegments(path) {
  if (Array.isArray(path)) return path.map(String);
  const result = [];
  String(path).replace(
    /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/gu,
    (match, number, quote, substring) => {
      result.push(quote ? substring.replace(/\\(\\)?/gu, '$1') : number || match);
      return match;
    },
  );
  return result;
}

function canTraverse(value) {
  return value !== null && typeof value === 'object';
}

function own(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : undefined;
}

function define(target, key, value) {
  Object.defineProperty(target, key, { value: clone(value), enumerable: true, configurable: true, writable: true });
}

function setAtPath(target, path, value) {
  if (!canTraverse(target)) return;
  const segments = pathSegments(path);
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
      cursor = own(cursor, key);
    }
  }
}

function unsetAtPath(target, path) {
  if (!canTraverse(target)) return;
  const segments = pathSegments(path);
  if (segments.length === 0) return;
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const child = own(cursor, segments[index]);
    if (!canTraverse(child)) return;
    cursor = child;
  }
  delete cursor[segments.at(-1)];
}

function applyVariableForward(stat, rawLog) {
  for (const entry of parseLog(rawLog)) {
    if (!isRecord(entry) || !entry.path) continue;
    const operation = String(entry.op ?? '').toLowerCase();
    if (operation === 'insert' || operation === 'update') setAtPath(stat, entry.path, entry.value_new);
    else if (operation === 'delete') unsetAtPath(stat, entry.path);
  }
  return stat;
}

function applyVariableRollback(stat, rawLog) {
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

function applyFunctionForward(statFunc, rawLog) {
  for (const entry of parseLog(rawLog)) {
    if (!isRecord(entry) || typeof entry.name !== 'string' || !entry.name) continue;
    const operation = String(entry.op ?? '').toLowerCase();
    if ((operation === 'insert' || operation === 'update') && Object.hasOwn(entry, 'value_new')) {
      define(statFunc, entry.name, entry.value_new);
    } else if (operation === 'delete') delete statFunc[entry.name];
  }
  return statFunc;
}

function applyFunctionRollback(statFunc, rawLog) {
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

function assertMessageId(messageId) {
  if (!Number.isSafeInteger(messageId) || messageId < 0) throw new TypeError('messageId 必须是非负安全整数。');
}

function result(messageId, mk, stat, statFunc) {
  if (!mk) throw new RangeError(`消息 #${messageId} 没有 ERA 快照。`);
  return { messageId, mk, stat: clone(stat), statFunc: clone(statFunc) };
}

export function projectFloorSnapshot(input) {
  assertMessageId(input.messageId);
  return projectFloorSnapshots({ ...input, messageIds: [input.messageId] })[0];
}

export function projectFloorSnapshots(input) {
  const targets = [...new Set(input.messageIds)].sort((left, right) => left - right);
  for (const target of targets) assertMessageId(target);
  if (targets.length === 0) return [];
  const mks = selectedMks(input.meta);
  const variableLogs = logs(input.meta, 'EditLogs');
  const functionLogs = logs(input.meta, 'FunctionEditLogs');
  const targetSet = new Set(targets);
  const minimum = targets[0];
  const maximum = targets.at(-1);
  if (maximum >= mks.length) throw new RangeError(`消息 #${maximum} 没有 ERA 快照。`);
  const output = [];
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
