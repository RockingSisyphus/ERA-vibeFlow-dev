<template>
  <section :id="`era-report-viewer-${stage}-${messageId}`" class="era-stage-viewer" :data-era-stage="stage">
    <div class="era-stage-toolbar">
      <label class="era-request-select"
        >请求记录
        <select
          :id="`era-report-request-${stage}-${messageId}`"
          :value="requests.findIndex(item => item.key === selectedRequest?.key)"
          aria-label="查看阶段请求记录"
          @change="selectRequest"
        >
          <option v-for="(request, index) in requests" :key="request.key" :value="index">
            {{ request.label }}
          </option>
        </select>
      </label>
      <button
        :id="retryAvailable ? `era-report-retry-${stage}` : undefined"
        class="era-report-business"
        :disabled="busy || !retryAvailable"
        @click="retry"
      >
        {{ busy ? '正在执行…' : retryLabel }}
      </button>
    </div>
    <p class="era-report-status" :data-status="current.status">
      {{ agentRequestStatus(current.status) }}<span v-if="!retryAvailable"> · 历史记录或会话已失效，仅供查看。</span>
    </p>
    <div class="era-report-tabs" role="tablist" aria-label="报告内容">
      <button
        v-for="item in tabs"
        :id="`era-report-tab-${stage}-${messageId}-${tabIds[item]}`"
        :key="item"
        role="tab"
        :aria-selected="tab === item"
        :aria-pressed="tab === item"
        @click="tab = item"
      >
        {{ item }}
      </button>
    </div>
    <div class="era-report-actions">
      <strong>{{ tab }}</strong>
      <div class="era-report-mode" role="group" aria-label="内容显示方式">
        <button :aria-pressed="!raw" @click="raw = false">格式化显示</button>
        <button :aria-pressed="raw" @click="raw = true">原始显示</button>
      </div>
      <button class="era-report-copy" @click="copy">复制当前内容</button>
    </div>
    <p v-if="notice" role="status">{{ notice }}</p>
    <pre data-era-report-content>{{ content }}</pre>
  </section>
</template>

