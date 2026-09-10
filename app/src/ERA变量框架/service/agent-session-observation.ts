/** 将实际会话报告送入有界查看仓库；不决定会话转换或业务持久化。 */
import { agentExecutionRecords, currentAgentRecordChat } from './agent-execution-records';
import { messageMk } from './statusbar-message-identity';
import { generationHandoffs } from './generation-handoff-host';
import type { EraSettlement } from './types';
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 消息提交后才可能出现 MK，因此绑定只读取真实宿主消息，不使用派发时的临时标识。 */
function reportLocation(session: Record<string, unknown>) {
  const mk = typeof session.messageId === 'number' ? messageMk(SillyTavern.chat[session.messageId]?.mes ?? '') : null;
  const pendingKey =
    record(session.execution) && typeof session.execution.id === 'string'
      ? `pending-generation:${session.execution.id}`
      : null;
  return { chat: currentAgentRecordChat(), mk, pendingKey };
}

/** 回执后仅关联观察记录，不能重新打开已完成的阶段等待。 */
export function bindAgentSessionReports(session: unknown): void {
  if (!record(session)) return;
  const { chat, mk, pendingKey } = reportLocation(session);
  if (!mk || !pendingKey) return;
  for (const stage of ['planning', 'settlement']) agentExecutionRecords.bindReportFloor(chat, pendingKey, mk, stage);
}

/** 消息落盘后才绑定过程记录；观察 Promise 不改变原 FIFO 回执或生成顺序。 */
export function observeAgentReceipt(done: Promise<EraSettlement>, readSession: () => unknown): void {
  agentExecutionRecords.observeSettlement(
    done.then(outcome => {
      bindAgentSessionReports(readSession());
      return outcome;
    }),
  );
}

/** 回执属于解析请求，因此不能把同一事件归给规划请求。 */
function bindStageReceipt(stage: string, attempts: readonly unknown[], eventId: unknown): void {
  if (stage !== 'settlement' || typeof eventId !== 'string') return;
  for (const attempt of attempts)
    if (record(attempt) && typeof attempt.requestId === 'string')
      agentExecutionRecords.bindCommit(attempt.requestId, eventId);
}

/** 仅完整尝试才成为过程报告，续体中的 requestId/status 元数据不能伪造已释放记录。 */
function stageObservationReport(
  session: Record<string, unknown>,
  stage: string,
  attempts: readonly unknown[],
): string | null {
  if (
    !attempts.some(
      attempt =>
        record(attempt) && ['response', 'diagnostic', 'functionResults', 'operations'].some(key => key in attempt),
    )
  )
    return null;
  return JSON.stringify({
    attempts,
    ...(stage === 'planning' ? { plan: session.plan, functionResults: session.functionResults } : {}),
  });
}

/** 必须使用真实 MK 关联观察，避免同楼 Swipe 或切聊后显示别的执行。 */
export function observeAgentSession(session: unknown, eventId: unknown): void {
  if (!record(session)) return;
  const { chat, mk, pendingKey } = reportLocation(session);
  for (const stage of ['planning', 'settlement'] as const) {
    if (mk && pendingKey) agentExecutionRecords.bindReportFloor(chat, pendingKey, mk, stage);
    const attempts = session[stage === 'planning' ? 'planningAttempts' : 'settlementAttempts'];
    if (!Array.isArray(attempts)) continue;
    bindStageReceipt(stage, attempts, eventId);
    const key = mk ?? pendingKey;
    const report = stageObservationReport(session, stage, attempts);
    if (key && report) agentExecutionRecords.rememberReport(chat, key, stage, report);
  }
  if (record(session.pendingStage) && typeof session.pendingStage.completionId === 'string')
    generationHandoffs.open(session.pendingStage.completionId);
}
