/** 工作台共享纯计算；生产 Service 节点与 UI 预览由同一源码构建。 */
export type EraCommitOperation = { insert: Record<string, unknown> } | { edit: Record<string, unknown> } | { delete: Record<string, unknown> } | { functionInsert: Record<string, unknown> } | { functionEdit: Record<string, unknown> } | { functionDelete: Record<string, unknown> };
export type JsonContainer = Record<string, unknown>;
export type VariableMutationKind = 'insert' | 'edit' | 'delete';
export type ProtectionChoice = 'temporary' | 'unlock';

/** 记录一个实际阻断操作的元数据字段、所在路径与原值。 */
export interface VariableProtection {
  readonly path: readonly string[];
  readonly field: 'updatable' | 'unInsertAble' | 'necessary';
  readonly value: unknown;
}

/** 包含变量草稿差异的有序操作、人类可读路径与保护检查事实。 */
export interface VariablePlan {
  readonly operations: readonly EraCommitOperation[];
  readonly changedPaths: readonly string[];
  readonly changes: readonly VariableChange[];
}

export interface VariableChange {
  readonly path: readonly string[];
  readonly kind: VariableMutationKind;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function defineOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

/** 按 JSON 结构比较两个草稿；必须忽略对象键顺序，否则纯排序会制造假操作。 */
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

/** 只沿自有键读取子树，避免原型属性被误当作可编辑的 ERA 变量。 */
export function valueAtPath(root: unknown, path: readonly string[]): unknown {
  let cursor = root;
  for (const segment of path) {
    if (!isRecord(cursor) && !Array.isArray(cursor)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/** 把子树包装成 ERA CRUD 的嵌套 payload；必须克隆草稿，避免后续输入反向篡改 commit。 */
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

export function operation(kind: VariableMutationKind, path: readonly string[], value: unknown): EraCommitOperation {
  const payload = payloadAtPath(path, value);
  if (kind === 'insert') return { insert: payload };
  if (kind === 'edit') return { edit: payload };
  return { delete: payload };
}

export function pathLabel(path: readonly string[]): string {
  return path.length === 0 ? '<root>' : path.join('.');
}


/** 高级模式保留用户顺序，不推断或增加解锁。 */
export function normalizeOrderedOperations(value: unknown): readonly EraCommitOperation[] {
  if (!Array.isArray(value) || !value.length) throw new TypeError('有序操作必须是非空 JSON 数组。');
  return value.map(item => {
    if (!isRecord(item)) throw new TypeError('操作必须是对象。');
    const keys = Object.keys(item);
    if (keys.length !== 1 || !['insert', 'edit', 'delete'].includes(keys[0]) || !isRecord(item[keys[0]])) {
      throw new TypeError('操作只能包含 insert、edit 或 delete 之一，载荷必须是对象。');
    }
    return structuredClone(item) as EraCommitOperation;
  });
}

/** 编辑意图是内部 JSON DTO；基准由 Service 核对，operations 仅用于显式高级模式。 */
export interface WorkbenchIntent {
  readonly domain: 'variable' | 'function' | 'ordered';
  readonly mode: 'add' | 'edit' | 'delete' | 'batch' | 'save-as';
  readonly identityKey: string;
  readonly sidecarId: string | null;
  readonly revision: number | null;
  readonly initial: unknown;
  readonly path?: readonly string[];
  readonly name?: string;
  readonly value?: unknown;
  readonly expression?: string;
  readonly operations?: readonly EraCommitOperation[];
  readonly protections: readonly (VariableProtection & { readonly name?: string })[];
  readonly choice: ProtectionChoice | '';
}
