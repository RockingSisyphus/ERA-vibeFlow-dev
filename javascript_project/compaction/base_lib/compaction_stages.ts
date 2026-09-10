import {
  parseCommandLayer,
  executeOriginalSemantics,
  analyzeDependencies,
  candidateFor,
  clone,
  equal,
  render,
  equivalent,
  type CommandCompactionRequest,
  type CommandCompactionResponse,
  type ParsedLayer,
  type SemanticTrace,
  type DependencyAnalysis,
} from "./command_compaction_engine.ts";

interface ScopedTransaction {
  readonly [key: string]: unknown;
  readonly start: number;
  readonly end: number;
  readonly raw: string;
  readonly body: string;
  readonly scope: "m" | "b" | "a" | null;
}

function scopedTransactions(content: string): readonly ScopedTransaction[] {
  const result: ScopedTransaction[] = [];
  const pattern = /<era_tx\b([^>]*)>([\s\S]*?)<\/era_tx>/giu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const scopeMatch = /\bs\s*=\s*["']([^"']+)["']/iu.exec(match[1] ?? "");
    const rawScope = scopeMatch?.[1] ?? "";
    result.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      body: match[2] ?? "",
      scope:
        rawScope === "m" || rawScope === "b" || rawScope === "a"
          ? rawScope
          : null,
    });
  }
  return result;
}

function withStartState(
  request: CommandCompactionRequest,
  content: string,
  statData: Readonly<Record<string, unknown>>,
  statFunc: Readonly<Record<string, unknown>>,
): CommandCompactionRequest {
  return {
    ...request,
    content,
    initialStatData: statData,
    initialStatFunc: statFunc,
  };
}

/**
 * era_tx 的 scope 是不可跨越的语义边界。只有相邻、同 scope 且中间只有空白的
 * wrapper 才合并为一个候选；不同 scope、非法 wrapper 与普通正文均保留原顺序。
 */

