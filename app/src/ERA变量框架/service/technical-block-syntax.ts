/** 标签文案属于显示；配对和文本边界来自Macro登记库的同源产物。 */
import {
  parseEraTechnicalProjection as parseStructure,
  type EraTechnicalProjection as Structure,
} from '@era/vibeflow-macro-syntax';
export { stripEraTechnicalBlocks } from '@era/vibeflow-macro-syntax';
export type EraTechnicalSegment = Structure['segments'][number] & { readonly label?: string };
export type EraTechnicalProjection = Omit<Structure, 'segments'> & {
  readonly segments: readonly EraTechnicalSegment[];
};
/** 仅补充界面标签；结构边界沿用登记库结果，避免显示与出站清理各维护一套解析规则。 */
export function parseEraTechnicalProjection(text: string): EraTechnicalProjection {
  const labels: Readonly<Record<string, string>> = {
    era_plan: 'ERA 规划报告',
    era_update: 'ERA 变量解析报告',
    era_agent_error: 'ERA 多阶段生成错误',
  };
  const projection = parseStructure(text);
  return {
    ...projection,
    segments: projection.segments.map(segment =>
      segment.kind === 'story' ? segment : { ...segment, label: labels[segment.name] },
    ),
  };
}
