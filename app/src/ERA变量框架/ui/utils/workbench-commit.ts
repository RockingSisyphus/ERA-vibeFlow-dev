import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { WorkbenchIntent } from '@era/vibeflow-workbench';
import { commitWorkbenchIntent } from '../../service/workbench-client';

/** 管理一次工作台保存的界面归属，避免旧聊天回执或关闭计时器修改新草稿；业务写入仍由 Service 执行。 */
export function useWorkbenchCommit<Editor extends { readonly identityKey: string }>(
  editor: Ref<Editor | null>,
  identityKey: () => string,
) {
  const busy = ref(false);
  const error = ref('');
  const success = ref('');
  let closeTimer: number | undefined;

  /** 重开和卸载都必须撤销原计时器，否则新抽屉可能被旧保存关闭。 */
  function clearCloseTimer(): void {
    if (closeTimer !== undefined) window.clearTimeout(closeTimer);
    closeTimer = undefined;
  }
  watch(
    editor,
    () => {
      clearCloseTimer();
      busy.value = false;
    },
    { flush: 'sync' },
  );
  onBeforeUnmount(() => {
    clearCloseTimer();
    editor.value = null;
  });

  /** 准备与发送之间再次核对草稿，等待 facade 时发生的切聊不能向新聊天提交旧操作。 */
  async function submit(prepare: () => WorkbenchIntent, assertFresh: () => void): Promise<void> {
    if (!editor.value || busy.value) return;
    const owner = editor.value;
    const isCurrent = () => editor.value === owner && identityKey() === owner.identityKey;
    error.value = '';
    success.value = '';
    busy.value = true;
    try {
      assertFresh();
      const intent = prepare();
      const receipt = await commitWorkbenchIntent(intent);
      if (!isCurrent()) return;
      if (receipt.status !== 'committed') throw new Error('ERA 跳过了本次 UI 提交。');
      success.value = `已保存到消息 #${receipt.messageId}。`;
      closeTimer = window.setTimeout(() => {
        closeTimer = undefined;
        if (isCurrent() && !busy.value) editor.value = null;
      }, 700);
    } catch (reason) {
      if (isCurrent()) error.value = reason instanceof Error ? reason.message : String(reason);
    } finally {
      if (isCurrent()) busy.value = false;
    }
  }
  return { busy, error, success, submit };
}
