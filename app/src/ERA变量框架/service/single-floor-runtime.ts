import { shallowRef, watch } from 'vue';
import { singleFloorSelection, refreshSingleFloorSelection } from './single-floor-configuration';
import { currentTavernContext } from './tavern-browser-host';
import { createSingleFloorHelper } from './single-floor-helper';
import { reconcileSingleFloor } from './single-floor-window';

export const singleFloorDiagnostic = shallowRef('');
function report(error: unknown) {
  singleFloorDiagnostic.value = String(error instanceof Error ? error.message : error);
  console.warn('[ERA 单层模式]', error);
}
async function audit() {
  await currentTavernContext().eventSource.emit(tavern_events.MORE_MESSAGES_LOADED);
}

/** 只拥有显示窗口；业务状态始终从酒馆读取，避免形成第二份聊天或楼层编号。 */
class SingleFloorWindow {
  active = false;
  restoring = false;
  readonly helper;
  readonly empty;
  readonly style;
  constructor(
    readonly document: Document,
    readonly chat: Element,
  ) {
    this.helper = createSingleFloorHelper(document);
    this.style = document.createElement('style');
    this.style.textContent =
      '#chat.era-single-floor>#show_more_messages{display:none!important}#chat.era-single-floor{overflow-anchor:none}';
    document.head.append(this.style);
    this.empty = document.createElement('div');
    this.empty.textContent = '单层模式：等待 AI 回复。';
    this.empty.style.cssText = 'padding:16px;text-align:center;opacity:.65';
  }
  adjust() {
    if (!this.active || this.restoring) return false;
    const state = reconcileSingleFloor(this.document, currentTavernContext().chat);
    if (state.messageId < 0 && !this.empty.isConnected) this.chat.append(this.empty);
    if (state.messageId >= 0) this.empty.remove();
    return state.removed;
  }
  async restore() {
    this.restoring = true;
    try {
      const host = currentTavernContext();
      await host.clearChat(); // 宿主默认只清显示，不清 chat 数据。
      await host.printMessages(); // 恢复原生窗口大小，不强制展开所有历史。
      if (this.active) reconcileSingleFloor(this.document, host.chat);
      await audit();
    } finally {
      this.restoring = false;
    }
  }
  async apply(enabled: boolean) {
    singleFloorDiagnostic.value = '';
    if (enabled && !this.active) {
      this.helper.acquire();
      this.active = true;
      this.chat.classList.add('era-single-floor');
    } else if (!enabled && this.active) {
      this.deactivate();
      await this.restore();
      return;
    }
    if (!enabled) {
      // 上次页面可能在 Helper 保存原偏好前退出。
      this.helper.release();
      return;
    }
    const target = reconcileSingleFloor(this.document, currentTavernContext().chat);
    if (target.messageId >= 0 && !target.mounted) await this.restore();
    this.adjust();
    await audit();
  }
  deactivate(unloading = false) {
    if (!this.active) return;
    this.active = false;
    this.chat.classList.remove('era-single-floor');
    this.empty.remove();
    this.helper.release(unloading);
  }
}

/** 先于 Helper 审计缩减窗口，避免卸载节点继续被其运行实例引用；不发送业务事件。 */
export function startSingleFloor(): () => void {
  const document = window.parent.document;
  const chat = document.querySelector('#chat');
  if (!chat) throw new Error('未找到酒馆聊天区');
  const surface = new SingleFloorWindow(document, chat);
  let disposed = false;
  let scheduled = false;
  let leaving = false;
  let transition = Promise.resolve();
  const pagehide = () => {
    leaving = true;
    try {
      surface.deactivate(true);
    } catch (error) {
      report(error);
    }
  };
  window.addEventListener('pagehide', pagehide);
  const stopWatch = watch(singleFloorSelection, () => {
    // 配置只串行改变显示，不与 ERA 的变量结算 FIFO 混为一体。
    transition = transition
      .then(async () => {
        if (!disposed) await surface.apply(singleFloorSelection.value?.enabled === true);
      })
      .catch(report);
  });
  refreshSingleFloorSelection();
  const changed = eventOn(tavern_events.CHAT_CHANGED, refreshSingleFloorSelection);
  const listeners = [
    tavern_events.CHARACTER_MESSAGE_RENDERED,
    tavern_events.USER_MESSAGE_RENDERED,
    tavern_events.MESSAGE_UPDATED,
    tavern_events.MESSAGE_SWIPED,
    tavern_events.MESSAGE_DELETED,
    tavern_events.MORE_MESSAGES_LOADED,
  ].map(event =>
    eventMakeFirst(event, () => {
      surface.adjust();
    }),
  );
  // Observer 只补标准事件之外的节点变更，不观察内容/token，避免每个 token 都调度。
  const observer = new MutationObserver(() => {
    if (!surface.active || surface.restoring || scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!disposed && surface.adjust()) void audit().catch(report);
    });
  });
  observer.observe(chat, { childList: true });
  /** 显式卸载须恢复原显示；页面退出不创建新 iframe，避免退出时重新执行作者脚本。 */
  function stop() {
    disposed = true;
    stopWatch();
    changed.stop();
    for (const listener of listeners) listener.stop();
    observer.disconnect();
    window.removeEventListener('pagehide', pagehide);
    const wasActive = surface.active;
    try {
      // 运行时卸载也可能先于本模块的 pagehide（例如宿主脚本销毁/热替换）。
      // 此处恢复控件但保留落盘恢复值；只有显式关闭配置才结清偏好记录。
      surface.deactivate(true);
    } catch (error) {
      report(error);
    }
    surface.style.remove();
    if (wasActive && !leaving) void transition.then(() => surface.restore()).catch(report);
    singleFloorSelection.value = null;
  }
  return stop;
}
