import {
  cloneCrudValue,
  isPlainRecord,
  sanitizeArrays,
  type EraCrudDiagnostic,
} from "./crud_parser.ts";
import {
  getAtPath,
  hasAtPath,
  setAtPath,
  unsetAtPath,
  metaValue,
  isEmptyRecord,
  resolveTemplate,
  inheritedTemplateContent,
  applyTemplate,
  editDiagnostic,
} from "./crud_mutations.ts";
import { findLatestNewValue } from "../../snapshot/snapshot_history.ts";
import {
  forkOperation,
  type OperationState,
  type OperationAction,
} from "./operation_state.ts";

function readTree(state: OperationState): any {
  return state.context.localDelete
    ? state.context.localDelete.stat
    : state.stat;
}
function writableTree(state: OperationState): any {
  const tree = cloneCrudValue(readTree(state));
  if (state.context.localDelete)
    state.context.localDelete = { ...state.context.localDelete, stat: tree };
  else state.stat = tree;
  return tree;
}
function currentValue(state: OperationState, action: OperationAction): any {
  return action.path
    ? getAtPath(readTree(state), action.path)
    : readTree(state);
}

/** 只取一个位置；子项栈优先，整组函数候选其次，再取下一个根对象。 */
export function takeNextOperation(input: OperationState): {
  state: OperationState;
  route: string;
} {
  const state = forkOperation(input);
  if (state.done || state.failure) return { state, route: "done" };
  let action = state.stack.pop();
  if (!action && state.mode === "stage-calls") {
    const table = state.stageCallTable!;
    if (table.index >= table.calls.length) return { state, route: "done" };
    action = { kind: "stage-call", path: "", patch: table.calls[table.index] };
  }
  if (!action && state.functionGroup) {
    const group = { ...state.functionGroup };
    if (group.index >= group.names.length)
      action = { kind: "function-validate", path: "", patch: null };
    else {
      const name = group.names[group.index++];
      action = {
        kind: group.type,
        path: "",
        name,
        patch: group.root[name],
        current: group.original[name],
      };
      state.functionGroup = group;
    }
  }
  while (!action && state.commandIndex < state.commands.length) {
    const command = state.commands[state.commandIndex];
    if (state.rootIndex >= command.data.length) {
      state.commandIndex++;
      state.rootIndex = 0;
      continue;
    }
    action = {
      kind: command.type.startsWith("function-")
        ? "function-group"
        : command.type,
      path: "",
      patch: command.data[state.rootIndex++],
      root: true,
      template: { inheritedContent: null, parentPath: null },
    };
  }
  state.pendingAction = action ?? null;
  return {
    state,
    route: action?.kind === "assignment" ? "edit" : (action?.kind ?? "done"),
  };
}

export function inspectInsert(input: OperationState): {
  state: OperationState;
  route: string;
} {
  const state = forkOperation(input),
    a = state.pendingAction!;
  const current = currentValue(state, a);
  const parentData =
    a.template?.parentPath === null
      ? null
      : a.template?.parentPath === ""
        ? state.stat
        : getAtPath(state.stat, a.template?.parentPath ?? "");
  a.localTemplate = resolveTemplate({
    inheritedContent: a.template?.inheritedContent ?? null,
    parentData,
  });
  if (a.path && current === undefined) return { state, route: "apply" };
  if (!isPlainRecord(current) || !isPlainRecord(a.patch))
    return { state, route: "skip" };
  const keys = Object.keys(a.patch);
  if (
    metaValue(current, "unInsertAble") === "all" &&
    keys.length &&
    !keys.every((k) => k === "$meta")
  )
    return { state, route: "skip" };
  return { state, route: "descend" };
}
export function inheritInsertTemplate(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!;
  a.value = sanitizeArrays(applyTemplate(a.localTemplate, a.patch));
  return state;
}
export function applyInsert(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!;
  setAtPath(writableTree(state), a.path, a.value);
  state.context.pendingLog = {
    op: "insert",
    path: a.path,
    value_new: cloneCrudValue(a.value),
  };
  return state;
}

export function inspectRelativePatch(
  patch: unknown,
  current: unknown,
  path: string,
  stat: unknown,
):
  | { kind: "not-operator" | "expr" }
  | { kind: "invalid"; diagnostic: EraCrudDiagnostic } {
  if (!isPlainRecord(patch)) return { kind: "not-operator" };
  const keys = Object.keys(patch),
    controls = keys.filter((k) => k.startsWith("$") && k !== "$meta");
  if (!controls.length) return { kind: "not-operator" };
  let diagnostic: EraCrudDiagnostic | null = null;
  if (keys.length !== 1 || controls.length !== 1 || controls[0] !== "$expr")
    diagnostic = editDiagnostic(
      "ERA_EDIT_OPERATOR_INVALID",
      path,
      "数值表达式必须是只含 $expr 的单键对象；$inc、$mul、$div、$sub 和 $set 已不支持。",
    );
  else if (typeof patch.$expr !== "string" || !patch.$expr.trim())
    diagnostic = editDiagnostic(
      "ERA_EDIT_OPERATOR_INVALID",
      path,
      "$expr 的值必须是非空表达式字符串。",
    );
  else if (typeof current !== "number" || !Number.isFinite(current))
    diagnostic = editDiagnostic(
      "ERA_EDIT_TARGET_NOT_NUMERIC",
      path,
      "相对数值更新的目标当前值必须是有限数字。",
    );
  else if (!isPlainRecord(stat))
    diagnostic = editDiagnostic(
      "ERA_EDIT_OPERATOR_INVALID",
      path,
      "$expr 只能在对象变量状态上求值。",
    );
  return diagnostic ? { kind: "invalid", diagnostic } : { kind: "expr" };
}