<script setup lang="ts">
/**
 * 模块职责：负责按楼层身份展示最终成果及有界过程记录。
 * 模块边界：依赖消息读取与观察仓库，仅向 Service 发送重试意图，不执行生成或变量计算。
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { readMessageStageReport } from '../../service/agent-message-report';
import { agentExecutionRecords, currentAgentRecordChat } from '../../service/agent-execution-records';
import { readCurrentAgentSession } from '../../service/client';
import { requestEraService } from '../../service/client';
import { ERA_UI_EVENT } from '../../service/types';
import { formatEraReportForDisplay } from '../../service/technical-report-display';
import {
  readAgentReport,
  agentReportAttempts,
  agentReportRequests,
  agentRequestStatus,
  canRetryAgentReport,
  formatAgentViewerValue,
  agentReportTabValue,
} from '../../service/agent-report-view-model';

const props = defineProps<{
  report?: string;
  stage: 'planning' | 'settlement' | 'story';
  messageId: number;
  floorKey?: string | null;
}>();
const finalReport = computed(() => {
  void version.value;
  return props.report ?? readMessageStageReport(props.messageId, props.floorKey, props.stage);
});
// 用户切换的旧执行记录仅改变显示选择，不替换当前聊天或当前会话。
const selectedKey = ref<string | null>(
  props.floorKey ? agentExecutionRecords.selectedRequest(currentAgentRecordChat(), props.floorKey, props.stage) : null,
);
function rememberSelection(requestId: string | null) {
  selectedKey.value = requestId;
  if (props.floorKey)
    agentExecutionRecords.selectRequest(currentAgentRecordChat(), props.floorKey, props.stage, requestId);
}
const history = computed(() => {
  void version.value;
  if (!props.floorKey) return [];
  return agentExecutionRecords
    .reportHistory(currentAgentRecordChat(), props.floorKey, props.stage)
    .filter(report => report !== finalReport.value);
});
const requests = computed(() =>
  agentReportRequests(
    history.value.at(-1) ?? finalReport.value,
    history.value.length ? [finalReport.value, ...history.value] : [],
    props.stage,
  ),
);
const selectedRequest = computed(
  () => requests.value.find(item => item.key === selectedKey.value) ?? requests.value[0],
);
const parsed = computed(() => selectedRequest.value?.report ?? readAgentReport(finalReport.value));
const attempts = computed(() => agentReportAttempts(parsed.value));
function selectRequest(event: Event) {
  rememberSelection(requests.value[Number((event.target as HTMLSelectElement).value)]?.key ?? null);
}
const tab = ref('AI 响应');
const tabIds: Record<string, string> = {
  完整响应: 'overview',
  提示词: 'prompt',
  'AI 响应': 'response',
  函数结果: 'functions',
  变量操作: 'operations',
  错误详情: 'error',
};
const raw = ref(false);
const busy = computed(() => {
  void version.value;
  return agentExecutionRecords.retryBusy(currentAgentRecordChat());
});
const notice = ref('');
const version = ref(0);
/** 内存请求可能晚于 Vue 挂载到达；订阅只触发重读，并在卸载时注销。 */
const refreshRecord = () => version.value++;
const unsubscribe = agentExecutionRecords.subscribe(refreshRecord);
onBeforeUnmount(unsubscribe);
const current = computed(() => selectedRequest.value?.attempt ?? {});
const tabs = computed(() => [
  'AI 响应',
  '完整响应',
  '提示词',
  ...(props.stage === 'planning' ? ['函数结果'] : props.stage === 'settlement' ? ['变量操作'] : []),
  '错误详情',
]);
const retryLabel = computed(
  () =>
    ({ planning: '重新规划并生成后续阶段', story: '按当前规划重新生成正文', settlement: '重新解析变量' })[props.stage],
);
const retryAvailable = computed(() => {
  // requestId 区分同一楼层上的新旧尝试；仅比较 messageId 会误操作新的周期。
  void version.value;
  const session = readCurrentAgentSession();
  if (
    !session &&
    props.messageId === SillyTavern.chat.length - 1 &&
    SillyTavern.chat[props.messageId]?.extra?.era_agent
  )
    return true;
  return (
    selectedRequest.value?.currentExecution === true &&
    canRetryAgentReport(parsed.value, props.stage, props.messageId, SillyTavern.chat.length - 1, session)
  );
});
/** 只有实际请求记录才可提供提示词，旧报告不能通过最新会话倒推补齐。 */
const content = computed(() => {
  void version.value;
  const attempt = current.value;
  if (tab.value === '完整响应') {
    const display = { selectedRequest: attempt.requestId ?? '旧记录未保存', ...parsed.value };
    return raw.value ? JSON.stringify(display) : formatEraReportForDisplay(JSON.stringify(display));
  }
  const record =
    typeof attempt.requestId === 'string'
      ? agentExecutionRecords.get(currentAgentRecordChat(), attempt.requestId)
      : undefined;
  return formatAgentViewerValue(agentReportTabValue(parsed.value, attempt, tab.value, record), raw.value);
});

/** 复制只导出用户当前看到的页签，浏览器拒绝剪贴板时保留明确反馈。 */
async function copy(event: MouseEvent): Promise<void> {
  try {
    // Vue 运行在隐藏脚本 iframe，按钮则属于酒馆页面；剪贴板使用按钮所在的可见文档。
    const view = (event.currentTarget as HTMLElement).ownerDocument.defaultView!;
    await view.navigator.clipboard.writeText(content.value);
    notice.value = '已复制';
  } catch (error) {
    notice.value = `复制失败：${String(error)}`;
  }
}

/**
 * 所有重生成都通过既有 FIFO，不能用按钮直接调用模型或改写聊天。
 * busy 保持到真实 receipt 终态，不按超时猜测生成已结束。
 * 发送当前周期来源，让 Service 在真正执行时再次确认没有切换到别的周期。
 */
