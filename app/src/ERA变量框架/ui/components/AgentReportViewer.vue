<template>
  <section class="era-stage-viewer" :data-era-stage="stage">
    <div class="era-stage-toolbar">
      <label
        >执行记录
        <select v-model.number="execution" aria-label="查看阶段执行记录" @change="selected = 0">
          <option :value="-1">当前消息记录</option>
          <option v-for="(record, index) in history" :key="index" :value="index">
            本页面旧记录 {{ index + 1 }}（只读）
          </option>
        </select>
      </label>
      <label
        >尝试
        <select :id="`era-report-attempt-${stage}-${messageId}`" v-model.number="selected" aria-label="查看阶段尝试">
          <option v-for="(attempt, index) in attempts" :key="index" :value="index">
            第 {{ index + 1 }} 次：{{
              attempt.status === 'passed'
                ? '成功'
                : attempt.status === 'failed'
                  ? '失败'
                  : attempt.status === 'responded'
                    ? '响应完成'
                    : attempt.status === 'running'
                      ? '请求中'
                      : attempt.status === 'cancelled'
                        ? '已取消'
                        : '旧记录未保存状态'
            }}
          </option>
        </select>
      </label>
      <button
        :id="retryAvailable ? `era-report-retry-${stage}` : undefined"
        :disabled="busy || !retryAvailable"
        @click="retry"
      >
        {{ busy ? '正在执行…' : retryLabel }}
      </button>
    </div>
    <p v-if="!retryAvailable">历史记录或会话已失效，仅供查看。</p>
    <div class="era-stage-toolbar">
      <button
        v-for="item in tabs"
        :id="`era-report-tab-${stage}-${messageId}-${tabIds[item]}`"
        :key="item"
        :aria-pressed="tab === item"
        @click="tab = item"
      >
        {{ item }}
      </button>
      <button @click="raw = !raw">{{ raw ? '格式化显示' : '原始显示' }}</button>
      <button @click="copy">复制当前内容</button>
    </div>
    <p v-if="notice" role="status">{{ notice }}</p>
    <pre data-era-report-content>{{ content }}</pre>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { agentExecutionRecords, currentAgentRecordChat } from '../../service/agent-execution-records';
import { readCurrentAgentSession } from '../../service/agent-tavern-host';
import { requestEraService } from '../../service/client';
import { ERA_UI_EVENT } from '../../service/types';
import { formatEraReportForDisplay } from '../../service/technical-report-display';
import {
  readAgentReport,
  agentReportAttempts,
  canRetryAgentReport,
  formatAgentViewerValue,
  agentReportTabValue,
} from '../../service/agent-report-view-model';

const props = defineProps<{
  report: string;
  stage: 'planning' | 'settlement' | 'story';
  messageId: number;
  floorKey?: string | null;
}>();
// 用户切换的旧执行记录仅改变显示选择，不替换当前聊天或当前会话。
const execution = ref(-1);
const history = computed(() => {
  void version.value;
  if (!props.floorKey) return [];
  return agentExecutionRecords
    .reportHistory(currentAgentRecordChat(), props.floorKey, props.stage)
    .filter(report => report !== props.report);
});
const parsed = computed(() =>
  readAgentReport(execution.value < 0 ? props.report : (history.value[execution.value] ?? props.report)),
);
const attempts = computed(() => agentReportAttempts(parsed.value));
const selected = ref(0);
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
const current = computed(() => attempts.value[selected.value] ?? {});
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
  return (
    execution.value < 0 &&
    canRetryAgentReport(parsed.value, props.stage, props.messageId, SillyTavern.chat.length - 1, session)
  );
});
/** 只有实际请求记录才可提供提示词，旧报告不能通过最新会话倒推补齐。 */
const content = computed(() => {
  void version.value;
  const attempt = current.value;
  if (tab.value === '完整响应')
    return raw.value ? JSON.stringify(parsed.value) : formatEraReportForDisplay(JSON.stringify(parsed.value));
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
  if (!session || session.messageId !== props.messageId) {
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
        {
          kind: props.stage,
          messageId: props.messageId,
          cycleIndex: session.cycleIndex,
          sourceKey: session.sourceKey,
          requestId: attempts.value.at(-1)?.requestId,
        },
      ],
      'ui',
    );
    if (!admission.accepted) throw new Error(admission.message);
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
