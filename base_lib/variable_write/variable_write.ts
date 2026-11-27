export type VariablePath = readonly (string | number)[];
export type VariableOp = "insert" | "edit" | "delete";
type RecordValue = Record<string, unknown>;
type Container = RecordValue | unknown[];

function record(value: unknown): RecordValue | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : undefined;
}

function own(value: unknown, key: string | number): unknown {
  return value !== null && typeof value === "object" && Object.hasOwn(value, key)
    ? (value as RecordValue)[key]
    : undefined;
}

function define(target: Container, key: string | number, value: unknown): void {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}

export function variablePathKey(path: VariablePath): string {
  return path.map((key, index) =>
    typeof key === "string" && /[\[\]]/u.test(key)
      ? `[${JSON.stringify(key)}]`
      : `${index === 0 ? "" : "."}${key}`).join("");
}

export function readVariablePath(tree: unknown, path: VariablePath): unknown {
  let value = tree;
  for (const key of path) {
    if (Array.isArray(value) ? typeof key !== "number" : typeof key !== "string") return undefined;
    value = own(value, key);
  }
  return value;
}

export function arrayOperations(payload: unknown, op: VariableOp): { path: VariablePath; value?: unknown }[] | undefined {
  const root = record(payload);
  if (!root || !Object.hasOwn(root, "$arrayOps")) return undefined;
  if (Object.keys(root).length !== 1 || !Array.isArray(root.$arrayOps)) return [];
  return root.$arrayOps.flatMap((entry) => {
    const fields = record(entry);
    const path = fields && own(fields, "path");
    if (!fields || !Array.isArray(path) || !path.length ||
        !path.every((key) => typeof key === "string" || (Number.isSafeInteger(key) && key >= 0)) ||
        !path.some((key) => typeof key === "number") ||
        Object.keys(fields).length !== (op === "delete" ? 1 : 2) ||
        (op !== "delete" && !Object.hasOwn(fields, "value"))) return [];
    return [{ path, value: fields.value }];
  });
}

function nextRule(rule: unknown, parent: unknown, key: string | number, inArray = false): unknown {
  return typeof key === "number"
    ? own(rule, "items")
    : inArray
      ? own(own(rule, "fields"), key)
      : own(own(own(parent, "$meta"), "fields"), key);
}

export function variableRuleSource(tree: unknown, path: VariablePath): { rule: RecordValue | undefined; path: VariablePath } {
  let rule = own(tree, "$meta");
  let source: VariablePath = ["$meta"];
  let value = tree;
  let inArray = false;
  for (const [index, key] of path.entries()) {
    if (typeof key === "number") {
      source = [...source, "items"];
    } else if (inArray) {
      source = [...source, "fields", key];
    } else {
      source = [...path.slice(0, index), "$meta", "fields", key];
    }
    inArray ||= typeof key === "number";
    rule = nextRule(rule, value, key, inArray);
    value = own(value, key);
  }
  return { rule: record(rule), path: source };
}

export function variableRuleAt(tree: unknown, path: VariablePath): RecordValue | undefined {
  return variableRuleSource(tree, path).rule;
}

function canDescend(rule: unknown, child: unknown, key: string | number, op: VariableOp, terminal: boolean): boolean {
  if (key === "$meta") return true;
  if (op === "edit") return own(rule, "updatable") !== false;
  if (op === "insert") {
    const locked = own(rule, "unInsertAble");
    return locked !== "all" && (locked !== "self" || child !== undefined || !terminal);
  }
  const necessary = own(rule, "necessary");
  return necessary !== "all" && (necessary !== "children" || !terminal);
}

function applyItemDefaults(template: unknown, value: unknown): unknown {
  const defaults = record(template), fields = record(value);
  if (!defaults || !fields) return value;
  const result: RecordValue = {};
  for (const key of new Set([...Object.keys(defaults), ...Object.keys(fields)])) {
    define(result, key, Object.hasOwn(fields, key)
      ? applyItemDefaults(own(defaults, key), own(fields, key))
      : own(defaults, key));
  }
  return result;
}

function sameValue(before: unknown, after: unknown): boolean {
  if (before === after) return true;
  if (Array.isArray(before) && Array.isArray(after))
    return before.length === after.length && before.every((value, index) => sameValue(value, after[index]));
  const left = record(before), right = record(after);
  if (!left || !right) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}

function containsArray(value: unknown): boolean {
  return Array.isArray(value) || (record(value) !== undefined && Object.entries(value as RecordValue)
    .some(([key, child]) => key !== "$meta" && key !== "$template" && containsArray(child)));
}

function acceptsRuleSetting(path: VariablePath, op: VariableOp, value: unknown): boolean {
  const start = path.indexOf("$meta");
  if (op === "delete" || start < 0 || path.includes("$template")) return true;
  for (let index = start + 1; index < path.length - 1; index++) {
    if (path[index] === "fields") index++;
    else if (path[index] !== "items") return true;
  }
  const field = path.at(-1);
  if (field === "updatable") return typeof value === "boolean";
  if (field === "min" || field === "max") return typeof value === "number" && Number.isFinite(value);
  return true;
}