async function retry(): Promise<void> {
  if (busy.value || !retryAvailable.value) return;
  const session = readCurrentAgentSession();
  if (session && session.messageId !== props.messageId) {
    notice.value = '会话已失效';
    return;
  }
  const finishRetry = agentExecutionRecords.beginRetry(currentAgentRecordChat());
  if (!finishRetry) return;
  notice.value = '';
  try {
    const admission = requestEraService(
      ERA_UI_EVENT.AGENT_RETRY,
      [
        Object.fromEntries(
          Object.entries({
            kind: props.stage,
            messageId: props.messageId,
            cycleIndex: session?.cycleIndex,
            sourceKey: session?.sourceKey,
            requestId: session ? attempts.value.at(-1)?.requestId : undefined,
          }).filter(([, value]) => value !== undefined),
        ),
      ],
      'ui',
    );
    if (!admission.accepted) throw new Error(admission.message);
    // 用户明确开始新执行时回到跟随最新；被动发布不能抢走旧请求选择。
    rememberSelection(null);
    const settlement = await admission.done;
    notice.value =
      settlement.status === 'completed'
        ? '已完成'
        : `未完成：${settlement.status} ${JSON.stringify(settlement.error ?? '')}`;
  } catch (error) {
    notice.value = `失败：${String(error)}`;
  } finally {
    finishRetry();
    version.value++;
  }
}
</script>

<style scoped>
.era-stage-viewer {
  --era-report-accent: #439da7;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  border-radius: 12px;
  padding: 14px;
  background: color-mix(in srgb, var(--SmartThemeBlurTintColor, #20272b) 95%, transparent);
  color: var(--SmartThemeBodyColor, #e1e8ec);
  font:
    14px/1.5 system-ui,
    sans-serif;
}
.era-stage-toolbar {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 12px;
}
.era-request-select {
  display: grid;
  flex: 1 1 260px;
  gap: 6px;
  font-size: 12px;
}
.era-stage-viewer select {
  width: 100%;
  min-width: 0;
  color: inherit;
  background: var(--SmartThemeBlurTintColor, #20272b);
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  border-radius: 7px;
  padding: 8px;
}
.era-stage-viewer button {
  font: inherit;
  color: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 7px 11px;
  background: transparent;
}
.era-stage-viewer button:focus-visible,
.era-stage-viewer select:focus-visible {
  outline: 2px solid var(--era-report-accent);
  outline-offset: 2px;
}
.era-stage-viewer button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.era-stage-viewer button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--era-report-accent) 20%, transparent);
}
.era-report-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  padding-bottom: 8px;
}
.era-report-tabs button[aria-selected='true'] {
  background: color-mix(in srgb, var(--era-report-accent) 28%, transparent);
  border-color: var(--era-report-accent);
  font-weight: 650;
}
.era-report-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0;
}
.era-report-actions strong {
  margin-right: auto;
}
.era-report-mode {
  display: flex;
  padding: 2px;
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 9%, transparent);
}
.era-report-mode button {
  font-size: 12px;
  padding: 4px 8px;
}
.era-report-mode button[aria-pressed='true'] {
  background: color-mix(in srgb, currentColor 18%, transparent);
}
.era-stage-viewer .era-report-copy {
  border-color: color-mix(in srgb, currentColor 25%, transparent);
  font-size: 12px;
}
.era-stage-viewer .era-report-business {
  border-color: var(--era-report-accent);
  background: color-mix(in srgb, var(--era-report-accent) 35%, transparent);
  font-weight: 650;
}
.era-report-status {
  font-size: 12px;
  margin: 10px 0;
}
.era-report-status[data-status='passed'] {
  color: #80c8a1;
}
.era-report-status[data-status='failed'] {
  color: #efb088;
}
.era-stage-viewer pre {
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: color-mix(in srgb, #000 20%, transparent);
  font:
    12px/1.7 ui-monospace,
    monospace;
}
@media (max-width: 600px) {
  .era-stage-viewer {
    padding: 10px;
  }
  .era-report-tabs button {
    flex: 1 0 auto;
    padding: 6px 8px;
  }
  .era-stage-toolbar > button {
    width: 100%;
  }
}
</style>
