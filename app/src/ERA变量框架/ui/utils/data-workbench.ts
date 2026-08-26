import type { EraCommitOperation } from '../../service/public-api';

export type JsonContainer = Record<string, unknown>;
export type VariableMutationKind = 'insert' | 'edit' | 'delete';
export type ProtectionChoice = 'temporary' | 'unlock';

export interface VariableProtection {
  readonly path: readonly string[];
  readonly field: 'updatable' | 'unInsertAble' | 'necessary';
  readonly value: unknown;
}

export interface VariablePlan {
  readonly operations: readonly EraCommitOperation[];
  readonly changedPaths: readonly string[];
  readonly changes: readonly VariableChange[];
}

export interface VariableChange {
  readonly path: readonly string[];
  readonly kind: VariableMutationKind;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function defineOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

export function jsonEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonEqual(value, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && jsonEqual(left[key], right[key]))
  );
}

export function valueAtPath(root: unknown, path: readonly string[]): unknown {
  let cursor = root;
  for (const segment of path) {
    if (!isRecord(cursor) && !Array.isArray(cursor)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

export function payloadAtPath(path: readonly string[], value: unknown): JsonContainer {
  if (path.length === 0) {
    if (!isRecord(value)) throw new TypeError('变量根操作必须是对象。');
    return structuredClone(value);
  }
  const root: JsonContainer = {};
  let cursor = root;
  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      defineOwn(cursor, segment, structuredClone(value));
      return;
    }
    const child: JsonContainer = {};
    defineOwn(cursor, segment, child);
    cursor = child;
  });
  return root;
}

function operation(kind: VariableMutationKind, path: readonly string[], value: unknown): EraCommitOperation {
  const payload = payloadAtPath(path, value);
  if (kind === 'insert') return { insert: payload };
  if (kind === 'edit') return { edit: payload };
  return { delete: payload };
}

function pathLabel(path: readonly string[]): string {
  return path.length === 0 ? '<root>' : path.join('.');
}

function diffAtPath(
  original: unknown,
  draft: unknown,
  path: readonly string[],
  operations: EraCommitOperation[],
  changedPaths: string[],
  changes: VariableChange[],
): void {
  if (jsonEqual(original, draft)) return;
  // `$template` is an ERA control field. The CRUD engine rejects unknown `$`
  // keys in VariableEdit, so an existing template is maintained through the
  // already-supported ordered Delete -> Insert pair. `$meta` remains editable.
  if (path.at(-1) === '$template') {
    operations.push(operation('delete', path, {}));
    operations.push(operation('insert', path, draft));
    changedPaths.push(pathLabel(path));
    changes.push({ path, kind: 'delete' }, { path, kind: 'insert' });
    return;
  }
  const originalObject = isRecord(original);
  const draftObject = isRecord(draft);
  if (originalObject && draftObject) {
    const keys = new Set([...Object.keys(original), ...Object.keys(draft)]);
    for (const key of keys) {
      const hasOriginal = Object.prototype.hasOwnProperty.call(original, key);
      const hasDraft = Object.prototype.hasOwnProperty.call(draft, key);
      const childPath = [...path, key];
      if (!hasOriginal) {
        operations.push(operation('insert', childPath, draft[key]));
        changedPaths.push(pathLabel(childPath));
        changes.push({ path: childPath, kind: 'insert' });
      } else if (!hasDraft) {
        operations.push(operation('delete', childPath, {}));
        changedPaths.push(pathLabel(childPath));
        changes.push({ path: childPath, kind: 'delete' });
      } else {
        diffAtPath(original[key], draft[key], childPath, operations, changedPaths, changes);
      }
    }
    return;
  }
  if (originalObject !== draftObject) {
    operations.push(operation('delete', path, {}));
    operations.push(operation('insert', path, draft));
    changes.push({ path, kind: 'delete' }, { path, kind: 'insert' });
  } else {
    operations.push(operation('edit', path, draft));
    changes.push({ path, kind: 'edit' });
  }
  changedPaths.push(pathLabel(path));
}

