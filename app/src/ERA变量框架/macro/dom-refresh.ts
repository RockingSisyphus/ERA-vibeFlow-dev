import { ERA_EVENT_EMITTER, type WriteDonePayload } from '../utils/constants';
import { Logger } from '../utils/log';
import { containsEraMacro, parseEraMacroText, type EraMacroSnapshot } from './syntax';

const logger = new Logger('MacroDomRefresh');

function snapshotFromWriteDone(payload: WriteDonePayload): EraMacroSnapshot {
  return {
    statWithMeta: payload.stat,
    statWithoutMeta: payload.statWithoutMeta,
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
 * `writeDone` 是提交后的通知，而不是状态事务的一部分；本处理器只改
 * 页面显示，不写聊天数据，也不会反向等待 ERA 调度器，因而不会造成重入死锁。
 */
export function refreshDisplayedEraMacros(payload: WriteDonePayload): void {
  if (payload.actions.swipedRollback) {
    logger.debug('refreshDisplayedEraMacros', '检测到 swipedRollback，跳过临时消息的宏刷新。');
    return;
  }

  const { message_id } = payload;
  if (typeof message_id !== 'number') {
    logger.warn('refreshDisplayedEraMacros', 'writeDone 未提供有效的 message_id。');
    return;
  }

  try {
    const $message = retrieveDisplayedMessage(message_id);
    if (!$message.length) {
      return;
    }

    const snapshot = snapshotFromWriteDone(payload);
    const chatMessage = SillyTavern.chat?.[message_id];
    const rawMessage = typeof chatMessage?.mes === 'string' ? chatMessage.mes : null;

    if (rawMessage !== null && containsEraMacro(rawMessage)) {
      const parsedMessage = parseEraMacroText(rawMessage, snapshot);
      $message.html(formatAsDisplayedMessage(parsedMessage, { message_id }));
      logger.debug('refreshDisplayedEraMacros', `已重新渲染消息 ${message_id} 中的 ERA 宏。`);
      return;
    }

    const currentHtml = $message.html();
    if (containsEraMacro(currentHtml) && replaceEraMacrosInElement($message, snapshot)) {
      logger.debug('refreshDisplayedEraMacros', `已就地替换消息 ${message_id} 中残留的 ERA 宏。`);
    }
  } catch (error) {
    logger.error('refreshDisplayedEraMacros', `刷新消息 ${message_id} 的 ERA 宏失败。`, error);
  }
}

/**
 * 注册 writeDone 显示刷新，并返回幂等的卸载函数。
 */
export function registerEraMacroDomRefresh(): () => void {
  eventOn(ERA_EVENT_EMITTER.WRITE_DONE, refreshDisplayedEraMacros);

  let registered = true;
  logger.log('registerEraMacroDomRefresh', '已监听 writeDone 以刷新消息中的 ERA 宏。');

  return () => {
    if (!registered) {
      return;
    }

    registered = false;
    eventRemoveListener(ERA_EVENT_EMITTER.WRITE_DONE, refreshDisplayedEraMacros);
    logger.log('registerEraMacroDomRefresh', '已移除 writeDone 宏刷新监听器。');
  };
}
