/** 从当前消息读取最终成果或旧格式报告；不会将历史消息归档到内存。 */
import { parseEraTechnicalProjection, stripEraTechnicalBlocks } from './technical-block-syntax';
import { activeMessageText, messageMk } from './statusbar-message-identity';
import type { AgentReportStage } from './agent-report-view-model';

/** 校验消息 MK 后再读取，因为同一楼号可被新的 Swipe 复用。 */
export function readMessageStageReport(
  messageId: number,
  floorKey: string | null | undefined,
  stage: AgentReportStage,
): string {
  const text = activeMessageText(SillyTavern.chat[messageId]) ?? '';
  if (floorKey && messageMk(text) !== floorKey) return JSON.stringify({ released: true });
  const projection = parseEraTechnicalProjection(text);
  const block = projection.segments.findLast(
    segment => segment.kind === 'folded' && segment.name === (stage === 'planning' ? 'era_plan' : 'era_update'),
  );
  if (stage !== 'story' && block) return block.text;
  if (stage === 'story') return JSON.stringify({ final: true, response: stripEraTechnicalBlocks(text) });
  const operations: unknown[] = [];
  const names: Record<string, string> = {
    VariableInsert: 'insert',
    VariableEdit: 'edit',
    VariableDelete: 'delete',
    FunctionInsert: 'functionInsert',
    FunctionEdit: 'functionEdit',
    FunctionDelete: 'functionDelete',
  };
  // 仅展示消息里的最终命令，不重算变量，也不决定命令是否有效。
  for (const match of text.matchAll(
    /<(VariableInsert|VariableEdit|VariableDelete|FunctionInsert|FunctionEdit|FunctionDelete)>([\s\S]*?)<\/\1>/gu,
  )) {
    try {
      operations.push({ [names[match[1]]]: JSON.parse(match[2]) });
    } catch {
      operations.push({ command: match[1], source: match[2] });
    }
  }
  return JSON.stringify({ final: true, operations });
}
