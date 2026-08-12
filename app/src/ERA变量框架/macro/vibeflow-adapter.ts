import { runWorkflow, type WorkflowInputs } from '@era/vibeflow-macro';

export type MacroStoredStatInput = WorkflowInputs['storedStat'];

/**
 * 同步调用 Macro AOT。
 *
 * 该边界不读取 Tavern、不保存状态，也不返回 Promise；调用方必须先读取一次
 * 原始已存 stat，再以带标签输入传入。
 */
export function runEraMacroWorkflow(substring: string, storedStat: MacroStoredStatInput): string {
  return runWorkflow({ substring, storedStat }).replacement;
}