export function planVariableDiff(original: unknown, draft: unknown, path: readonly string[] = []): VariablePlan {
  const operations: EraCommitOperation[] = [];
  const changedPaths: string[] = [];
  const changes: VariableChange[] = [];
  diffAtPath(original, draft, path, operations, changedPaths, changes);
  return { operations, changedPaths, changes };
}

export function planVariableInsert(path: readonly string[], value: unknown): VariablePlan {
  return {
    operations: [operation('insert', path, value)],
    changedPaths: [pathLabel(path)],
    changes: [{ path, kind: 'insert' }],
  };
}

export function planVariableDelete(path: readonly string[]): VariablePlan {
  return {
    operations: [operation('delete', path, {})],
    changedPaths: [pathLabel(path)],
    changes: [{ path, kind: 'delete' }],
  };
}

export function planVariableExpression(path: readonly string[], expr: string): VariablePlan {
  if (path.length === 0) throw new TypeError('$expr 不能以变量根作为目标。');
  return {
    operations: [operation('edit', path, { $expr: expr })],
    changedPaths: [pathLabel(path)],
    changes: [{ path, kind: 'edit' }],
  };
}

function metaAt(value: unknown): Record<string, unknown> {
  return isRecord(value) && isRecord(value.$meta) ? value.$meta : {};
}

export function variableProtections(
  root: unknown,
  path: readonly string[],
  kind: VariableMutationKind,
): VariableProtection[] {
  const result: VariableProtection[] = [];
  for (let depth = 0; depth <= path.length; depth += 1) {
    const ancestorPath = path.slice(0, depth);
    const value = valueAtPath(root, ancestorPath);
    const meta = metaAt(value);
    if (kind === 'edit' && meta.updatable === false) {
      result.push({ path: ancestorPath, field: 'updatable', value: false });
    }
    if (kind === 'insert') {
      if (meta.unInsertAble === 'all') {
        result.push({ path: ancestorPath, field: 'unInsertAble', value: 'all' });
      } else if (depth === path.length - 1 && meta.unInsertAble === 'self') {
        result.push({ path: ancestorPath, field: 'unInsertAble', value: 'self' });
      }
    }
    if (kind === 'delete') {
      const directChild = depth === path.length - 1;
      if (meta.necessary === 'all' || (depth === path.length && meta.necessary === 'self')) {
        result.push({ path: ancestorPath, field: 'necessary', value: meta.necessary });
      } else if (directChild && meta.necessary === 'children') {
        result.push({ path: ancestorPath, field: 'necessary', value: 'children' });
      }
    }
  }
  return result.filter(
    (item, index, items) =>
      items.findIndex(other => other.field === item.field && jsonEqual(other.path, item.path)) === index,
  );
}

export function variablePlanProtections(root: unknown, plan: VariablePlan): VariableProtection[] {
  return plan.changes
    .flatMap(change => variableProtections(root, change.path, change.kind))
    .filter(
      (item, index, items) =>
        items.findIndex(other => other.field === item.field && jsonEqual(other.path, item.path)) === index,
    );
}

function metaEdit(path: readonly string[], field: string, value: unknown): EraCommitOperation {
  return operation('edit', path, { $meta: { [field]: value } });
}

function metaDelete(path: readonly string[], field: string): EraCommitOperation {
  return operation('delete', path, { $meta: { [field]: {} } });
}

export function wrapVariableProtection(
  operations: readonly EraCommitOperation[],
  protections: readonly VariableProtection[],
  choice: ProtectionChoice,
): readonly EraCommitOperation[] {
  const unlocks: EraCommitOperation[] = [];
  const restores: EraCommitOperation[] = [];
  for (const protection of protections) {
    if (protection.field === 'necessary') {
      unlocks.push(metaDelete(protection.path, protection.field));
      continue;
    }
    unlocks.push(metaEdit(protection.path, protection.field, protection.field === 'updatable' ? true : null));
    if (choice === 'temporary') {
      restores.unshift(metaEdit(protection.path, protection.field, protection.value));
    }
  }
  return [...unlocks, ...operations, ...restores];
}

export interface FunctionPlan {
  readonly operations: readonly EraCommitOperation[];
  readonly changedNames: readonly string[];
  readonly changes: readonly FunctionChange[];
}