interface Segment {
  readonly [key: string]: unknown;
  readonly text: string;
  readonly raw: string;
  readonly scope: string | null;
  readonly allowRewrite: boolean;
}
export interface LayerPlan extends ParsedLayer {
  readonly [key: string]: unknown;
  readonly segments: readonly Segment[];
  readonly scoped: boolean;
}
export interface SegmentState {
  readonly [key: string]: unknown;
  readonly cursor: number;
  readonly segments: readonly Segment[];
  readonly request: CommandCompactionRequest;
  readonly parsed: LayerPlan;
  readonly statData: Readonly<Record<string, unknown>>;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly drawOffset: number;
  readonly parts: readonly string[];
  readonly diagnostics: CommandCompactionResponse["diagnostics"];
  readonly reasons: readonly string[];
  readonly changed: boolean;
  readonly commandSegments: number;
  readonly rewrittenSegments: number;
  readonly lastResult: CommandCompactionResponse | null;
}
export interface CandidateData extends SemanticTrace {
  readonly [key: string]: unknown;
  readonly replacements: readonly (readonly [number, string])[];
  readonly reasons: readonly string[];
}
/** Own scope grouping once; pure prose is retained as a real ordered segment. */
export function parseLayer(input: unknown): LayerPlan {
  const parsed = parseCommandLayer(input);
  const transactions = scopedTransactions(parsed.request.content);
  if (transactions.length === 0)
    return {
      ...parsed,
      scoped: false,
      segments: [
        {
          text: parsed.request.content,
          raw: parsed.request.content,
          scope: null,
          allowRewrite: true,
        },
      ],
    };
  const segments: Segment[] = [];
  let cursor = 0;
  for (let index = 0; index < transactions.length;) {
    const current = transactions[index]!;
    const prefix = parsed.request.content.slice(cursor, current.start);
    segments.push({
      text: prefix,
      raw: prefix,
      scope: null,
      allowRewrite: true,
    });
    let endIndex = index;
    let text = current.body;
    let raw = current.raw;
    if (current.scope !== null) {
      while (endIndex + 1 < transactions.length) {
        const next = transactions[endIndex + 1]!;
        const between = parsed.request.content.slice(
          transactions[endIndex]!.end,
          next.start,
        );
        if (next.scope !== current.scope || between.trim().length > 0) break;
        text += `${between}${next.body}`;
        raw += `${between}${next.raw}`;
        endIndex += 1;
      }
    }
    segments.push({
      text,
      raw,
      scope: current.scope,
      allowRewrite: current.scope !== null && endIndex > index,
    });
    cursor = transactions[endIndex]!.end;
    index = endIndex + 1;
  }
  const tail = parsed.request.content.slice(cursor);
  segments.push({ text: tail, raw: tail, scope: null, allowRewrite: true });
  return { ...parsed, segments, scoped: true };
}
export function initializeSegments(parsed: LayerPlan): SegmentState {
  return {
    cursor: 0,
    segments: parsed.segments,
    request: parsed.request,
    parsed,
    statData: clone(parsed.request.initialStatData),
    statFunc: clone(parsed.request.initialStatFunc ?? {}),
    drawOffset: parsed.request.randomContext?.drawOffset ?? 0,
    parts: [],
    diagnostics: [],
    reasons: [],
    changed: false,
    commandSegments: 0,
    rewrittenSegments: 0,
    lastResult: null,
  };
}
export function selectSegment(state: SegmentState): ParsedLayer {
  const segment = state.segments[state.cursor]!;
  // The unscoped request must preserve the exact original snapshot defaults.
  if (!state.parsed.scoped) return parseCommandLayer(state.request);
  const request = {
    ...state.request,
    ...(state.request.randomContext
      ? {
          randomContext: {
            sourceKey: state.request.randomContext.sourceKey,
            drawOffset: state.drawOffset,
          },
        }
      : {}),
  };
  return parseCommandLayer(
    withStartState(request, segment.text, state.statData, state.statFunc),
  );
}
export function rewriteSegment(analysis: DependencyAnalysis): CandidateData {
  const candidate = candidateFor(analysis);
  return { ...candidate, replacements: [...candidate.replacements] };
}
export function verifySegment(
  candidate: CandidateData,
): CommandCompactionResponse {
  const replacements = new Map(candidate.replacements);
  const base = {
    content: candidate.request.content,
    finalStatData: candidate.finalStatData,
    finalStatFunc: candidate.finalStatFunc,
    diagnostics: candidate.diagnostics,
    parsedCommands: candidate.commands,
    nextRandomDrawOffset: candidate.nextRandomDrawOffset,
  };
  // Match the parser-diagnostic precedence of the original public API.
  if (parseCommandLayer(candidate.request).diagnostics.length > 0)
    return {
      ...base,
      status: "invalid",
      reasons: ["标签 JSON 无效，未改写消息。"],
    };
  if (replacements.size === 0)
    return {
      ...base,
      status: "unchanged",
      reasons: candidate.reasons.length
        ? candidate.reasons
        : ["没有可证明安全的缩写。"],
    };
  const content = render(candidate, replacements);
  if (!equivalent(candidate, content))
    return {
      ...base,
      status: "unchanged",
      reasons: [
        ...candidate.reasons,
        "候选未通过同一起点真实重放，已退回原命令。",
      ],
    };
  return {
    ...base,
    content,
    status: candidate.commands.every((command) =>
      replacements.has(command.index),
    )
      ? "compacted"
      : "partial",
    reasons: candidate.reasons,
  };
}
export function advanceSegment(
  state: SegmentState,
  result: CommandCompactionResponse,
): SegmentState {
  const segment = state.segments[state.cursor]!;
  const hasCommands = result.parsedCommands.length > 0;
  const changed =
    hasCommands &&
    segment.allowRewrite &&
    result.content !== segment.text &&
    result.diagnostics.length === 0;
  const text = changed
    ? segment.scope === null
      ? result.content
      : `<era_tx s="${segment.scope}">${result.content}</era_tx>`
    : segment.raw;
  return {
    ...state,
    cursor: state.cursor + 1,
    statData: clone(result.finalStatData),
    statFunc: clone(result.finalStatFunc),
    drawOffset: result.nextRandomDrawOffset,
    parts: [...state.parts, text],
    diagnostics: [...state.diagnostics, ...result.diagnostics],
    reasons: [...state.reasons, ...result.reasons],
    changed: state.changed || changed,
    commandSegments: state.commandSegments + Number(hasCommands),
    rewrittenSegments: state.rewrittenSegments + Number(changed),
    lastResult: result,
  };
}
export function verifyLayer(state: SegmentState): CommandCompactionResponse {
  if (!state.parsed.scoped) return state.lastResult!;
  const originalTrace = executeOriginalSemantics(state.parsed);
  const content = state.parts.join("");
  const replay = executeOriginalSemantics(
    parseCommandLayer({ ...state.request, content }),
  );
  const equivalentResult =
    equal(originalTrace.finalStatData, replay.finalStatData) &&
    equal(originalTrace.finalStatFunc, replay.finalStatFunc) &&
    originalTrace.nextRandomDrawOffset === replay.nextRandomDrawOffset &&
    originalTrace.diagnostics.length === replay.diagnostics.length &&
    originalTrace.diagnostics.every(
      (issue, index) =>
        issue.code === replay.diagnostics[index]?.code &&
        issue.path === replay.diagnostics[index]?.path,
    );
  const base = {
    finalStatData: originalTrace.finalStatData,
    finalStatFunc: originalTrace.finalStatFunc,
    diagnostics: originalTrace.diagnostics,
    parsedCommands: state.parsed.commands,
    nextRandomDrawOffset: originalTrace.nextRandomDrawOffset,
  };
  if (!state.changed || !equivalentResult)
    return {
      ...base,
      status: state.diagnostics.length > 0 ? "invalid" : "unchanged",
      content: state.request.content,
      reasons: equivalentResult
        ? state.reasons
        : [
            ...state.reasons,
            "同 scope 分段候选未通过整层真实重放，已保留原事务。",
          ],
    };
  return {
    ...base,
    status:
      state.rewrittenSegments === state.commandSegments
        ? "compacted"
        : "partial",
    content,
    reasons: state.reasons,
  };
}
export { executeOriginalSemantics, analyzeDependencies };