type CheckedValue = { value: unknown };

function checkChange(before: unknown, proposed: unknown, rule: unknown, op: VariableOp, inArray = false, useTemplate = false): CheckedValue | undefined {
  if (op === "edit" && own(rule, "updatable") === false) return undefined;
  if (op === "delete" && ["self", "all"].includes(String(own(rule, "necessary")))) return undefined;

  const min = own(rule, "min"), max = own(rule, "max");
  if (op !== "delete" && (min !== undefined || max !== undefined)) {
    if (typeof proposed !== "number" || !Number.isFinite(proposed) ||
        (min !== undefined && (typeof min !== "number" || !Number.isFinite(min) || proposed < min)) ||
        (max !== undefined && (typeof max !== "number" || !Number.isFinite(max) || proposed > max))) return undefined;
  }

  const value = useTemplate ? applyItemDefaults(own(rule, "$template"), proposed) : proposed;
  if (op === "delete" && !inArray && !containsArray(before)) return { value };
  if (Array.isArray(before) || Array.isArray(value)) {
    const previous = Array.isArray(before) ? before : [];
    const candidate = Array.isArray(value) ? value : [];
    const items = [];
    for (let index = 0; index < Math.max(previous.length, candidate.length); index++) {
      const childOp = index >= previous.length ? "insert" : index >= candidate.length ? "delete" : "edit";
      if (childOp !== "delete" && !Object.hasOwn(candidate, index)) return undefined;
      if (childOp === "edit" && sameValue(previous[index], candidate[index])) {
        items.push(candidate[index]);
        continue;
      }
      if (op !== "insert" && !canDescend(rule, previous[index], index, childOp, true)) return undefined;
      const child = checkChange(previous[index], candidate[index], own(rule, "items"), childOp, true, childOp === "insert");
      if (!child) return undefined;
      if (childOp !== "delete") items.push(child.value);
    }
    if (Array.isArray(value)) return { value: items };
  }

  const previous = record(before), candidate = record(value);
  if (!previous && !candidate) return { value };
  const result: RecordValue = {};
  const keys = new Set([...Object.keys(previous ?? {}), ...Object.keys(candidate ?? {})]);
  for (const key of keys) {
    const oldValue = own(previous, key), newValue = own(candidate, key);
    if (key === "$meta" || key === "$template") {
      if (newValue !== undefined) define(result, key, newValue);
      continue;
    }
    const childOp = oldValue === undefined ? "insert" : newValue === undefined ? "delete" : "edit";
    if (childOp === "edit" && sameValue(oldValue, newValue)) {
      define(result, key, newValue);
      continue;
    }
    if (op !== "insert" && !canDescend(rule, oldValue, key, childOp, true)) return undefined;
    const child = checkChange(oldValue, newValue, nextRule(rule, previous ?? candidate, key, inArray), childOp, inArray);
    if (!child) return undefined;
    if (childOp !== "delete") define(result, key, child.value);
  }
  return { value: candidate ? result : value };
}

export type VariableWrite = {
  path: VariablePath;
  value: unknown;
  op: VariableOp;
  arrayPath: VariablePath | undefined;
};

export function planVariableWrite(tree: unknown, path: VariablePath, op: VariableOp, value?: unknown): VariableWrite | undefined {
  if (!path.length || !acceptsRuleSetting(path, op, value)) return undefined;
  let current = tree;
  let rule = own(tree, "$meta");
  let arrayPath: VariablePath | undefined;
  for (const [index, key] of path.entries()) {
    const terminal = index === path.length - 1;
    if (Array.isArray(current)) {
      if (typeof key !== "number" || !Number.isSafeInteger(key) || key < 0) return undefined;
      arrayPath ??= path.slice(0, index);
      if (terminal && op === "insert" && key !== current.length) return undefined;
    } else if (!record(current) || typeof key !== "string") return undefined;
    const child = own(current, key);
    if (!canDescend(rule, child, key, op, terminal)) return undefined;
    rule = nextRule(rule, current, key, arrayPath !== undefined);
    current = child;
  }
  if ((op === "insert") !== (current === undefined)) return undefined;
  const checked = checkChange(current, value, rule, op, arrayPath !== undefined, op === "insert" && typeof path.at(-1) === "number");
  if (!checked) return undefined;
  if (containsArray(current) || containsArray(checked.value)) arrayPath ??= path;
  return { path, value: checked.value, op, arrayPath };
}

export function applyVariableWrite(tree: unknown, write: VariableWrite): void {
  const parent = readVariablePath(tree, write.path.slice(0, -1)) as Container;
  const key = write.path[write.path.length - 1]!;
  if (write.op !== "delete") define(parent, key, structuredClone(write.value));
  else if (Array.isArray(parent)) parent.splice(key as number, 1);
  else delete parent[key];
}
