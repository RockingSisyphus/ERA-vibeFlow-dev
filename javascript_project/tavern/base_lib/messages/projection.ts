type EraProjectedMessage = {
  readonly schemaVersion: 1;
  readonly messageId: number;
  readonly role: string;
  readonly activeText: string;
  readonly swipeIndex: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function projectedMessageId(value: Readonly<Record<string, unknown>>, index: number): number {
  const rawId = value.message_id ?? value.messageId;
  if (!Number.isSafeInteger(rawId) || Number(rawId) < 0) {
    throw new TypeError(`ERA 消息投影失败：消息 #${index} 缺少非负整数 ID。`);
  }
  return Number(rawId);
}

function projectedMessageRole(value: Readonly<Record<string, unknown>>, id: number): string {
  if (typeof value.role === 'string' && value.role.length > 0) return value.role;
  if (value.is_user === true) return 'user';
  if (value.is_user === false) return 'assistant';
  throw new TypeError(`ERA 消息投影失败：消息 #${id} 缺少角色。`);
}

function projectedSwipeIndex(value: Readonly<Record<string, unknown>>, id: number): number | null {
  const raw = value.swipe_id ?? value.swipeIndex;
  if (raw === undefined || raw === null) return null;
  if (Number.isSafeInteger(raw) && Number(raw) >= 0) return Number(raw);
  throw new TypeError(`ERA 消息投影失败：消息 #${id} 的 swipe 索引无效。`);
}

function projectedActiveText(value: Readonly<Record<string, unknown>>, id: number, swipeIndex: number | null): string {
  if (Array.isArray(value.swipes) && swipeIndex !== null && typeof value.swipes[swipeIndex] === 'string') {
    return value.swipes[swipeIndex];
  }
  // 原生 Overswipe 在回复出现前预留下一索引；遗留 mes 属于旧候选，不能借作新正文。
  if (Array.isArray(value.swipes) && value.swipes.length > 0 && swipeIndex === value.swipes.length) return '';
  if (typeof value.mes === 'string') return value.mes;
  if (typeof value.message === 'string') return value.message;
  if (typeof value.activeText === 'string') return value.activeText;
  throw new TypeError(`ERA 消息投影失败：消息 #${id} 没有当前激活文本。`);
}

/**
 * 把单条 Tavern 消息压缩为 ERA 严格投影；只读取可验证的 ID、角色、当前文本
 * 与 swipe 索引，任何缺失或歧义都在 Host 边界立即失败。
 */
export function projectMessage(value: unknown, index: number): EraProjectedMessage {
  if (!isRecord(value)) throw new TypeError(`ERA 消息投影失败：消息 #${index} 不是对象。`);
  const messageId = projectedMessageId(value, index);
  const role = projectedMessageRole(value, messageId);
  const swipeIndex = projectedSwipeIndex(value, messageId);
  const activeText = projectedActiveText(value, messageId, swipeIndex);
  return { schemaVersion: 1, messageId, role, activeText, swipeIndex };
}
