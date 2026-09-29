/** Function library mutation and ordered message command application. */
import { executeExpressionLayer } from "@era/vibeflow-expression/engine";
import {
  isPlainRecord, defineOwn, cloneCrudValue, mergeReplaceArray,
  parseMessageCommands,
  type EraCrudEditLog, type EraFunctionEditLog, type EraCrudResult,
  type EraCrudDiagnostic, type EraApplyMessageCommandsInput,
  type EraApplyMessageCommandsResult,
} from "./crud_parser.ts";
import {
  getAtPath, unsetAtPath, isEmptyRecord, metaValue,
  applyInsert, applyEditWithDiagnostics,
} from "./crud_mutations.ts";
export * from "./crud_parser.ts";
export * from "./crud_mutations.ts";

function deleteBypass(patch: unknown): boolean {
  if (!isPlainRecord(patch)) return false;
  const metaPatch = patch.$meta;
  if (isEmptyRecord(metaPatch)) return true;
  return (
    isPlainRecord(metaPatch) &&
    Object.prototype.hasOwnProperty.call(metaPatch, "necessary")
  );
}

function applyDeleteAtLevel(
  stat: unknown,
  basePath: string,
  patch: unknown,
  logs: EraCrudEditLog[],
): void {
  const current = basePath ? getAtPath(stat, basePath) : stat;
  if (typeof current === "undefined") return;
  const necessary = metaValue(current, "necessary");
  const bypass = deleteBypass(patch);

  if (isPlainRecord(patch) && Object.keys(patch).length > 0) {
    if (necessary === "all" && !bypass) return;
    for (const key of Object.keys(patch)) {
      const subPatch = patch[key];
      if (
        necessary === "children" &&
        isEmptyRecord(subPatch) &&
        !(key === "$meta" && bypass)
      ) {
        continue;
      }
      const path = basePath ? `${basePath}.${key}` : key;
      applyDeleteAtLevel(stat, path, subPatch, logs);
    }
    return;
  }

  if (necessary === "self" || necessary === "all" || basePath === "") return;
  const valueOld = cloneCrudValue(current);
  unsetAtPath(stat, basePath);
  logs.push({ op: "delete", path: basePath, value_old: valueOld });
}

/** 按 necessary 保护规则递归删除，并为每个原子删除生成日志。 */
export function applyDelete(
  deletes: readonly unknown[],
  initialStat: unknown,
): EraCrudResult {
  const finalStat = cloneCrudValue(initialStat);
  const editLog: EraCrudEditLog[] = [];
  for (const root of deletes ?? []) {
    if (!isPlainRecord(root) || Object.keys(root).length === 0) continue;
    try {
      applyDeleteAtLevel(finalStat, "", root, editLog);
    } catch {
      // 单根失败保持候选容错语义。
    }
  }
  return { finalStat, editLog };
}

type FunctionMutationKind =
  "function-insert" | "function-edit" | "function-delete";

function functionDiagnostic(
  code: string,
  name: string,
  message: string,
): EraCrudDiagnostic {
  return {
    code,
    path: name,
    message: `${message}（函数 ${name || "(empty)"}）`,
  };
}

/**
 * Expression root owns grammar, purity and the complete function call graph.  The Service
 * only asks it whether a candidate immutable library is admissible before committing it.
 */
function validateFunctionLibrary(
  candidate: Readonly<Record<string, unknown>>,
): EraCrudDiagnostic | null {
  const checked = executeExpressionLayer({
    initialState: {},
    functionLibrary: candidate,
    operations: [],
  });
  const first = checked.diagnostics[0];
  return first
    ? functionDiagnostic(first.code, "<library>", first.message)
    : null;
}

function isEmptyFunctionDelete(value: unknown): boolean {
  return isPlainRecord(value) && Object.keys(value).length === 0;
}

function functionMetadata(value: unknown): Record<string, unknown> | null {
  return isPlainRecord(value) && isPlainRecord(value.$meta)
    ? value.$meta
    : null;
}

