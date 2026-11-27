type EraProjectedMessage = {
  readonly schemaVersion: 2;
  readonly messageId: number;
  readonly role: string;
  readonly activeText: string;
  readonly swipeIndex: number | null;
  readonly candidate: { readonly exists: boolean; readonly generation: number | null; readonly predecessor: number | null; readonly phase: 'idle' | 'preparing' | 'generating' | 'completed' | 'cancelled' };
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
  // 原生 Overswipe 在回复出现前预留下一索引；遗留 mes 属于旧候选，不能借作新正文。
  if (Array.isArray(value.swipes) && value.swipes.length > 0 && swipeIndex === value.swipes.length) return '';
  // Host先更新当前正文并发出接收事件，稍后才填入swipes；当前正文以Helper当前视图为准。
  if (typeof value.message === 'string') return value.message;
  if (Array.isArray(value.swipes) && swipeIndex !== null && typeof value.swipes[swipeIndex] === 'string') {
    return value.swipes[swipeIndex];
  }
  if (typeof value.mes === 'string') return value.mes;
  if (typeof value.activeText === 'string') return value.activeText;
  throw new TypeError(`ERA 消息投影失败：消息 #${id} 没有当前激活文本。`);
}

/**
 * 把单条 Tavern 消息压缩为 ERA 严格投影；只读取可验证的 ID、角色、当前文本
 * 与 swipe 索引，任何缺失或歧义都在 Host 边界立即失败。
 */
export function projectMessage(value: unknown, index: number, generation: any = null): EraProjectedMessage {
  if (!isRecord(value)) throw new TypeError(`ERA 消息投影失败：消息 #${index} 不是对象。`);
  const messageId = projectedMessageId(value, index);
  const role = projectedMessageRole(value, messageId);
  const swipeIndex = projectedSwipeIndex(value, messageId);
  const activeText = projectedActiveText(value, messageId, swipeIndex);
  const exists = !Array.isArray(value.swipes) || swipeIndex === null || typeof value.swipes[swipeIndex] === 'string';
  const owned = generation && role === 'assistant' &&
    (generation.messageId === messageId && generation.swipeId === (swipeIndex ?? 0) ||
      generation.afterMessageId !== null && messageId > generation.afterMessageId && !['quiet', 'impersonate'].includes(generation.type));
  return { schemaVersion: 2, messageId, role, activeText, swipeIndex,
    candidate: { exists, generation: owned ? generation.id : null, predecessor: owned ? generation.predecessor ?? null : null, phase: owned ? generation.phase : 'idle' } };
}

export function candidateFactKey(api: any, messageId: number, swipeId: number): string {
  return JSON.stringify([api.getCurrentCharacterId(),api.SillyTavern.groupId||null,api.SillyTavern.getCurrentChatId(),messageId,swipeId]);
}

/** 从高层消息接口读取当前候选，同时保留本实例接收的原生生成事实。 */
export function readProjectedMessages(api: any, session: any, range: string | number = '0--1'): EraProjectedMessage[] {
  const raw = api.getChatMessages(range, { include_swipes: true });
  if (!Array.isArray(raw)) throw new TypeError('ERA 消息投影失败：Tavern 返回值不是数组。');
  const activeText = new Map<number, string>(api.getChatMessages(range).map((message: any) => [message.message_id, message.message]));
  const generation = session?.nativeCandidate;
  const current = generation?.chatId === api.SillyTavern.getCurrentChatId() &&
    generation.characterId === api.getCurrentCharacterId() && generation.groupId === (api.SillyTavern.groupId||null) ? generation : null;
  return raw.map((rawMessage: any, index: number) => {
    const message = { ...rawMessage, message: activeText.get(rawMessage.message_id) };
    const projected=projectMessage(message,index,current);
    if(projected.candidate.generation!==null)return projected;
    const previous=session?.nativeCandidateHistory?.get(candidateFactKey(api,projected.messageId,projected.swipeIndex??0));
    return previous?projectMessage(message,index,previous):projected;
  });
}
