/** 报告组件与被动记录的页面生命周期；不拥有故事 DOM 或业务状态。 */
import { TavernListeners } from './tavern-listeners';
import { createApp, type App } from 'vue';
import AgentReportViewer from '../ui/components/AgentReportViewer.vue';
import { agentExecutionRecords, currentAgentRecordChat } from './agent-execution-records';
import { readCurrentAgentSession } from './client';
import type { AgentReportStage } from './agent-report-view-model';
import { activeMessageText, messageMk } from './statusbar-message-identity';

const reportApps = new Map<HTMLElement, App>();
const reportVisibility = new WeakMap<object, { mk: string | null; stages: Map<AgentReportStage, boolean> }>();

/** 宿主重绘只替换DOM；同一消息/MK保留用户展开状态，切换版本则重新默认折叠。 */
function bindReportVisibility(details: HTMLDetailsElement, stage: AgentReportStage, messageId: number): void {
  const message = SillyTavern.chat[messageId];
  if (!message) return;
  const mk = messageMk(activeMessageText(message) ?? '');
  let visibility = reportVisibility.get(message);
  if (!visibility || visibility.mk !== mk) {
    visibility = { mk, stages: new Map() };
    reportVisibility.set(message, visibility);
  }
  details.open = visibility.stages.get(stage) ?? details.open;
  const stages = visibility.stages;
  /** 记录真实toggle结果，避免宿主复制或重建DOM时把用户展开意图丢掉。 */
  const rememberToggle = () => stages.set(stage, details.open);
  details.addEventListener('toggle', rememberToggle);
}

/** 三阶段必须共用显示状态绑定，避免只有规划报告能在宿主重绘后保持展开。 */
export function createReportDetails(
  document: Document,
  stage: AgentReportStage,
  messageId: number,
  label: string,
): HTMLDetailsElement {
  const details = document.createElement('details');
  details.className = 'era-technical-report';
  const summary = document.createElement('summary');
  summary.textContent = label;
  summary.id = `era-report-summary-${stage}-${messageId}`;
  details.append(summary);
  bindReportVisibility(details, stage, messageId);
  return details;
}

/** 必须卸载脱离页面的 Vue 实例，否则旧报告仍会订阅后续请求。 */
export function releaseReportApps(all = false): void {
  for (const [root, app] of reportApps) {
    if (all || !root.isConnected) {
      app.unmount();
      reportApps.delete(root);
    }
  }
}

/** 历史必须只记显示副本，避免查看器写回原消息或改变当前会话。 */
export function mountReportViewer(
  document: Document,
  report: string,
  stage: AgentReportStage,
  messageId: number,
): HTMLElement {
  // 楼号会因删楼改变，Swipe 也会复用楼号；页面归档以消息的稳定 MK 分组。
  const message = SillyTavern.chat[messageId];
  const floorKey = messageMk(activeMessageText(message) ?? '');
  if (floorKey && report && /"(?:attempts|requestId)"\s*:/u.test(report))
    agentExecutionRecords.rememberReport(currentAgentRecordChat(), floorKey, stage, report);
  const root = document.createElement('div');
  const props = { stage, messageId, floorKey };
  // Helper 会复制 HTML；DOM 只保存重新挂载的身份，不复制报告。
  // 完整提示词不在 props 中，仍仅通过请求 ID 从页面记录仓库读取。
  root.dataset.eraReportView = encodeURIComponent(JSON.stringify(props));
  const app = createApp(AgentReportViewer, props);
  app.mount(root);
  reportApps.set(root, app);
  return root;
}

/** 宿主复制 HTML 不会复制 Vue listener，必须为新容器恢复自己的组件，不碰作者 iframe。 */
export function hydrateReportViewers(message: HTMLElement): void {
  releaseReportApps();
  for (const root of message.querySelectorAll<HTMLElement>('[data-era-report-view]')) {
    if (reportApps.has(root)) continue;
    const props = JSON.parse(decodeURIComponent(root.dataset.eraReportView!));
    const details = root.closest('details');
    if (details) bindReportVisibility(details, props.stage, props.messageId);
    const app = createApp(AgentReportViewer, props);
    app.mount(root);
    reportApps.set(root, app);
  }
}

/** 正文已有聊天事实来源；没有页面请求 ID 的旧记录只能读，不能冒充实际提示词。 */
export function createStoryViewer(document: Document, messageId: number, fallbackStory: string): HTMLElement | null {
  if (!SillyTavern.chat[messageId]?.extra?.era_agent) return null;
  const session = readCurrentAgentSession();
  const current = session?.messageId === messageId ? session : null;
  const request =
    typeof current?.storyRequestId === 'string'
      ? agentExecutionRecords.get(currentAgentRecordChat(), current.storyRequestId)
      : undefined;
  const report = JSON.stringify({
    response: typeof current?.story === 'string' ? current.story : fallbackStory,
    ...(typeof current?.storyRequestId === 'string' ? { requestId: current.storyRequestId } : {}),
    ...(request ? { status: request.status } : {}),
    ...(request?.requestContext ? { requestContext: request.requestContext } : {}),
    ...(request?.hostConfiguration ? { hostConfiguration: request.hostConfiguration } : {}),
  });
  const details = createReportDetails(document, 'story', messageId, 'ERA 正文生成记录');
  details.dataset.eraStoryViewer = 'true';
  details.append(mountReportViewer(document, report, 'story', messageId));
  return details;
}

/** 精简消息没有 era_update，因此从实际指令提供查看入口，避免重进后变量页消失。 */
export function createSettlementViewer(document: Document, messageId: number): HTMLElement | null {
  const message = SillyTavern.chat[messageId];
  if (!message?.extra?.era_agent || /<era_update>/iu.test(activeMessageText(message) ?? '')) return null;
  const details = createReportDetails(document, 'settlement', messageId, 'ERA 变量解析报告');
  details.dataset.eraSettlementViewer = 'true';
  details.append(mountReportViewer(document, '', 'settlement', messageId));
  return details;
}

/** 只关联实际 Helper 请求 ID；注销与挂载配对，不能残留上一个原生生成的目标。 */
export function registerAgentRequestObservation(): () => void {
  const started = (id: string) => agentExecutionRecords.helperStarted(id);
  const ended = (_text: string, id: string) => agentExecutionRecords.helperEnded(id);
  const stopNative = () => agentExecutionRecords.stopNative();
  const cancelNative = () => agentExecutionRecords.stopNative(true);
  const cancelledEvents = [tavern_events.GENERATION_STOPPED, tavern_events.CHAT_CHANGED];
  const listeners = new TavernListeners();
  const stop = () => {
    listeners.release();
    agentExecutionRecords.stopNative();
  };
  try {
    listeners.register(iframe_events.GENERATION_STARTED, started, 'normal');
    listeners.register(iframe_events.GENERATION_ENDED, ended, 'normal');
    listeners.register(tavern_events.GENERATION_ENDED, stopNative, 'normal');
    for (const event of cancelledEvents) listeners.register(event, cancelNative, 'normal');
    return stop;
  } catch (error) {
    stop();
    throw error;
  }
}