function functionMetaDiagnosticForDefinition(
  value: unknown,
  name: string,
): EraCrudDiagnostic | null {
  const meta = functionMetadata(value);
  if (meta === null) return null;
  if (Object.prototype.hasOwnProperty.call(meta, "unInsertAble")) {
    return functionDiagnostic(
      "ERA_FUNCTION_META_UNSUPPORTED",
      name,
      "函数是平面实体，不支持 $meta.unInsertAble。",
    );
  }
  if (meta.necessary === "children") {
    return functionDiagnostic(
      "ERA_FUNCTION_META_UNSUPPORTED",
      name,
      "函数是平面实体，不支持 $meta.necessary: children。",
    );
  }
  return null;
}

function isFunctionMetadataOnlyPatch(
  value: unknown,
): value is Record<string, unknown> {
  return (
    isPlainRecord(value) &&
    Object.keys(value).length === 1 &&
    Object.prototype.hasOwnProperty.call(value, "$meta") &&
    isPlainRecord(value.$meta)
  );
}

function functionEditBypassesProtection(
  current: unknown,
  patch: unknown,
): boolean {
  return (
    metaValue(current, "updatable") === false &&
    isPlainRecord(patch) &&
    isPlainRecord(patch.$meta) &&
    patch.$meta.updatable === true
  );
}

function editFunctionDefinition(current: unknown, patch: unknown): unknown {
  if (!isPlainRecord(current) || !isPlainRecord(patch))
    return cloneCrudValue(patch);
  const patchMeta = functionMetadata(patch);
  if (isFunctionMetadataOnlyPatch(patch) && patchMeta !== null) {
    if (Object.keys(patchMeta).length === 0) return cloneCrudValue(current);
    const next = cloneCrudValue(current) as Record<string, unknown>;
    const nextMeta = mergeReplaceArray(current.$meta, patchMeta);
    defineOwn(next, "$meta", nextMeta);
    return next;
  }

  const next = cloneCrudValue(patch) as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(patch, "$meta")) {
    if (Object.prototype.hasOwnProperty.call(current, "$meta")) {
      defineOwn(next, "$meta", cloneCrudValue(current.$meta));
    }
    return next;
  }
  if (patchMeta !== null) {
    defineOwn(next, "$meta", mergeReplaceArray(current.$meta, patchMeta));
  }
  return next;
}

function deleteFunctionMetadata(
  current: unknown,
  patch: Record<string, unknown>,
): unknown {
  const result = applyDelete([{ $meta: patch.$meta }], current);
  return result.finalStat;
}

