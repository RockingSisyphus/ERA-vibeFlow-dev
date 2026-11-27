/** 同一条 AI 楼层的阶段分段约定：拼装、切分、前缀核对与前缀截取共用同一套空白规则。 */
import {
  formatMessageKeyBlock,
  stripEraDataBlocks,
} from "../domain/mk_engine.ts";

/** 分段边界只忽略空行与首尾空白；分段内部逐字保留。 */
export function joinStageParts(parts: readonly unknown[]): string {
  return parts
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    )
    .join("\n");
}

/** 落稿正文的业务部分：去掉数据块与尾部空白，供前缀核对和分段截取使用。 */
export function stageBody(content: string): string {
  return stripEraDataBlocks(content).trimEnd();
}

/** 阶段前缀：与拼装使用同一规则，再按落稿规则去掉数据块。 */
export function stagePrefix(parts: readonly unknown[]): string {
  return stripEraDataBlocks(joinStageParts(parts));
}

/** 前缀核对只忽略边界空白；分段内部内容变化仍然视为不一致。 */
export function prefixIntact(body: string, prefix: string): boolean {
  return body.startsWith(prefix.trimEnd());
}

/** 截取本次阶段新增的文字；开头分隔空白不算内容。 */
export function stageDraft(body: string, prefix: string): string {
  return body.slice(prefix.trimEnd().length).trimStart();
}

/** 规范化落稿正文：去掉数据块与尾部空白，再追加消息标识块。 */
export function composeCanonicalFloor(
  content: string,
  mk: string,
  keepStatusPlaceholder: boolean,
): string {
  const story = stripEraDataBlocks(content)
    .replace(/<StatusPlaceHolderImpl\s*\/>/giu, "")
    .trimEnd();
  return joinStageParts([
    story,
    formatMessageKeyBlock(mk, "assistant"),
    keepStatusPlaceholder ? "<StatusPlaceHolderImpl/>" : "",
  ]);
}

export interface StageLayout {
  /** 最后一个规划报告之前的正文开头；没有规划报告时为空。 */
  readonly open: string;
  /** 最后一个规划报告的 JSON 文本；没有时为空。 */
  readonly planJson: string;
  /** 规划报告起始位置；没有时为 -1。 */
  readonly planStart: number;
  /** 规划报告结束位置；没有时为 -1。 */
  readonly planEnd: number;
}

/** 从楼层正文切出“规划报告之前的开头”和最后一个规划报告的位置。 */
export function readStageLayout(text: string): StageLayout {
  const block = [...text.matchAll(/<era_plan>([\s\S]*?)<\/era_plan>/giu)].at(-1);
  if (block === undefined || block.index === undefined) {
    return { open: "", planJson: "", planStart: -1, planEnd: -1 };
  }
  return {
    open: text.slice(0, block.index),
    planJson: block[1],
    planStart: block.index,
    planEnd: block.index + block[0].length,
  };
}
