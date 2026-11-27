import {
  applyVariableWrite,
  arrayOperations,
  planVariableWrite,
  readVariablePath,
  variablePathKey,
  variableRuleAt,
  type VariableOp,
} from "../../../../../base_lib/variable_write/variable_write.ts";
import {
  cloneCrudValue,
  isPlainRecord,
  type EraCrudDiagnostic,
} from "./crud_parser.ts";
import {
  getAtPath,
  resolveTemplate,
  inheritedTemplateContent,
  applyTemplate,
  editDiagnostic,
} from "./crud_mutations.ts";
import { pathSegments } from "../../../../../base_lib/data_view/data_view.js";
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
function actionPath(action: OperationAction) {
  return action.arrayPath ?? (action.path ? pathSegments(action.path) : []);
}

function currentValue(state: OperationState, action: OperationAction): unknown {
  return readVariablePath(readTree(state), actionPath(action));
}

function writeValue(state: OperationState, op: VariableOp, value?: unknown, messageStart = false): OperationState {
  const action = state.pendingAction!;
  const before = readTree(state);
  const path = actionPath(action);
  const write = planVariableWrite(before, path, op, value);
  if (!write) return state;
  const logPath = write.arrayPath ?? path;
  const beforeValue = readVariablePath(before, logPath);
  const after = writableTree(state);
  applyVariableWrite(after, write);
  if (state.context.localDelete) return state;
  const newValue = readVariablePath(after, logPath);
  const messageValue = !write.arrayPath && messageStart
    ? readVariablePath(state.messageStartStat, logPath)
    : undefined;
  const oldValue = messageValue === undefined ? beforeValue : messageValue;
  const key = variablePathKey(logPath);
  state.context.pendingLog = beforeValue === undefined
    ? { op: "insert", path: key, value_new: cloneCrudValue(newValue) }
    : newValue === undefined
      ? { op: "delete", path: key, value_old: cloneCrudValue(oldValue) }
      : { op: "update", path: key, value_old: cloneCrudValue(oldValue), value_new: cloneCrudValue(newValue) };
  return state;
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
    const patch = command.data[state.rootIndex++];
    if (command.type === "insert" || command.type === "edit" || command.type === "delete") {
      const operations = arrayOperations(patch, command.type);
      if (operations) {
        state.stack.push(...operations.map(({ path, value }) => ({
          kind: command.type,
          path: variablePathKey(path),
          arrayPath: path,
          patch: value,
        })).reverse());
        action = state.stack.pop();
        continue;
      }
    }
    action = {
      kind: command.type.startsWith("function-")
        ? "function-group"
        : command.type,
      path: "",
      patch,
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
  if (a.arrayPath) return { state, route: "apply" };
  const parentData = a.template?.parentPath === null
    ? null
    : a.template?.parentPath === ""
      ? state.stat
      : getAtPath(state.stat, a.template?.parentPath ?? "");
  a.localTemplate = resolveTemplate({ inheritedContent: a.template?.inheritedContent ?? null, parentData });
  if (a.path && current === undefined) return { state, route: "apply" };
  return { state, route: isPlainRecord(current) && isPlainRecord(a.patch) ? "descend" : "skip" };
}

export function inheritInsertTemplate(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!;
  a.value = applyTemplate(a.localTemplate, a.patch);
  return state;
}
export function applyInsert(input: OperationState): OperationState {
  const state = forkOperation(input);
  const action = state.pendingAction!;
  return writeValue(state, "insert", action.arrayPath ? action.patch : action.value);
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

/** 修改补丁递归到字段；显式数组路径可直接替换整个目标。 */
export function inspectEdit(input: OperationState): {
  state: OperationState;
  route: string;
} {
  const state = forkOperation(input),
    a = state.pendingAction!;
  const current = currentValue(state, a);
  if (current === undefined) return { state, route: "skip" };
  if (a.kind === "assignment") return { state, route: "assign" };
  if (a.arrayPath) return { state, route: "assign" };
  if (!isPlainRecord(a.patch)) return { state, route: "skip" };
  const relative = inspectRelativePatch(a.patch, current, a.path, state.stat);
  if (relative.kind === "invalid") {
    state.diagnostics.push(relative.diagnostic);
    return { state, route: "skip" };
  }
  if (relative.kind === "expr") {
    const path = actionPath(a);
    if (path.some((_, index) => variableRuleAt(state.stat, path.slice(0, index))?.updatable === false) ||
        variableRuleAt(state.stat, path)?.updatable === false) return { state, route: "skip" };
    a.current = current;
    return { state, route: "expr" };
  }
  return { state, route: "descend" };
}
export function applyAssignment(input: OperationState): OperationState {
  const state = forkOperation(input);
  return writeValue(state, "edit", state.pendingAction!.patch, true);
}

export function applyCalculatedValue(input: OperationState): OperationState {
  const state = forkOperation(input);
  const value = state.pendingAction!.value;
  return writeValue(state, "edit", Object.is(value, -0) ? 0 : value);
}

export function inspectDelete(input: OperationState): {
  state: OperationState;
  route: string;
} {
  const state = forkOperation(input);
  const action = state.pendingAction!;
  if (currentValue(state, action) === undefined) return { state, route: "skip" };
  if (action.arrayPath) return { state, route: "apply" };
  if (isPlainRecord(action.patch) && Object.keys(action.patch).length)
    return { state, route: "descend" };
  return { state, route: action.path ? "apply" : "skip" };
}

export function applyDelete(input: OperationState): OperationState {
  return writeValue(forkOperation(input), "delete");
}

/** 栈只保存路径和补丁；读取当前值留到实际弹出，后项能看见前项应用的状态。 */
export function pushChildPaths(input: OperationState): OperationState {
  const state = forkOperation(input);
  const a = state.pendingAction!;
  const children: OperationAction[] = [];
  for (const key of Object.keys(a.patch)) {
    const patch = a.patch[key];
    children.push({
      kind: a.kind === "edit" && !isPlainRecord(patch) ? "assignment" : a.kind,
      path: variablePathKey([...actionPath(a), key]),
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