function applyFunctionCommands(
  data: readonly unknown[],
  initialLibrary: Readonly<Record<string, unknown>>,
  type: FunctionMutationKind,
): {
  readonly library: Readonly<Record<string, unknown>>;
  readonly log: readonly EraFunctionEditLog[];
  readonly diagnostics: readonly EraCrudDiagnostic[];
} {
  let library = cloneCrudValue(initialLibrary) as Record<string, unknown>;
  const log: EraFunctionEditLog[] = [];
  const diagnostics: EraCrudDiagnostic[] = [];
  for (const root of data) {
    if (!isPlainRecord(root) || Object.keys(root).length === 0) {
      diagnostics.push(
        functionDiagnostic(
          "ERA_FUNCTION_COMMAND_INVALID",
          "",
          "函数指令必须是非空对象。",
        ),
      );
      continue;
    }
    const names = Object.keys(root);
    const invalidName = names.find((name) => {
      const exists = Object.prototype.hasOwnProperty.call(library, name);
      return (
        (type === "function-insert" && exists) ||
        (type === "function-edit" && !exists) ||
        (type === "function-delete" &&
          !isEmptyFunctionDelete(root[name]) &&
          !isFunctionMetadataOnlyPatch(root[name]))
      );
    });
    if (invalidName !== undefined) {
      const exists = Object.prototype.hasOwnProperty.call(library, invalidName);
      const code =
        type === "function-delete"
          ? "ERA_FUNCTION_DELETE_INVALID"
          : type === "function-insert" && exists
            ? "ERA_FUNCTION_ALREADY_EXISTS"
            : "ERA_FUNCTION_NOT_FOUND";
      const message =
        code === "ERA_FUNCTION_DELETE_INVALID"
          ? "FunctionDelete 的函数值必须是空对象。"
          : code === "ERA_FUNCTION_ALREADY_EXISTS"
            ? "FunctionInsert 只能新增不存在的函数。"
            : "FunctionEdit 只能修改既有函数。";
      diagnostics.push(functionDiagnostic(code, invalidName, message));
      continue;
    }

    // A tag is one transaction: compile the complete candidate at once, so forward
    // declarations and mutually non-recursive nested definitions are valid.
    const candidate = cloneCrudValue(library) as Record<string, unknown>;
    const changes: Array<{
      readonly kind: "insert" | "update" | "delete";
      readonly name: string;
      readonly value?: unknown;
    }> = [];
    let metadataDiagnostic: EraCrudDiagnostic | null = null;
    for (const name of names) {
      const current = library[name];
      const patch = root[name];
      if (type === "function-insert") {
        const diagnostic = functionMetaDiagnosticForDefinition(patch, name);
        if (diagnostic !== null) {
          metadataDiagnostic = diagnostic;
          break;
        }
        const next = cloneCrudValue(patch);
        defineOwn(candidate, name, next);
        changes.push({ kind: "insert", name, value: next });
        continue;
      }
      if (type === "function-edit") {
        const proposed = editFunctionDefinition(current, patch);
        const diagnostic = functionMetaDiagnosticForDefinition(proposed, name);
        if (diagnostic !== null) {
          metadataDiagnostic = diagnostic;
          break;
        }
        const locked = metaValue(current, "updatable") === false;
        if (locked && !functionEditBypassesProtection(current, patch)) continue;
        defineOwn(candidate, name, proposed);
        changes.push({ kind: "update", name, value: proposed });
        continue;
      }

      if (isEmptyFunctionDelete(patch)) {
        const necessary = metaValue(current, "necessary");
        if (necessary === "self" || necessary === "all") continue;
        if (Object.prototype.hasOwnProperty.call(library, name)) {
          delete candidate[name];
          changes.push({ kind: "delete", name });
        }
        continue;
      }

      if (!Object.prototype.hasOwnProperty.call(library, name)) continue;
      const proposed = deleteFunctionMetadata(
        current,
        patch as Record<string, unknown>,
      );
      defineOwn(candidate, name, proposed);
      changes.push({ kind: "update", name, value: proposed });
    }
    if (metadataDiagnostic !== null) {
      diagnostics.push(metadataDiagnostic);
      continue;
    }
    const invalid = validateFunctionLibrary(candidate);
    if (invalid !== null) {
      diagnostics.push(invalid);
      continue;
    }
    for (const change of changes) {
      if (change.kind === "delete") {
        const valueOld = cloneCrudValue(library[change.name]);
        delete library[change.name];
        log.push({ op: "delete", name: change.name, value_old: valueOld });
      } else if (change.kind === "insert") {
        defineOwn(library, change.name, cloneCrudValue(change.value));
        log.push({
          op: "insert",
          name: change.name,
          value_new: cloneCrudValue(change.value),
        });
      } else {
        const valueOld = cloneCrudValue(library[change.name]);
        defineOwn(library, change.name, cloneCrudValue(change.value));
        log.push({
          op: "update",
          name: change.name,
          value_old: valueOld,
          value_new: cloneCrudValue(change.value),
        });
      }
    }
  }
  return { library, log, diagnostics };
}

