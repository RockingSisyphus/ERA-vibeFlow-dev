/** Pure path mutation and relative-edit rules. */
import {
  isPlainRecord,
  defineOwn,
  cloneCrudValue,
  mergeReplaceArray,
  type EraCrudDiagnosticCode,
  type EraCrudDiagnostic,
  type TemplateContext,
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

export function hasAtPath(target: unknown, path: string): boolean {
  if (!canTraverse(target)) return false;
  let cursor: unknown = target;
  for (const segment of pathSegments(path)) {
    if (!canTraverse(cursor)) return false;
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) return false;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return true;
}

export function setAtPath(target: unknown, path: string, value: unknown): void {
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

export function resolveTemplate(context: TemplateContext): unknown {
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

export function inheritedTemplateContent(
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

export function applyTemplate(template: unknown, patch: unknown): unknown {
  if (!isPlainRecord(patch)) return patch;
  if (!template) return patch;
  if (Object.keys(patch).length === 0) return cloneCrudValue(template);
  return mergeReplaceArray(template, patch);
}

export function publicEditPath(path: string): string {
  return path
    .replace(/__DOT__/g, ".")
    .replace(/__DQUOTE__/g, '"')
    .replace(/__SQUOTE__/g, "'");
}

export function editDiagnostic(
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

export function functionDiagnostic(
  code: string,
  name: string,
  message: string,
): any {
  return {
    code,
    path: name,
    message: `${message}（函数 ${name || "(empty)"}）`,
  };
}
