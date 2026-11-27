export type EraCrudCommandType =
  | "insert"
  | "edit"
  | "delete"
  | "function-insert"
  | "function-edit"
  | "function-delete";

export interface EraCrudCommand {
  readonly type: EraCrudCommandType;
  readonly data: readonly unknown[];
}

export type EraCrudDiagnosticCode = string;

export interface EraCrudDiagnostic {
  readonly code: EraCrudDiagnosticCode;
  readonly message: string;
  readonly path: string;
}

function tokenize(source: string): string[] {
  const punctuation: Readonly<Record<string, string>> = {
    "：": ":", "，": ",", "［": "[", "］": "]", "｛": "{", "｝": "}",
  };
  const token = /\s+|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[{}\[\]:,：，［］｛｝]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*/uy;
  const parts: string[] = [];
  while (token.lastIndex < source.length) {
    const match = token.exec(source);
    if (!match) throw new SyntaxError("指令中有无法识别的 JSON 文本。");
    const value = match[0];
    if (/^\s/u.test(value) || /^\/[/\*]|^<!--/u.test(value)) continue;
    parts.push(Object.hasOwn(punctuation, value) ? punctuation[value] : value);
  }
  return parts;
}

function normalize(parts: readonly string[]): string {
  return parts.flatMap((part, index) => {
    const next = parts[index + 1];
    const previous = parts[index - 1];
    if (part === "," && (next === "]" || next === "}") &&
        previous !== "[" && previous !== "{" && previous !== ",") return [];
    if (part.startsWith("'")) {
      const inside = part.slice(1, -1).replace(/\\[\s\S]|"/gu, item => {
        if (item === "\\'") return "'";
        return item === '"' ? '\\"' : item;
      });
      return [`"${inside}"`];
    }
    return [next === ":" && /^[$_\p{ID_Start}]/u.test(part) ? JSON.stringify(part) : part];
  }).join(" ");
}

/** 保留完整 JSON 优先级和串联对象输入。每个容错片段都由标准 JSON 解析器校验。 */
function parsePayload(text: string): unknown[] {
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value : [value];
  } catch {
    const parts = tokenize(text);
    try {
      const value: unknown = JSON.parse(normalize(parts));
      return Array.isArray(value) ? value : [value];
    } catch {
      const values: unknown[] = [];
      let depth = 0, start = 0;
      for (const [index, part] of parts.entries()) {
        if (depth === 0) {
          if (part !== "{") throw new SyntaxError("指令需要完整的 JSON 对象。");
          start = index;
        }
        if (part === "{" || part === "[") depth += 1;
        if (part === "}" || part === "]") depth -= 1;
        if (depth === 0) values.push(JSON.parse(normalize(parts.slice(start, index + 1))));
      }
      if (depth !== 0 || values.length === 0) throw new SyntaxError("指令 JSON 未闭合或为空。");
      return values;
    }
  }
}

function hasFiniteNumbers(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  return value === null || typeof value !== "object" || Object.values(value).every(hasFiniteNumbers);
}

function readObjectLine(line: string): unknown[] {
  if (!/^[{｛].*[}｝]$/u.test(line)) return [];
  try {
    return parsePayload(line).filter(hasFiniteNumbers);
  } catch {
    return [];
  }
}

export function parseEraCommandPayload(source: string): { values: unknown[]; skipped: boolean } {
  const text = source.trim()
    .replace(/^(?:```|~~~)[a-zA-Z0-9_-]*[^\S\r\n]*\r?\n/u, "")
    .replace(/\r?\n(?:```|~~~)[^\S\r\n]*$/u, "");
  try {
    const values = parsePayload(text);
    if (!values.every(hasFiniteNumbers)) throw new SyntaxError("变量 JSON 只能包含有限数值。");
    return { values, skipped: false };
  } catch (error) {
    // Recover only when separate complete object lines frame the input.
    const lines = text.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
    if (lines.length < 3 || !readObjectLine(lines[0]!).length || !readObjectLine(lines.at(-1)!).length)
      throw error;
    return { values: lines.flatMap(readObjectLine), skipped: true };
  }
}

export function commandTagPattern(): RegExp {
  return /<((?:Variable|Function)(?:Insert|Edit|Delete))>\s*((?:(?!<(?:era_data|Variable(?:Think|Insert|Edit|Delete)|Function(?:Insert|Edit|Delete))>|<\/\1>)[\s\S])*?)\s*<\/\1>/giu;
}

/** 同一套解析提供可执行指令与原文范围。需要繁简转换时，只处理标签正文。 */
export function readCommandBlocks(
  content: string,
  normalizeBody?: (body: string) => string,
): (EraCrudCommand & { start: number; end: number })[] {
  const result: (EraCrudCommand & { start: number; end: number })[] = [];
  const kinds: Readonly<Record<string, EraCrudCommandType>> = {
    variableinsert: "insert", variableedit: "edit", variabledelete: "delete",
    functioninsert: "function-insert", functionedit: "function-edit", functiondelete: "function-delete",
  };
  for (const match of content.matchAll(commandTagPattern())) {
    const body = match[2] ?? "";
    const type = kinds[(match[1] ?? "").toLowerCase()];
    if (!type || !body.trim()) continue;
    try {
      const { values } = parseEraCommandPayload(normalizeBody ? normalizeBody(body) : body);
      if (values.length) result.push({ type, data: values, start: match.index, end: match.index + match[0].length });
    } catch {
      // 无效指令块没有可执行的数据；继续检查其余块。
    }
  }
  return result;
}
