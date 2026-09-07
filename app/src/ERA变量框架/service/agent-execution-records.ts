/**
 * 页面级阶段观察仓库：关联实际请求、报告历史与提交回执。
 * 只服务查看器，不承担业务结算、持久化或重试决策；依赖 Host 提供精确事件身份。
 */
import { Logger } from '../utils/log';
import type { EraSettlement } from './types';

/** Host 只读观察 DTO；不导入 Service 的业务执行器或重试策略。 */
export interface AgentRequestContext {
  readonly executionId: string;
  readonly trigger: string;
  readonly attemptIndex: number;
  readonly intent: 'initial' | 'correction' | 'request-retry';
  readonly previousRequestId?: string;
}

/** 页面级观察数据；绝不作为 Service 业务状态或持久化 payload。 */
export interface AgentRequestRecord {
  readonly id: string;
  readonly chat: string;
  readonly stage: string;
  readonly input: unknown;
  readonly hostConfiguration?: unknown;
  readonly requestContext?: AgentRequestContext;
  prompt?: unknown;
  response?: string;
  status: 'running' | 'responded' | 'failed' | 'cancelled';
  commitEventId?: string;
  commit?: { eventId: string; status: string; error?: unknown };
}

/** 保留多模态结构，但不复制浏览器已经持有的媒体二进制。 */
function promptDisplayCopy(value: unknown): unknown {
  if (typeof value === 'string' && /^data:[^,]*;base64,/u.test(value)) {
    return `${value.slice(0, value.indexOf(','))},[媒体内容未保存]`;
  }
  if (Array.isArray(value)) return value.map(promptDisplayCopy);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key === 'data' && typeof item === 'string' && 'format' in value ? '[媒体内容未保存]' : promptDisplayCopy(item),
      ]),
    );
  }
  return value;
}

export class AgentExecutionRecords {
  private readonly entries = new Map<string, AgentRequestRecord>();
  private readonly listeners = new Set<() => void>();
  private readonly helperRequests = new Set<string>();
  private nativeRequest: string | null = null;
  private readonly reports = new Map<string, string[]>();
  private readonly retryingChats = new Set<string>();

  /** 三个阶段按钮共享一次用户操作的忙碌状态；不保存业务状态或候选。 */
  retryBusy(chat: string): boolean {
    return this.retryingChats.has(chat);
  }

  beginRetry(chat: string): (() => void) | undefined {
    if (this.retryingChats.has(chat)) return;
    this.retryingChats.add(chat);
    this.emit();
    return () => {
      this.retryingChats.delete(chat);
      this.emit();
    };
  }

  /** 必须在 Host 发起请求时复制输入，避免生成完成后从可变配置重建伪造旧提示词。 */
  begin(
    id: string,
    chat: string,
    stage: string,
    input: unknown,
    hostConfiguration?: unknown,
    requestContext?: AgentRequestContext,
  ): void {
    this.entries.set(id, {
      id,
      chat,
      stage,
      input: promptDisplayCopy(input),
      hostConfiguration: promptDisplayCopy(hostConfiguration),
      ...(requestContext ? { requestContext: structuredClone(requestContext) } : {}),
      status: 'running',
    });
    this.emit();
  }

  helperStarted(id: string): void {
    this.helperRequests.add(id);
  }
  helperEnded(id: string): void {
    this.helperRequests.delete(id);
  }
  armNative(id: string): void {
    this.nativeRequest = id;
  }
  stopNative(cancelled = false): void {
    const entry = this.nativeRequest ? this.entries.get(this.nativeRequest) : undefined;
    if (cancelled && entry?.status === 'running') {
      entry.status = 'cancelled';
      this.emit();
    }
    this.nativeRequest = null;
  }

