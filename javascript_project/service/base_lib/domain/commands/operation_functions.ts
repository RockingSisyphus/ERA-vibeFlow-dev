import {
  cloneCrudValue,
  defineOwn,
  isPlainRecord,
  mergeReplaceArray,
} from "./crud_parser.ts";
import { functionDiagnostic, metaValue } from "./crud_mutations.ts";
import { forkOperation, type OperationState } from "./operation_state.ts";

function metadata(value: any): any {
  return isPlainRecord(value) && isPlainRecord(value.$meta)
    ? value.$meta
    : null;
}
function metadataOnly(value: any): boolean {
  return (
    isPlainRecord(value) &&
    Object.keys(value).length === 1 &&
    metadata(value) !== null
  );
}
function definitionDiagnostic(value: any, name: string): any {
  const meta = metadata(value);
  if (meta && Object.prototype.hasOwnProperty.call(meta, "unInsertAble"))
    return functionDiagnostic(
      "ERA_FUNCTION_META_UNSUPPORTED",
      name,
      "函数是平面实体，不支持 $meta.unInsertAble。",
    );
  if (meta?.necessary === "children")
    return functionDiagnostic(
      "ERA_FUNCTION_META_UNSUPPORTED",
      name,
      "函数是平面实体，不支持 $meta.necessary: children。",
    );
  return null;
}
function editedDefinition(current: any, patch: any): any {
  if (!isPlainRecord(current) || !isPlainRecord(patch))
    return cloneCrudValue(patch);
  const patchMeta = metadata(patch);
  if (metadataOnly(patch)) {
    if (!Object.keys(patchMeta).length) return cloneCrudValue(current);
    const next = cloneCrudValue(current);
    defineOwn(next, "$meta", mergeReplaceArray(current.$meta, patchMeta));
    return next;
  }
  const next = cloneCrudValue(patch);
  if (!Object.prototype.hasOwnProperty.call(patch, "$meta")) {
    if (Object.prototype.hasOwnProperty.call(current, "$meta"))
      defineOwn(next, "$meta", cloneCrudValue(current.$meta));
  } else if (patchMeta !== null)
    defineOwn(next, "$meta", mergeReplaceArray(current.$meta, patchMeta));
  return next;
}