/** 解析并严格按消息内出现顺序执行 Variable 和 Function 六类指令。 */
export function applyMessageCommands(
  input: EraApplyMessageCommandsInput,
): EraApplyMessageCommandsResult {
  const initial = cloneCrudValue(input.initialStat);
  const layerStartStatFunc = cloneCrudValue(
    input.initialStatFunc ?? {},
  ) as Record<string, unknown>;
  // `@f()` 的快照闭包：显式给了消息起点函数库就用它。
  const snapshotStatFunc = cloneCrudValue(
    input.messageStartStatFunc ?? input.initialStatFunc ?? {},
  ) as Record<string, unknown>;
  const seededDrawOffset =
    Number.isSafeInteger(input.randomDrawOffset) &&
    Number(input.randomDrawOffset) > 0
      ? Number(input.randomDrawOffset)
      : 0;
  const randomCursor =
    typeof input.randomSourceKey === "string" &&
    input.randomSourceKey.length > 0
      ? { sourceKey: input.randomSourceKey, drawOffset: seededDrawOffset }
      : undefined;
  try {
    const allCommands = parseMessageCommands({
      content: input.content,
      traditionalToSimplified: input.traditionalToSimplified,
    });
    const commands =
      input.commandRange === undefined
        ? allCommands
        : allCommands.slice(
            Math.max(0, input.commandRange.fromIndex),
            Math.max(0, input.commandRange.toIndex),
          );
    let current = initial;
    let currentStatFunc = cloneCrudValue(layerStartStatFunc) as Record<
      string,
      unknown
    >;
    const accumulated: EraCrudEditLog[] = [];
    const functionEditLog: EraFunctionEditLog[] = [];
    const diagnostics: EraCrudDiagnostic[] = [];
    for (const command of commands) {
      let result: EraCrudResult;
      if (command.type === "insert") {
        result = applyInsert(command.data, current);
      } else if (command.type === "edit") {
        const editResult = applyEditWithDiagnostics(command.data, current, {
          messageId: input.messageId,
          meta: input.meta,
          layerStartStat: input.messageStartStat ?? initial,
          statFunc: currentStatFunc,
          layerStartStatFunc: snapshotStatFunc,
          randomCursor,
        });
        diagnostics.push(...editResult.diagnostics);
        result = editResult;
      } else if (command.type === "delete") {
        result = applyDelete(command.data, current);
      } else {
        const functionResult = applyFunctionCommands(
          command.data,
          currentStatFunc,
          command.type,
        );
        currentStatFunc = cloneCrudValue(functionResult.library) as Record<
          string,
          unknown
        >;
        functionEditLog.push(...functionResult.log);
        diagnostics.push(...functionResult.diagnostics);
        result = { finalStat: current, editLog: [] };
      }
      current = result.finalStat;
      accumulated.push(...result.editLog);
    }
    const exposesFunctionState =
      Object.keys(layerStartStatFunc).length > 0 ||
      commands.some((command) => command.type.startsWith("function-"));
    return {
      finalStat: current,
      editLog: accumulated,
      ...(exposesFunctionState
        ? { finalStatFunc: currentStatFunc, functionEditLog }
        : {}),
      commands,
      diagnostics,
      ...(randomCursor === undefined
        ? {}
        : {
            randomDrawsConsumed: randomCursor.drawOffset,
            nextRandomDrawOffset: randomCursor.drawOffset,
          }),
    };
  } catch {
    const exposesFunctionState = Object.keys(layerStartStatFunc).length > 0;
    return {
      finalStat: initial,
      editLog: [],
      ...(exposesFunctionState
        ? { finalStatFunc: layerStartStatFunc, functionEditLog: [] }
        : {}),
      commands: [],
      diagnostics: [],
      ...(randomCursor === undefined
        ? {}
        : {
            randomDrawsConsumed: randomCursor.drawOffset,
            nextRandomDrawOffset: randomCursor.drawOffset,
          }),
    };
  }
}
