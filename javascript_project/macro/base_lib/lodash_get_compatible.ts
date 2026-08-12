/*
 * 路径词法规则与 Lodash get 兼容。Lodash 以 MIT 许可发布：
 * Copyright OpenJS Foundation and other contributors.
 *
 * 此处只保留 JSON 字符串路径所需的纯函数子集，不引入 Lodash 的 CommonJS
 * 运行时探测、动态代码或全局缓存。
 */

function isDirectKey(path: string, object: unknown): boolean {
  const deepPath = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/;
  const plainPath = /^\w*$/;
  const canContainProperty =
    (typeof object === "object" && object !== null) ||
    typeof object === "function";

  return (
    plainPath.test(path) ||
    !deepPath.test(path) ||
    (canContainProperty && path in object)
  );
}

function stringToPath(path: string): string[] {
  const result: string[] = [];
  const propertyName =
    /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
  const escapeCharacter = /\\(\\)?/g;

  if (path.charCodeAt(0) === 46) {
    result.push("");
  }

  path.replace(
    propertyName,
    (
      match: string,
      number: string | undefined,
      quote: string | undefined,
      substring: string | undefined,
    ) => {
      result.push(
        quote
          ? (substring ?? "").replace(escapeCharacter, "$1")
          : (number ?? match),
      );
      return match;
    },
  );

  return result;
}

function castPath(path: string, object: unknown): readonly string[] {
  return isDirectKey(path, object) ? [path] : stringToPath(path);
}

export function lodashCompatibleGet(
  object: unknown,
  path: string,
): unknown {
  const segments = castPath(path, object);
  let current = object;
  let index = 0;

  while (current !== null && current !== undefined && index < segments.length) {
    const key = segments[index] ?? "";
    current = (current as Record<string, unknown>)[key];
    index += 1;
  }

  return index > 0 && index === segments.length ? current : undefined;
}