export function inspectFunctionGroup(input: OperationState): {
  state: OperationState;
  route: string;
} {
  const state = forkOperation(input),
    a = state.pendingAction!,
    type = state.commands[state.commandIndex].type;
  if (!isPlainRecord(a.patch) || !Object.keys(a.patch).length) {
    a.diagnostic = functionDiagnostic(
      "ERA_FUNCTION_COMMAND_INVALID",
      "",
      "函数指令必须是非空对象。",
    );
    return { state, route: "invalid" };
  }
  const invalid = Object.keys(a.patch).find((name) => {
    const exists = Object.prototype.hasOwnProperty.call(state.statFunc, name),
      patch = a.patch[name];
    return (
      (type === "function-insert" && exists) ||
      (type === "function-edit" && !exists) ||
      (type === "function-delete" &&
        !(isPlainRecord(patch) && !Object.keys(patch).length) &&
        !metadataOnly(patch))
    );
  });
  if (invalid !== undefined) {
    const code =
      type === "function-delete"
        ? "ERA_FUNCTION_DELETE_INVALID"
        : type === "function-insert"
          ? "ERA_FUNCTION_ALREADY_EXISTS"
          : "ERA_FUNCTION_NOT_FOUND";
    a.diagnostic = functionDiagnostic(
      code,
      invalid,
      code === "ERA_FUNCTION_DELETE_INVALID"
        ? "FunctionDelete 的函数值必须是空对象。"
        : code === "ERA_FUNCTION_ALREADY_EXISTS"
          ? "FunctionInsert 只能新增不存在的函数。"
          : "FunctionEdit 只能修改既有函数。",
    );
    return { state, route: "invalid" };
  }
  return { state, route: "valid" };
}
export function beginFunctionCandidate(input: OperationState): OperationState {
  const state = forkOperation(input),
    root = state.pendingAction!.patch;
  state.functionGroup = {
    type: state.commands[state.commandIndex].type,
    root,
    names: Object.keys(root),
    index: 0,
    original: state.statFunc,
    candidate: cloneCrudValue(state.statFunc),
    changes: [],
  };
  return state;
}
export function prepareFunctionInsert(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!;
  a.value = cloneCrudValue(a.patch);
  a.changeKind = "insert";
  return state;
}
export function prepareFunctionEdit(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!;
  a.value = editedDefinition(a.current, a.patch);
  a.changeKind = "update";
  a.skip =
    metaValue(a.current, "updatable") === false &&
    !(metadata(a.patch)?.updatable === true);
  return state;
}
export function prepareFunctionDelete(input: OperationState): {
  state: OperationState;
  route: string;
} {
  const state = forkOperation(input),
    a = state.pendingAction!;
  if (metadataOnly(a.patch)) return { state, route: "meta" };
  a.changeKind = "delete";
  const necessary = metaValue(a.current, "necessary");
  a.skip =
    necessary === "self" ||
    necessary === "all" ||
    !Object.prototype.hasOwnProperty.call(state.statFunc, a.name!);
  return { state, route: "whole" };
}
export function checkFunctionMetadata(input: OperationState): {
  state: OperationState;
  route: string;
} {
  const state = forkOperation(input),
    a = state.pendingAction!;
  // 删除 meta 的路径规则已经由同一删除栈处理；旧实现不再检验该定义的保护形状。
  const diagnostic =
    a.kind === "function-delete"
      ? null
      : definitionDiagnostic(a.value, a.name!);
  if (diagnostic) {
    a.diagnostic = diagnostic;
    return { state, route: "invalid" };
  }
  return { state, route: a.skip ? "skip" : "apply" };
}
export function stageFunctionChange(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!,
    old = state.functionGroup!;
  const group = {
    ...old,
    candidate: cloneCrudValue(old.candidate),
    changes: [...old.changes],
  };
  if (a.changeKind === "delete") delete group.candidate[a.name!];
  else defineOwn(group.candidate, a.name!, cloneCrudValue(a.value));
  group.changes.push({
    kind: a.changeKind!,
    name: a.name!,
    ...(a.changeKind === "delete" ? {} : { value: a.value }),
  });
  state.functionGroup = group;
  return state;
}
export function beginFunctionMetaDelete(input: OperationState): OperationState {
  const state = forkOperation(input),
    a = state.pendingAction!;
  if (!Object.prototype.hasOwnProperty.call(state.statFunc, a.name!)) {
    a.skip = true;
  }
  state.context.localDelete = {
    stat: cloneCrudValue(a.current),
    parentAction: { ...a },
  };
  state.stack.push({ kind: "function-meta-complete", path: "", patch: null });
  if (!a.skip)
    state.stack.push({
      kind: "delete",
      path: "",
      patch: { $meta: a.patch.$meta },
      root: true,
    });
  return state;
}
export function finishFunctionMetaDelete(
  input: OperationState,
): OperationState {
  const state = forkOperation(input),
    local = state.context.localDelete!;
  state.pendingAction = {
    ...local.parentAction,
    value: local.stat,
    changeKind: "update",
  };
  delete state.context.localDelete;
  return state;
}
export function applyFunctionCandidate(input: OperationState): OperationState {
  const state = forkOperation(input),
    group = state.functionGroup!;
  const logs = group.changes.map((change) =>
    change.kind === "insert"
      ? {
          op: "insert" as const,
          name: change.name,
          value_new: cloneCrudValue(change.value),
        }
      : change.kind === "delete"
        ? {
            op: "delete" as const,
            name: change.name,
            value_old: cloneCrudValue(group.original[change.name]),
          }
        : {
            op: "update" as const,
            name: change.name,
            value_old: cloneCrudValue(group.original[change.name]),
            value_new: cloneCrudValue(change.value),
          },
  );
  state.statFunc = group.candidate;
  state.functionEditLog.push(...logs);
  state.functionGroup = null;
  return state;
}
export function discardFunctionCandidate(
  input: OperationState,
): OperationState {
  const state = forkOperation(input);
  if (state.pendingAction?.diagnostic)
    state.diagnostics.push(state.pendingAction.diagnostic);
  state.functionGroup = null;
  state.stack = [];
  delete state.context.localDelete;
  return state;
}
