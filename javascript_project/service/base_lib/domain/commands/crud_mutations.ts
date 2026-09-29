/** Pure path mutation and relative-edit rules. */
import { executeExpressionLayer } from "@era/vibeflow-expression/engine";
import { findLatestNewValue } from "../snapshot_history.ts";
import {
  isPlainRecord, defineOwn, cloneCrudValue, sanitizeArrays, mergeReplaceArray,
  type EraCrudEditLog, type EraCrudResult, type EraCrudDiagnosticCode,
  type EraCrudDiagnostic, type EraEditContext, type TemplateContext,
} from "./crud_parser.ts";

function pathSegments(path: string): string[] {
  const result: string[] = [];
  if (path.charCodeAt(0) === 46) result.push("");
  path.replace(
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

export function getAtPath(target: unknown, path: string): unknown {
  if (!canTraverse(target)) return undefined;
  let cursor: unknown = target;
  for (const segment of pathSegments(path)) {
    if (!canTraverse(cursor)) return undefined;
    cursor = readOwn(cursor, segment);
  }
  return cursor;
}

function hasAtPath(target: unknown, path: string): boolean {
  if (!canTraverse(target)) return false;
  let cursor: unknown = target;
  for (const segment of pathSegments(path)) {
    if (!canTraverse(cursor)) return false;
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) return false;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return true;
}

function setAtPath(target: unknown, path: string, value: unknown): void {
  if (!canTraverse(target)) return;
  const segments = pathSegments(path);
  if (segments.length === 0) return;
  let cursor: Record<string, unknown> | unknown[] = target;
  for (let index = 0; index < segments.length; index += 1) {
    const key = segments[index];
    if (index === segments.length - 1) {
      defineOwn(cursor, key, cloneCrudValue(value));
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

export function unsetAtPath(target: unknown, path: string): void {
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

export function isEmptyRecord(value: unknown): boolean {
  return isPlainRecord(value) && Object.keys(value).length === 0;
}

export function metaValue(node: unknown, key: string): unknown {
  if (!isPlainRecord(node)) return undefined;
  const meta = node.$meta;
  return isPlainRecord(meta) ? meta[key] : undefined;
}

function resolveTemplate(context: TemplateContext): unknown {
  const variablesContent = isPlainRecord(context.parentData)
    ? context.parentData.$template
    : undefined;
  let merged: unknown = {};
  merged = mergeReplaceArray(merged, context.inheritedContent);
  merged = mergeReplaceArray(merged, variablesContent);
  return isPlainRecord(merged) && Object.keys(merged).length > 0
    ? merged
    : null;
}

function inheritedTemplateContent(
  parentTemplate: unknown,
  key: string,
): unknown {
  if (!isPlainRecord(parentTemplate)) return undefined;
  const prototypeContent = parentTemplate.$template;
  const specificContent = parentTemplate[key];
  if (isPlainRecord(prototypeContent) && isPlainRecord(specificContent)) {
    return mergeReplaceArray(prototypeContent, specificContent);
  }
  if (isPlainRecord(specificContent)) return specificContent;
  if (isPlainRecord(prototypeContent)) return prototypeContent;
  return undefined;
}

function applyTemplate(template: unknown, patch: unknown): unknown {
  if (!isPlainRecord(patch)) return patch;
  if (!template) return patch;
  if (Object.keys(patch).length === 0) return cloneCrudValue(template);
  return mergeReplaceArray(template, patch);
}

function applyInsertAtLevel(
  stat: unknown,
  basePath: string,
  patch: unknown,
  logs: EraCrudEditLog[],
  context: TemplateContext,
): void {
  const localTemplate = resolveTemplate(context);
  const current = basePath ? getAtPath(stat, basePath) : stat;
  const protection = metaValue(current, "unInsertAble");

  if (basePath && typeof current === "undefined") {
    const finalValue = sanitizeArrays(applyTemplate(localTemplate, patch));
    setAtPath(stat, basePath, finalValue);
    logs.push({
      op: "insert",
      path: basePath,
      value_new: cloneCrudValue(finalValue),
    });
    return;
  }

  if (isPlainRecord(current) && isPlainRecord(patch)) {
    const keys = Object.keys(patch);
    const metaOnly = keys.every((key) => key === "$meta");
    if (protection === "all" && keys.length > 0 && !metaOnly) return;
    for (const key of keys) {
      if (
        protection === "self" &&
        key !== "$meta" &&
        !Object.prototype.hasOwnProperty.call(current, key)
      ) {
        continue;
      }
      const subPath = basePath ? `${basePath}.${key}` : key;
      applyInsertAtLevel(stat, subPath, patch[key], logs, {
        inheritedContent: inheritedTemplateContent(localTemplate, key),
        parentData: current,
      });
    }
  }
}

/** 对有序 VariableInsert 根对象应用非破坏性插入与模板规则。 */
export function applyInsert(
  inserts: readonly unknown[],
  initialStat: unknown,
): EraCrudResult {
  const finalStat = cloneCrudValue(initialStat);
  const editLog: EraCrudEditLog[] = [];
  for (const root of inserts ?? []) {
    if (!isPlainRecord(root) || Object.keys(root).length === 0) continue;
    try {
      applyInsertAtLevel(finalStat, "", root, editLog, {
        inheritedContent: null,
        parentData: null,
      });
    } catch {
      // 与候选实现一致：单个根失败不会阻止后续根继续处理。
    }
  }
  return { finalStat, editLog };
}

function selectedMks(
  meta: Readonly<Record<string, unknown>>,
): (string | null)[] {
  return Array.isArray(meta.SelectedMks)
    ? (cloneCrudValue(meta.SelectedMks) as (string | null)[])
    : [];
}

function editLogs(
  meta: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return isPlainRecord(meta.EditLogs) ? meta.EditLogs : {};
}

type RelativeEditResolution =
  | { readonly kind: "not-operator" }
  | { readonly kind: "resolved"; readonly value: number }
  | { readonly kind: "invalid"; readonly diagnostic: EraCrudDiagnostic };

function publicEditPath(path: string): string {
  return path
    .replace(/__DOT__/g, ".")
    .replace(/__DQUOTE__/g, '"')
    .replace(/__SQUOTE__/g, "'");
}

function editDiagnostic(
  code: EraCrudDiagnosticCode,
  path: string,
  message: string,
): EraCrudDiagnostic {
  const publicPath = publicEditPath(path);
  return {
    code,
    path: publicPath,
    message: `${message}（路径 ${publicPath || "(root)"}）`,
  };
}

/**
 * 识别 VariableEdit 叶子上的唯一 `$expr` 数值表达式。
 *
 * 旧 `$inc/$mul/$div` 及任何未知 `$` 控制键一律 fail-closed；普通对象和普通 JSON
 * 直接赋值仍返回 not-operator。表达式的解析、函数图和数值计算委托给独立 root。
 */
export function resolveRelativeEdit(
  patch: unknown,
  current: unknown,
  path: string,
  stat: unknown = {},
  context: EraEditContext = { messageId: 0, meta: {} },
): RelativeEditResolution {
  if (!isPlainRecord(patch)) return { kind: "not-operator" };
  const keys = Object.keys(patch);
  const controlKeys = keys.filter(
    (key) => key.startsWith("$") && key !== "$meta",
  );
  if (controlKeys.length === 0) return { kind: "not-operator" };

  const operator = controlKeys[0];
  if (keys.length !== 1 || controlKeys.length !== 1 || operator !== "$expr") {
    return {
      kind: "invalid",
      diagnostic: editDiagnostic(
        "ERA_EDIT_OPERATOR_INVALID",
        path,
        "数值表达式必须是只含 $expr 的单键对象；$inc、$mul、$div、$sub 和 $set 已不支持。",
      ),
    };
  }

  const operand = patch[operator];
  if (typeof operand !== "string" || operand.trim().length === 0) {
    return {
      kind: "invalid",
      diagnostic: editDiagnostic(
        "ERA_EDIT_OPERATOR_INVALID",
        path,
        "$expr 的值必须是非空表达式字符串。",
      ),
    };
  }
  if (typeof current !== "number" || !Number.isFinite(current)) {
    return {
      kind: "invalid",
      diagnostic: editDiagnostic(
        "ERA_EDIT_TARGET_NOT_NUMERIC",
        path,
        "相对数值更新的目标当前值必须是有限数字。",
      ),
    };
  }
  if (!isPlainRecord(stat)) {
    return {
      kind: "invalid",
      diagnostic: editDiagnostic(
        "ERA_EDIT_OPERATOR_INVALID",
        path,
        "$expr 只能在对象变量状态上求值。",
      ),
    };
  }
  const response = executeExpressionLayer({
    initialState: cloneCrudValue(stat),
    snapshotState: cloneCrudValue(context.layerStartStat ?? stat),
    functionLibrary: context.statFunc ?? {},
    snapshotFunctionLibrary:
      context.layerStartStatFunc ?? context.statFunc ?? {},
    allowSnapshots: true,
    ...(context.randomCursor === undefined
      ? {}
      : {
          randomContext: {
            sourceKey: context.randomCursor.sourceKey,
            drawOffset: context.randomCursor.drawOffset,
          },
        }),
    operations: [{ path: publicEditPath(path), expr: operand }],
  });
  if (context.randomCursor !== undefined) {
    context.randomCursor.drawOffset = response.nextDrawOffset;
  }
  const result = getAtPath(response.finalState, publicEditPath(path));
  if (
    response.diagnostics.length > 0 ||
    typeof result !== "number" ||
    !Number.isFinite(result)
  ) {
    const detail = response.diagnostics[0];
    return {
      kind: "invalid",
      diagnostic: editDiagnostic(
        detail?.code ?? "ERA_EDIT_RESULT_NON_FINITE",
        path,
        detail?.message ?? "$expr 未得到有限数值结果。",
      ),
    };
  }
  return { kind: "resolved", value: Object.is(result, -0) ? 0 : result };
}

function applyEditAtLevel(
  stat: unknown,
  basePath: string,
  patch: unknown,
  logs: EraCrudEditLog[],
  context: EraEditContext,
  orderedMks: readonly (string | null)[],
  historicalLogs: Readonly<Record<string, unknown>>,
  diagnostics: EraCrudDiagnostic[],
): void {
  const current = basePath ? getAtPath(stat, basePath) : stat;
  if (typeof current === "undefined") return;
  const updatable = metaValue(current, "updatable") ?? true;
  const bypass =
    updatable === false &&
    isPlainRecord(patch) &&
    isPlainRecord(patch.$meta) &&
    patch.$meta.updatable === true;
  if (updatable === false && !bypass) return;

  const relative = resolveRelativeEdit(patch, current, basePath, stat, context);
  if (relative.kind === "invalid") {
    diagnostics.push(relative.diagnostic);
    return;
  }
  if (relative.kind === "resolved") {
    if (!basePath || !hasAtPath(stat, basePath)) return;
    setAtPath(stat, basePath, relative.value);
    logs.push({
      op: "update",
      path: basePath,
      value_old: cloneCrudValue(current),
      value_new: relative.value,
    });
    return;
  }
  if (!isPlainRecord(patch)) return;

  for (const key of Object.keys(patch)) {
    const subPath = basePath ? `${basePath}.${key}` : key;
    const valueNew = patch[key];
    if (isPlainRecord(valueNew)) {
      applyEditAtLevel(
        stat,
        subPath,
        valueNew,
        logs,
        context,
        orderedMks,
        historicalLogs,
        diagnostics,
      );
      continue;
    }
    if (!hasAtPath(stat, subPath)) continue;
    let valueOld = findLatestNewValue(
      subPath,
      context.messageId,
      orderedMks,
      historicalLogs,
    );
    if (valueOld === null) valueOld = getAtPath(stat, subPath);
    const cleaned = sanitizeArrays(valueNew);
    setAtPath(stat, subPath, cleaned);
    logs.push({
      op: "update",
      path: subPath,
      value_old: cloneCrudValue(valueOld),
      value_new: cloneCrudValue(cleaned),
    });
  }
}

/** 只更新已存在路径，并生成包含历史旧值的 update 日志。 */
export function applyEdit(
  edits: readonly unknown[],
  initialStat: unknown,
  context: EraEditContext,
): EraCrudResult {
  const result = applyEditWithDiagnostics(edits, initialStat, context);
  return { finalStat: result.finalStat, editLog: result.editLog };
}

export function applyEditWithDiagnostics(
  edits: readonly unknown[],
  initialStat: unknown,
  context: EraEditContext,
): EraCrudResult & { readonly diagnostics: readonly EraCrudDiagnostic[] } {
  const finalStat = cloneCrudValue(initialStat);
  const editLog: EraCrudEditLog[] = [];
  const diagnostics: EraCrudDiagnostic[] = [];
  const orderedMks = selectedMks(context.meta);
  const historicalLogs = editLogs(context.meta);
  for (const root of edits ?? []) {
    if (!isPlainRecord(root) || Object.keys(root).length === 0) continue;
    try {
      applyEditAtLevel(
        finalStat,
        "",
        root,
        editLog,
        context,
        orderedMks,
        historicalLogs,
        diagnostics,
      );
    } catch {
      // 单根失败保持容错并继续。
    }
  }
  return { finalStat, editLog, diagnostics };
}
