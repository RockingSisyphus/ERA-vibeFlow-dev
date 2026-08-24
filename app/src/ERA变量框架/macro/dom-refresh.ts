import { removeMetaFields } from '../utils/era_data';
import { subscribeSidecarRuntimeSnapshot, type SidecarRuntimeSnapshot } from '../service/sidecar-runtime-snapshot';
import { Logger } from '../utils/log';
import { containsEraMacro, parseEraMacroText, type EraMacroSnapshot } from './syntax';

const logger = new Logger('MacroDomRefresh');

function macroSnapshot(payload: SidecarRuntimeSnapshot): EraMacroSnapshot {
  return {
    statWithMeta: payload.statData,
    statWithoutMeta: removeMetaFields(payload.statData),
  };
}

/**
 * 替换已经渲染到消息 DOM 中、但原始消息里不存在的残留宏。
 *
 * 正常路径会根据原始消息重新格式化整段内容；本函数只负责兼容
 * 旧页面或第三方扩展留下的宏，因此不会进入 script/style/textarea。
 */
function replaceEraMacrosInElement($root: JQuery<HTMLElement>, snapshot: EraMacroSnapshot): boolean {
  let patched = false;

  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const original = node.nodeValue ?? '';
      if (!containsEraMacro(original)) {
        return;
      }

      const replaced = parseEraMacroText(original, snapshot);
      if (replaced !== original) {
        node.nodeValue = replaced;
        patched = true;
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const tagName = (node as HTMLElement).tagName;
    if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'TEXTAREA') {
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      visit(child);
    }
  };

  $root.each((_, element) => visit(element));
  return patched;
}

/**
 * 在 ERA 状态提交完成后刷新对应消息的宏显示。
 *
 * Sidecar 运行时快照只在提交成功后发布；本处理器只改页面显示，不写聊天数据，
 * 也不会反向等待 ERA 调度器，因而不会造成重入死锁。
 */
export function refreshDisplayedEraMacros(payload: SidecarRuntimeSnapshot | null): void {
  if (payload === null) return;
  try {
    const snapshot = macroSnapshot(payload);
    for (const [messageId, chatMessage] of (SillyTavern.chat ?? []).entries()) {
      const $message = retrieveDisplayedMessage(messageId);
      if (!$message.length) continue;
      const rawMessage = typeof chatMessage?.mes === 'string' ? chatMessage.mes : null;
      if (rawMessage !== null && containsEraMacro(rawMessage)) {
        const parsedMessage = parseEraMacroText(rawMessage, snapshot);
        $message.html(formatAsDisplayedMessage(parsedMessage, { message_id: messageId }));
      } else if (containsEraMacro($message.html())) {
        replaceEraMacrosInElement($message, snapshot);
      }
    }
  } catch (error) {
    logger.error('refreshDisplayedEraMacros', '刷新消息中的 ERA 宏失败。', error);
  }
}

/**
 * 注册运行时快照显示刷新，并返回幂等的卸载函数。
 */
export function registerEraMacroDomRefresh(): () => void {
  const unsubscribe = subscribeSidecarRuntimeSnapshot(refreshDisplayedEraMacros);

  let registered = true;
  logger.log('registerEraMacroDomRefresh', '已订阅 ERA 运行时状态以刷新消息宏。');

  return () => {
    if (!registered) {
      return;
    }

    registered = false;
    unsubscribe();
    logger.log('registerEraMacroDomRefresh', '已移除 ERA 状态订阅。');
  };
}
