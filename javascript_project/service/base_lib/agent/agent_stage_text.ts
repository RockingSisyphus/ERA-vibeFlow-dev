import { parseMessageBlocks } from "../domain/commands/message_function_calls.ts";

function onlyOperations(text: string): boolean {
  let remaining = text;
  for (const block of [...parseMessageBlocks({ content: text })].reverse()) {
    remaining = remaining.slice(0, block.start) + remaining.slice(block.end);
  }
  return (
    remaining
      .replace(/<\/?(?:era_tx|EraFCallTx)\b[^>]*>/giu, "")
      .replace(/```(?:json)?/giu, "")
      .trim() === ""
  );
}

/** Separate executable top-level blocks from the structured stage report, never from JSON strings. */
export function splitAgentStageText(raw: string): {
  json: string;
  before: string;
  after: string;
} {
  const trimmed = raw.trim();
  let depth = 0,
    start = -1,
    quoted = false,
    escaped = false;
  for (let index = 0; index < trimmed.length; index++) {
    const char = trimmed[index];
    if (start < 0) {
      if (char !== "{") continue;
      start = index;
      depth = 1;
      quoted = false;
      escaped = false;
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      const json = trimmed.slice(start, index + 1);
      let value: any;
      try {
        value = JSON.parse(json);
      } catch {
        start = -1;
        continue;
      }
      const matches = value.storyPlan && Array.isArray(value.calls);
      const before = trimmed.slice(0, start),
        after = trimmed.slice(index + 1);
      if (matches && onlyOperations(before) && onlyOperations(after)) {
        return {
          json,
          before: before.replace(/```(?:json)?/giu, "").trim(),
          after: after.replace(/```(?:json)?/giu, "").trim(),
        };
      }
      start = -1;
    }
  }
  // Even malformed JSON has an execution position. Extract only complete
  // top-level operation prefixes/suffixes; quoted JSON text stays in the middle.
  const blocks = parseMessageBlocks({ content: trimmed });
  let beforeEnd = 0,
    afterStart = trimmed.length;
  for (const block of blocks) {
    if (onlyOperations(trimmed.slice(0, block.end))) beforeEnd = block.end;
    else break;
  }
  for (const block of [...blocks].reverse()) {
    if (block.start >= beforeEnd && onlyOperations(trimmed.slice(block.start)))
      afterStart = block.start;
    else break;
  }
  return {
    json: trimmed.slice(beforeEnd, afterStart),
    before: trimmed.slice(0, beforeEnd),
    after: trimmed.slice(afterStart),
  };
}

/** Settlement is the same ordered tag program as message text, with no JSON adapter.
 * Preserve the valid prefix so candidate rollback covers calls before a malformed block. */
export function inspectSettlementText(raw: string): {
  content: string;
  prefix: string;
  error: string | null;
} {
  const blocks = parseMessageBlocks({ content: raw });
  let end = 0;
  for (const block of blocks) {
    if (block.start < end) continue;
    if (raw.slice(end, block.start).trim()) break;
    end = block.end;
  }
  const error = raw.slice(end).trim()
    ? `ERA_SETTLEMENT_FORMAT: 变量解析只能输出 ERA 操作标签或 EraFCall；位置 ${end} 存在无法解析的内容。`
    : null;
  return { content: raw, prefix: raw.slice(0, end), error };
}
