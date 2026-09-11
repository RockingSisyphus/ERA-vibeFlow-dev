/** 技术块严格配对与文本结构，显示标签由App提供。 */
type TechnicalBlockKind = 'folded' | 'hidden';
type OpenTag = {
  readonly name: string;
  readonly start: number;
  readonly contentStart: number;
  readonly kind: TechnicalBlockKind;
};

export type EraTechnicalSegment =
  | { readonly kind: 'story'; readonly text: string }
  | {
      readonly kind: TechnicalBlockKind;
      readonly name: string;
      readonly text: string;
      readonly source: string;
    };

/** 描述一次保守解析的有效性、技术块数量和按原文顺序排列的显示片段。 */
export type EraTechnicalProjection = {
  readonly valid: boolean;
  readonly technicalBlockCount: number;
  readonly segments: readonly EraTechnicalSegment[];
};

type ClosedBlock = OpenTag & { readonly end: number; readonly contentEnd: number };

function technicalBlockKind(name: string): TechnicalBlockKind {
  return ['era_plan', 'era_update', 'era_agent_error'].includes(name) ? 'folded' : 'hidden';
}

/**
 * 只收集严格闭合的顶层块，内层变量命令由外层事务统一承载。
 * 返回 null 表示边界不可信，调用方必须保留整段原文。
 */
function collectTechnicalBlocks(text: string): ClosedBlock[] | null {
  const stack: OpenTag[] = [];
  const blocks: ClosedBlock[] = [];
  const names = 'era_plan|era_update|era_agent_error|era_tx|erafcall|erafcalltx|era_block|variableinsert|variableedit|variabledelete|functioninsert|functionedit|functiondelete|era_data|variablethink';
  const TECHNICAL_TAG_TOKEN = new RegExp(`<\\s*(\\/?)\\s*(${names})\\b[^>]*>`, 'giu');
  for (let match = TECHNICAL_TAG_TOKEN.exec(text); match; match = TECHNICAL_TAG_TOKEN.exec(text)) {
    const closing = match[1] === '/';
    const name = match[2].toLowerCase();
    // 自闭合标签自身就是完整块：不能压栈，否则后续所有块的配对都会错位，
    // 使整次解析返回 null，从而让出站剥离与显示投影同时失效。
    const selfClosing = !closing && /\/\s*>$/.test(match[0]);
    if (!closing) {
      const start = match.index;
      const contentStart = start + match[0].length;
      if (selfClosing) {
        if (stack.length === 0) {
          blocks.push({
            name,
            kind: technicalBlockKind(name),
            start,
            contentStart,
            contentEnd: start,
            end: contentStart,
          });
        }
        continue;
      }
      stack.push({
        name,
        kind: technicalBlockKind(name),
        start,
        contentStart,
      });
      continue;
    }

    const open = stack.at(-1);
    if (!open || open.name !== name) return null;
    stack.pop();
    if (stack.length === 0) {
      blocks.push({ ...open, contentEnd: match.index, end: match.index + match[0].length });
    }
  }
  return stack.length === 0 ? blocks : null;
}

/**
 * 从权威消息原文解析严格配对的顶层 ERA 技术块。任意错序、孤立结束标签或未闭合标签
 * 都会让整次解析失效；必须宁可保留原文，也不冒险吞掉故事或伪造报告边界。
 */
export function parseEraTechnicalProjection(text: string): EraTechnicalProjection {
  const blocks = collectTechnicalBlocks(text);
  if (blocks === null) {
    return { valid: false, technicalBlockCount: 0, segments: [{ kind: 'story', text }] };
  }
  if (blocks.length === 0) {
    return { valid: true, technicalBlockCount: 0, segments: [{ kind: 'story', text }] };
  }

  const segments: EraTechnicalSegment[] = [];
  let cursor = 0;
  for (const block of blocks) {
    if (block.start > cursor) segments.push({ kind: 'story', text: text.slice(cursor, block.start) });
    segments.push({
      kind: block.kind,
      name: block.name,
      text: text.slice(block.contentStart, block.contentEnd),
      source: text.slice(block.start, block.end),
    });
    cursor = block.end;
  }
  if (cursor < text.length) segments.push({ kind: 'story', text: text.slice(cursor) });
  return { valid: true, technicalBlockCount: blocks.length, segments };
}

/**
 * 只删除严格配对的保留标签。错序或缺失结束标签会保留原文，避免把故事吞到后续偶然出现的闭合标签。
 */
export function stripEraTechnicalBlocks(text: string): string {
  const projection = parseEraTechnicalProjection(text);
  if (!projection.valid || projection.technicalBlockCount === 0) return text;
  return projection.segments
    .filter((segment): segment is Extract<EraTechnicalSegment, { kind: 'story' }> => segment.kind === 'story')
    .map(segment => segment.text)
    .join('');
}