  /** 多个宿主调用重叠时必须保留未采集，避免把无关请求归入本次尝试。 */
  capture(chat: string, prompt: unknown, dryRun: boolean): void {
    if (dryRun || this.helperRequests.size > 1) return;
    const id = [...this.helperRequests][0] ?? this.nativeRequest;
    if (!id) return;
    const entry = this.entries.get(id);
    if (!entry || entry.chat !== chat || entry.status !== 'running') return;
    // 一个实际请求只采集一次；后续无关事件不能覆盖已记录的发送前内容。
    if (entry.prompt !== undefined) return;
    entry.prompt = promptDisplayCopy(prompt);
    this.emit();
  }

  /** 响应成功不等于业务校验成功；这里只记录请求层终态。 */
  finish(id: string, status: 'responded' | 'failed', response?: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.status = status;
    entry.response = response;
    this.helperRequests.delete(id);
    if (this.nativeRequest === id) this.nativeRequest = null;
    this.emit();
  }

  /** 绑定工作流明确提供的入站事件，不以当前会话或最近一次回执猜测提交归属。 */
  bindCommit(id: string, eventId: string): void {
    const entry = this.entries.get(id);
    if (entry) entry.commitEventId = eventId;
  }

  /** 只观察真实 receipt；不影响 FIFO 结算，也不保留无关事件。 */
  recordSettlement(outcome: { eventId: string; status: string; error?: unknown }): void {
    let changed = false;
    for (const entry of this.entries.values()) {
      if (entry.commitEventId !== outcome.eventId) continue;
      entry.commit = structuredClone({ eventId: outcome.eventId, status: outcome.status, error: outcome.error });
      changed = true;
    }
    if (changed) this.emit();
  }

  /** 不让观察回调影响正式 receipt；错误仅写入已有诊断日志。 */
  observeSettlement(done: Promise<EraSettlement>): void {
    void done
      .then(outcome => this.recordSettlement(outcome))
      .catch(error => new Logger().error('agentReportObservation', '提交回执观察未完成。', error));
  }

  /** 返回副本以防显示格式化改写观察证据，聊天身份不匹配则没有记录。 */
  get(chat: string, id: string): AgentRequestRecord | undefined {
    const entry = this.entries.get(id);
    return entry?.chat === chat ? structuredClone(entry) : undefined;
  }

  /** 必须返回注销器，防止被替换的报告组件长期持有完整提示词。 */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 只去掉重复渲染产生的相邻同一报告，不干预真实请求或相同用户操作。 */
  rememberReport(chat: string, floorKey: string | number, stage: string, report: string): void {
    const key = JSON.stringify([chat, floorKey, stage]);
    const reports = this.reports.get(key) ?? [];
    if (reports.at(-1) === report) return;
    reports.push(report);
    this.reports.set(key, reports);
    this.emit();
  }

  reportHistory(chat: string, floorKey: string | number, stage: string): readonly string[] {
    return [...(this.reports.get(JSON.stringify([chat, floorKey, stage])) ?? [])];
  }

  private readonly selections = new Map<string, string>();

  /** 用户选择随同一楼层报告重挂载保留；只存 requestId，页面结束时释放。 */
  selectedRequest(chat: string, floorKey: string, stage: string): string | null {
    return this.selections.get(JSON.stringify([chat, floorKey, stage])) ?? null;
  }

  selectRequest(chat: string, floorKey: string, stage: string, requestId: string | null): void {
    const key = JSON.stringify([chat, floorKey, stage]);
    if (requestId === null) this.selections.delete(key);
    else this.selections.set(key, requestId);
  }

  sessionChanged(): void {
    this.emit();
  }

  /** 随页面 Service 停止一起释放；此仓库没有存储或恢复路径。 */
  clear(): void {
    this.entries.clear();
    this.reports.clear();
    this.selections.clear();
    this.helperRequests.clear();
    this.retryingChats.clear();
    this.nativeRequest = null;
    this.emit();
  }
  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const agentExecutionRecords = new AgentExecutionRecords();

export function currentAgentRecordChat(): string {
  return JSON.stringify([SillyTavern.characterId, SillyTavern.groupId, SillyTavern.getCurrentChatId()]);
}
