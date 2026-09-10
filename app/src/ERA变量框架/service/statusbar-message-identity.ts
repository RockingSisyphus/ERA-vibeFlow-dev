function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 优先读取当前 Swipe 正文，避免身份求证误用非活动分支的 MK；
 * 消息尚未就绪时必须返回 null，让状态栏继续保持 loading。
 */
export function activeMessageText(message: unknown): string | null {
  if (!record(message)) return null;
  if (Array.isArray(message.swipes)) {
    const value = message.swipes[Number(message.swipe_id ?? 0)];
    if (typeof value === 'string') return value;
  }
  const value = message.mes ?? message.message;
  return typeof value === 'string' ? value : null;
}

export { messageMk } from '@era/vibeflow-floor-snapshot';

/** 从 Tavern Helper iframe 名称读取楼层号。 */
export function iframeMessageId(name: string): number | null {
  const match = name.match(/^TH-message--(\d+)--\d+(?:_\d+)?$/u);
  return match ? Number(match[1]) : null;
}

/** 从 iframe 所属消息 DOM 读取楼层号。 */
export function parentMessageId(frameElement: HTMLIFrameElement): number | null {
  const value = frameElement.closest<HTMLElement>('.mes[mesid]')?.getAttribute('mesid');
  return value && /^\d+$/u.test(value) ? Number(value) : null;
}

/** 非法旧 Swipe 序号只能落到默认分支，不能伪造其他分支身份。 */
export function currentSwipeId(message: unknown): number {
  if (!record(message)) return 0;
  const value = Number(message.swipe_id ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
