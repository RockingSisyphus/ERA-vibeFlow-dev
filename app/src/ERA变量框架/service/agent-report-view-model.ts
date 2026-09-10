/*
 * 模块职责：负责将真实阶段请求映射为统一列表、内容页签和只读资格。
 * 只读取报告与页面内存，不执行重试、恢复候选或推断业务提交成功。
 */

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

/** 单条可选择请求；来源直接使用执行元数据，不能从报告正文或 ID 格式猜测。 */
export interface AgentReportRequestItem {
  readonly key: string;
  readonly report: AgentReportObject;
  readonly attempt: AgentReportObject;
  readonly currentExecution: boolean;
  readonly label: string;
}

export function agentRequestStatus(status: unknown): string {
  return (
    (
      { passed: '成功', failed: '失败', responded: '响应完成', running: '请求中', cancelled: '已取消' } as Record<
        string,
        string
      >
    )[String(status)] ?? '状态未记录'
  );
}

/** 为当前报告的手动执行按首次出现顺序编号，不把自动尝试误当作新的执行。 */
function requestOriginLabeler(stage: AgentReportStage) {
  const executions = new Map<string, number>();
  const counts = new Map<string, number>();
  const stageName = { planning: '规划', story: '正文', settlement: '解析' }[stage];
  const manual: Record<string, string> = {
    'manual-planning': '手动重新规划',
    'manual-story': '手动重新生成正文',
    'manual-settlement': '手动重新解析',
  };
  const automatic: Record<string, string> = {
    initial: `初次${stageName}`,
    continue: 'Continue 续写',
    regenerate: '酒馆重新生成',
  };
  return (context: AgentReportObject): string => {
    const trigger = String(context.trigger);
    const executionId = context.executionId;
    if (!manual[trigger] || typeof executionId !== 'string') return automatic[trigger] ?? '来源未记录';
    if (!executions.has(executionId)) {
      const ordinal = (counts.get(trigger) ?? 0) + 1;
      counts.set(trigger, ordinal);
      executions.set(executionId, ordinal);
    }
    const cascade = trigger === `manual-${stage}` ? '' : ` → ${stageName}`;
    return `${manual[trigger]} ${executions.get(executionId)}${cascade}`;
  };
}

/** 只有明确关联到上一失败请求才显示纠错或请求重试；旧记录缺字段必须如实说明。 */
function requestIntentLabel(context: AgentReportObject, index: number): string {
  const intent = String(context.intent);
  const labels: Record<string, string> = { initial: '首次请求', correction: '错误修正', 'request-retry': '请求重试' };
  if (!labels[intent]) return `尝试 ${index + 1}（类型未记录）`;
  return intent === 'initial' ? labels[intent]! : `${labels[intent]} ${String(context.attemptIndex)}`;
}

/**
 * 同一请求的报告可被多次投影；必须按真实 requestId 合并，避免生成重复的“执行记录”。
 * 历史执行只读；当前阶段报告最后覆盖同 ID 的中间报告，从而保留其最终响应与错误。
 * legacy key 仅用于没有身份的旧记录显示，不用于推断执行来源或允许业务重试。
 */
export function agentReportRequests(
  current: string,
  history: readonly string[],
  stage: AgentReportStage,
): AgentReportRequestItem[] {
  const requests = new Map<string, AgentReportRequestItem>();
  const origin = requestOriginLabeler(stage);
  for (const text of [...history.filter(item => item !== current), current]) {
    const report = readAgentReport(text);
    const final = report.final === true || (!Array.isArray(report.attempts) && !report.requestId && 'plan' in report);
    for (const [index, attempt] of agentReportAttempts(report).entries()) {
      const context = isObject(attempt.requestContext) ? attempt.requestContext : {};
      const key =
        typeof attempt.requestId === 'string' ? attempt.requestId : `legacy:${stage}:${requests.size}:${index}`;
      requests.set(key, {
        key,
        report,
        attempt,
        currentExecution: text === current,
        label: final
          ? '最终成果（过程记录已释放）'
          : `${origin(context)} · ${requestIntentLabel(context, index)}：${agentRequestStatus(attempt.status)}`,
      });
    }
  }
  // 默认最新请求在前；用户选择持有 requestId，不因后续发布增加记录而跳动。
  return [...requests.values()].reverse();
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
        : '记录已释放，或此请求未采集提示词。',
    'AI 响应': () =>
      record?.response ??
      attempt.response ??
      report.plan ??
      (report.final === true ? { operations: report.operations, notice: '原始生成记录已释放' } : '记录已释放'),
    函数结果: () => attempt.functionResults ?? report.functionResults ?? '旧记录未保存',
    变量操作: () => ({
      operations: attempt.operations ?? report.operations ?? '记录已释放',
      validation: attempt.status ?? '旧记录未保存',
      commit: record?.commit ?? '未采集提交回执；解析校验成功不代表最终提交成功。',
    }),
    错误详情: () => attempt.diagnostic ?? '无已记录错误',
  };
  return values[tab]?.() ?? report;
}
