/** 报告组件与被动记录的页面生命周期；不拥有故事 DOM 或业务状态。 */
import { createApp, type App } from 'vue';
import AgentReportViewer from '../ui/components/AgentReportViewer.vue';
import { agentExecutionRecords, currentAgentRecordChat } from './agent-execution-records';
import { readCurrentAgentSession } from './agent-tavern-host';
import type { AgentReportStage } from './agent-report-view-model';
import { activeMessageText, messageMk } from './statusbar-message-identity';

const reportApps = new Map<HTMLElement, App>();

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
  if (floorKey) agentExecutionRecords.rememberReport(currentAgentRecordChat(), floorKey, stage, report);
  const root = document.createElement('div');
  const props = { report, stage, messageId, floorKey };
  // Helper 会重新格式化消息 HTML；只给 ERA 自有容器保留重新挂载所需的只读报告。
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
  const details = document.createElement('details');
  details.className = 'era-technical-report';
  details.dataset.eraStoryViewer = 'true';
  const summary = document.createElement('summary');
  summary.textContent = 'ERA 正文生成记录';
  summary.id = `era-report-summary-story-${messageId}`;
  details.append(summary, mountReportViewer(document, report, 'story', messageId));
  return details;
}

/** 只关联实际 Helper 请求 ID；注销与挂载配对，不能残留上一个原生生成的目标。 */
export function registerAgentRequestObservation(): () => void {
  const started = (id: string) => agentExecutionRecords.helperStarted(id);
  const ended = (_text: string, id: string) => agentExecutionRecords.helperEnded(id);
  const stopNative = () => agentExecutionRecords.stopNative();
  const cancelNative = () => agentExecutionRecords.stopNative(true);
  const cancelledEvents = [tavern_events.GENERATION_STOPPED, tavern_events.CHAT_CHANGED];
  eventOn(iframe_events.GENERATION_STARTED, started);
  eventOn(iframe_events.GENERATION_ENDED, ended);
  eventOn(tavern_events.GENERATION_ENDED, stopNative);
  for (const event of cancelledEvents) eventOn(event, cancelNative);
  return () => {
    eventRemoveListener(iframe_events.GENERATION_STARTED, started);
    eventRemoveListener(iframe_events.GENERATION_ENDED, ended);
    eventRemoveListener(tavern_events.GENERATION_ENDED, stopNative);
    for (const event of cancelledEvents) eventRemoveListener(event, cancelNative);
    agentExecutionRecords.stopNative();
  };
}