/** 对象保护在递归入口检查；普通叶子赋值保持旧实现的父对象保护语义。 */
export function inspectEdit(input: OperationState): {
  state: OperationState;
  route: string;
} {
  const state = forkOperation(input),
    a = state.pendingAction!;
  const current = currentValue(state, a);
  if (a.kind === "assignment")
    return { state, route: hasAtPath(state.stat, a.path) ? "assign" : "skip" };
  if (current === undefined) return { state, route: "skip" };
  const locked = metaValue(current, "updatable") === false;
  if (
    locked &&
    !(
      isPlainRecord(a.patch) &&
      isPlainRecord(a.patch.$meta) &&
      a.patch.$meta.updatable === true
    )
  )
    return { state, route: "skip" };
  if (!isPlainRecord(a.patch)) return { state, route: "skip" };
  const relative = inspectRelativePatch(a.patch, current, a.path, state.stat);
  if (relative.kind === "invalid") {
    state.diagnostics.push(relative.diagnostic);
    return { state, route: "skip" };
  }
  if (relative.kind === "expr") {
    a.current = current;
    return { state, route: "expr" };
  }
  return { state, route: "descend" };
}
export function applyAssignment(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!;
  let previous = findLatestNewValue(
    a.path,
    state.context.messageId,
    Array.isArray(state.context.meta.SelectedMks)
      ? state.context.meta.SelectedMks
      : [],
    state.context.meta.EditLogs ?? {},
  );
  if (previous === null) previous = getAtPath(state.stat, a.path);
  const cleaned = sanitizeArrays(a.patch);
  setAtPath(writableTree(state), a.path, cleaned);
  state.context.pendingLog = {
    op: "update",
    path: a.path,
    value_old: cloneCrudValue(previous),
    value_new: cloneCrudValue(cleaned),
  };
  return state;
}

export function inspectDelete(input: OperationState): {
  state: OperationState;
  route: string;
} {
  const state = forkOperation(input),
    a = state.pendingAction!,
    current = currentValue(state, a);
  if (
    current === undefined ||
    (a.root && (!isPlainRecord(a.patch) || !Object.keys(a.patch).length))
  )
    return { state, route: "skip" };
  const necessary = metaValue(current, "necessary");
  const bypass =
    isPlainRecord(a.patch) &&
    (isEmptyRecord(a.patch.$meta) ||
      (isPlainRecord(a.patch.$meta) &&
        Object.prototype.hasOwnProperty.call(a.patch.$meta, "necessary")));
  if (isPlainRecord(a.patch) && Object.keys(a.patch).length) {
    if (necessary === "all" && !bypass) return { state, route: "skip" };
    return { state, route: "descend" };
  }
  return {
    state,
    route:
      necessary === "self" || necessary === "all" || !a.path ? "skip" : "apply",
  };
}
export function applyDelete(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!;
  const previous = cloneCrudValue(currentValue(state, a));
  unsetAtPath(writableTree(state), a.path);
  if (!state.context.localDelete)
    state.context.pendingLog = {
      op: "delete",
      path: a.path,
      value_old: previous,
    };
  return state;
}

/** 栈只保存路径和补丁；读取当前值留到实际弹出，后项能看见前项应用的状态。 */
export function pushChildPaths(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!,
    current = currentValue(state, a);
  const necessary = metaValue(current, "necessary"),
    protection = metaValue(current, "unInsertAble");
  const bypass =
    isPlainRecord(a.patch.$meta) &&
    (isEmptyRecord(a.patch.$meta) ||
      Object.prototype.hasOwnProperty.call(a.patch.$meta, "necessary"));
  const children: OperationAction[] = [];
  for (const key of Object.keys(a.patch)) {
    const patch = a.patch[key];
    if (
      a.kind === "insert" &&
      protection === "self" &&
      key !== "$meta" &&
      !Object.prototype.hasOwnProperty.call(current, key)
    )
      continue;
    if (
      a.kind === "delete" &&
      necessary === "children" &&
      isEmptyRecord(patch) &&
      !(key === "$meta" && bypass)
    )
      continue;
    children.push({
      kind: a.kind === "edit" && !isPlainRecord(patch) ? "assignment" : a.kind,
      path: a.path ? `${a.path}.${key}` : key,
      patch,
      ...(a.kind === "insert"
        ? {
            template: {
              inheritedContent: inheritedTemplateContent(a.localTemplate, key),
              parentPath: a.path,
            },
          }
        : {}),
    });
  }
  state.stack.push(...children.reverse());
  return state;
}
export function appendOperationLog(input: OperationState): OperationState {
  const state = forkOperation(input);
  if (state.context.pendingLog) state.editLog.push(state.context.pendingLog);
  delete state.context.pendingLog;
  return state;
}
export function skipOperation(input: OperationState): OperationState {
  return forkOperation(input);
}
export function settleOperation(input: OperationState): OperationState {
  return { ...input, pendingAction: null };
}
export function completeOperations(input: OperationState): OperationState {
  return { ...input, done: true, pendingAction: null };
}