export interface FunctionChange {
  readonly name: string;
  readonly kind: 'insert' | 'edit' | 'delete';
}

export function planFunctionLibraryDiff(
  original: Readonly<Record<string, unknown>>,
  draft: Readonly<Record<string, unknown>>,
): FunctionPlan {
  const inserted: Record<string, unknown> = {};
  const edited: Record<string, unknown> = {};
  const deleted: Record<string, unknown> = {};
  const changedNames: string[] = [];
  const changes: FunctionChange[] = [];
  for (const name of new Set([...Object.keys(original), ...Object.keys(draft)])) {
    const had = Object.prototype.hasOwnProperty.call(original, name);
    const has = Object.prototype.hasOwnProperty.call(draft, name);
    if (!had && has) {
      defineOwn(inserted, name, structuredClone(draft[name]));
      changes.push({ name, kind: 'insert' });
    } else if (had && !has) {
      defineOwn(deleted, name, {});
      changes.push({ name, kind: 'delete' });
    } else if (!jsonEqual(original[name], draft[name])) {
      defineOwn(edited, name, structuredClone(draft[name]));
      changes.push({ name, kind: 'edit' });
    } else continue;
    changedNames.push(name);
  }
  const operations: EraCommitOperation[] = [];
  if (Object.keys(inserted).length > 0) operations.push({ functionInsert: inserted });
  if (Object.keys(edited).length > 0) operations.push({ functionEdit: edited });
  if (Object.keys(deleted).length > 0) operations.push({ functionDelete: deleted });
  return { operations, changedNames, changes };
}

export interface NamedFunctionProtection extends VariableProtection {
  readonly name: string;
}

export function functionProtection(definition: unknown, kind: 'edit' | 'delete'): VariableProtection[] {
  const meta = metaAt(definition);
  if (kind === 'edit' && meta.updatable === false) {
    return [{ path: [], field: 'updatable', value: false }];
  }
  if (kind === 'delete' && (meta.necessary === 'self' || meta.necessary === 'all')) {
    return [{ path: [], field: 'necessary', value: meta.necessary }];
  }
  return [];
}

export function wrapFunctionProtection(
  name: string,
  operations: readonly EraCommitOperation[],
  protections: readonly VariableProtection[],
  choice: ProtectionChoice,
): readonly EraCommitOperation[] {
  if (protections.length === 0) return operations;
  const unlocks: EraCommitOperation[] = [];
  const restores: EraCommitOperation[] = [];
  for (const protection of protections) {
    if (protection.field === 'necessary') {
      unlocks.push({ functionDelete: { [name]: { $meta: { necessary: {} } } } });
      continue;
    }
    unlocks.push({ functionEdit: { [name]: { $meta: { updatable: true } } } });
    if (choice === 'temporary') {
      restores.unshift({ functionEdit: { [name]: { $meta: { updatable: protection.value } } } });
    }
  }
  return [...unlocks, ...operations, ...restores];
}

export function functionPlanProtections(
  original: Readonly<Record<string, unknown>>,
  plan: FunctionPlan,
): NamedFunctionProtection[] {
  return plan.changes
    .filter(change => change.kind !== 'insert')
    .flatMap(change =>
      functionProtection(original[change.name], change.kind === 'delete' ? 'delete' : 'edit').map(protection => ({
        ...protection,
        name: change.name,
      })),
    );
}

export function wrapFunctionPlanProtections(
  operations: readonly EraCommitOperation[],
  protections: readonly NamedFunctionProtection[],
  choice: ProtectionChoice,
): readonly EraCommitOperation[] {
  const unlocks: EraCommitOperation[] = [];
  const restores: EraCommitOperation[] = [];
  for (const protection of protections) {
    if (protection.field === 'necessary') {
      unlocks.push({ functionDelete: { [protection.name]: { $meta: { necessary: {} } } } });
      continue;
    }
    unlocks.push({ functionEdit: { [protection.name]: { $meta: { updatable: true } } } });
    if (choice === 'temporary') {
      restores.unshift({ functionEdit: { [protection.name]: { $meta: { updatable: protection.value } } } });
    }
  }
  return [...unlocks, ...operations, ...restores];
}
