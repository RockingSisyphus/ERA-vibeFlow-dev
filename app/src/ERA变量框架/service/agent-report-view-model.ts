/** 只读报告呈现，不推断业务提交是否成功。 */
export type AgentReportStage = 'planning' | 'story' | 'settlement';
export type AgentReportObject = Record<string, unknown>;
import type { AgentRequestRecord } from './agent-execution-records';

function isObject(value: unknown): value is AgentReportObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readAgentReport(text: string): AgentReportObject {
  try {
    const value: unknown = JSON.parse(text);
    return isObject(value) ? value : { response: value };
  } catch {
    return { response: text };
  }
}

export function agentReportAttempts(report: AgentReportObject): AgentReportObject[] {
  return Array.isArray(report.attempts) ? report.attempts.filter(isObject) : [report];
}

/** 同楼 Continue/重新生成后的旧记录也必须只读，不能只比较 messageId。 */
export function canRetryAgentReport(
  report: AgentReportObject,
  stage: AgentReportStage,
  messageId: number,
  latestMessageId: number,
  session: AgentReportObject | null,
): boolean {
  if (!session || session.messageId !== messageId || messageId !== latestMessageId) return false;
  if (!['settled', 'unsettled', 'story-complete'].includes(String(session.status))) return false;
  const configuration = session.configuration;
  if (stage !== 'story' && isObject(configuration)) {
    const settings = configuration[stage];
    if (isObject(settings) && settings.enabled !== true) return false;
  }
  const attempts = agentReportAttempts(report);
  const requestId = attempts.at(-1)?.requestId;
  if (typeof requestId !== 'string') return false;
  if (stage === 'story') return requestId === session.storyRequestId;
  const active = session[stage === 'planning' ? 'planningAttempts' : 'settlementAttempts'];
  return Array.isArray(active) && active.some(attempt => isObject(attempt) && attempt.requestId === requestId);
}

/** 只格式化显示副本，否则查看响应会意外改变持久化报告的输入格式。 */
export function formatAgentViewerValue(value: unknown, raw: boolean): string {
  if (typeof value === 'string') {
    if (raw) return value;
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, raw ? undefined : 2) ?? '旧记录未保存';
}

/** 各页签只读取已有事实；尤其不能将模型响应或校验成功解释成提交成功。 */
export function agentReportTabValue(
  report: AgentReportObject,
  attempt: AgentReportObject,
  tab: string,
  record?: AgentRequestRecord,
): unknown {
  const values: Record<string, () => unknown> = {
    提示词: () =>
      record
        ? { 'ERA 阶段输入': record.input, 宿主发送前提示词: record.prompt ?? '未采集' }
        : '此记录未保存提示词，或页面已重载。',
    'AI 响应': () => record?.response ?? attempt.response ?? '旧记录未保存',
    函数结果: () => attempt.functionResults ?? report.functionResults ?? '旧记录未保存',
    变量操作: () => ({
      operations: attempt.operations ?? '旧记录未保存',
      validation: attempt.status ?? '旧记录未保存',
      commit: record?.commit ?? '未采集提交回执；解析校验成功不代表最终提交成功。',
    }),
    错误详情: () => attempt.diagnostic ?? '无已记录错误',
  };
  return values[tab]?.() ?? report;
}
