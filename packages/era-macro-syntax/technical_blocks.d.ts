// Generated from Macro base_lib; do not edit.
/** 技术块严格配对与文本结构，显示标签由App提供。 */
type TechnicalBlockKind = 'folded' | 'hidden';
export type EraTechnicalSegment = {
    readonly kind: 'story';
    readonly text: string;
} | {
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
/**
 * 从权威消息原文解析严格配对的顶层 ERA 技术块。任意错序、孤立结束标签或未闭合标签
 * 都会让整次解析失效；必须宁可保留原文，也不冒险吞掉故事或伪造报告边界。
 */
export declare function parseEraTechnicalProjection(text: string): EraTechnicalProjection;
/**
 * 只删除严格配对的保留标签。错序或缺失结束标签会保留原文，避免把故事吞到后续偶然出现的闭合标签。
 */
export declare function stripEraTechnicalBlocks(text: string): string;
export {};
