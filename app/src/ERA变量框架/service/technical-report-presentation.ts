import {
  createReportDetails,
  createSettlementViewer,
  createStoryViewer,
  mountReportViewer,
  releaseReportApps,
} from './agent-report-host';
import { currentAgentRecordChat } from './agent-execution-records';
import { messageMk } from './statusbar-message-identity';
import { parseEraTechnicalProjection, type EraTechnicalSegment } from './technical-block-syntax';

type FoldedBlock = Exclude<EraTechnicalSegment, { kind: 'story' }>;
type MountedReports = { container: HTMLElement; signature: string };

/** 由原文和当前分支决定报告内容，避免楼号复用时误用上个 Swipe 的容器。 */
function planReports(messageId: number, message: SillyTavern.ChatMessage) {
  const projection = parseEraTechnicalProjection(message.mes);
  const agent = Boolean(message.extra?.era_agent);
  const folded = projection.segments.filter((segment): segment is FoldedBlock => segment.kind === 'folded');
  if (!projection.valid || (!agent && folded.length === 0)) return null;
  const story = agent
    ? projection.segments
        .flatMap(segment => (segment.kind === 'story' ? [segment.text] : []))
        .join('')
        .trimEnd()
    : '';
  const signature = JSON.stringify([
    currentAgentRecordChat(),
    messageId,
    message.swipe_id,
    messageMk(message.mes),
    agent,
    story,
    folded.map(({ name, text }) => [name, text]),
  ]);
  return { agent, folded, story, signature };
}

function createFoldedReport(document: Document, segment: FoldedBlock, messageId: number): HTMLDetailsElement {
  const stage = segment.name === 'era_update' ? 'settlement' : 'planning';
  const details = createReportDetails(document, stage, messageId, segment.label ?? 'ERA 技术报告');
  details.dataset.eraTechnicalBlock = segment.name;
  details.append(mountReportViewer(document, segment.text, stage, messageId));
  return details;
}

/** 报告容器归本模块管理，内容变化时只替换该容器的子节点，避免扰动同楼正文和作者界面。 */
export function createReportPresentation() {
  const mounted = new Map<HTMLElement, MountedReports>();

  const remove = (parent: HTMLElement, entry: MountedReports) => {
    releaseReportApps(entry.container);
    entry.container.remove();
    mounted.delete(parent);
  };

  /** 同一消息版本重复通知时复用容器与组件，避免丢掉用户的展开与请求选择。 */
  const refresh = (messageId: number) => {
    const body = retrieveDisplayedMessage(messageId).get(0);
    const parent = body?.parentElement;
    const message = SillyTavern.chat?.[messageId];
    if (!parent || !message) return;
    const existing = mounted.get(parent);
    const planned = planReports(messageId, message);
    if (planned === null) {
      if (existing) remove(parent, existing);
      return;
    }
    const { agent, folded, story, signature } = planned;
    if (existing?.signature === signature && existing.container.parentElement === parent) return;

    const document = parent.ownerDocument;
    const container = existing?.container ?? document.createElement('div');
    // 新报告初始化前保存仍存在的展开状态，后续挂载才读得到本次用户操作。
    releaseReportApps(container);
    const fragment = document.createDocumentFragment();
    for (const segment of folded) fragment.append(createFoldedReport(document, segment, messageId));
    if (agent) {
      fragment.append(createStoryViewer(document, messageId, story));
      if (!folded.some(segment => segment.name === 'era_update')) {
        fragment.append(createSettlementViewer(document, messageId));
      }
    }
    container.dataset.eraTechnicalReports = '';
    mounted.set(parent, { container, signature });
    container.replaceChildren(fragment);
    if (container.parentElement !== parent) body.after(container);
  };

  return {
    refresh,
    releaseDetached() {
      for (const [parent, entry] of mounted) if (!entry.container.isConnected) remove(parent, entry);
    },
    release() {
      for (const [parent, entry] of mounted) remove(parent, entry);
    },
    ownsMutation(node: Node) {
      const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
      const root = element?.closest<HTMLElement>('[data-era-technical-reports]');
      return Boolean(root?.parentElement && mounted.get(root.parentElement)?.container === root);
    },
  };
}
