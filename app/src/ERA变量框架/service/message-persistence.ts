import { isEqual } from 'lodash';

import { currentTavernContext } from './tavern-browser-host';
import { projectMessage } from './message-projection';
import { assertCurrentMessageBasis, MessageWriteTargetChanged } from './message-write-target';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

type WrittenMessage = { id: number; swipe: number; text: string; extra: Record<string, unknown> };

/** 必须比较原生文件中的本次字段，否则保存接口吞错时会将旧文件误报为成功。 */
function assertPersistedMessages(data: unknown, expected: readonly WrittenMessage[]): void {
  if (!Array.isArray(data)) throw new Error('聊天保存回读没有返回消息数组。');
  for (const item of expected) {
    // 原生文件的第0项为header，不能作为聊天第0楼。
    const message = record(data[item.id + 1]);
    const swipe = Number(message.swipe_id ?? 0);
    const text = message.mes;
    const swipeText = Array.isArray(message.swipes)
      ? message.swipes[item.swipe]
      : swipe === item.swipe
        ? text
        : undefined;
    const swipeInfo = Array.isArray(message.swipe_info) ? record(message.swipe_info[item.swipe]) : {};
    const extra = record(swipe === item.swipe ? message.extra : swipeInfo.extra);
    if (
      (swipe === item.swipe && text !== item.text) ||
      swipeText !== item.text ||
      !Object.entries(item.extra).every(([key, value]) => isEqual(extra[key], value))
    ) {
      throw new Error(`聊天保存未确认：消息 #${item.id} 的正文、Swipe或ERA附加数据不一致。`);
    }
  }
}

/** 为了避免await后读错聊天，先捕获本次固定文件与字段；不保存第二份聊天或锁住宿主。 */
export function prepareMessagePersistence(input: Readonly<Record<string, unknown>>, signal: AbortSignal) {
  const tavern = currentTavernContext();
  const character = tavern.characters[Number(tavern.characterId)];
  if (!character || tavern.groupId) throw new Error('消息保存需要当前单角色聊天。');
  const target = { avatar_url: character.avatar, ch_name: character.name, file_name: character.chat };
  const sameChat = () => {
    const current = currentTavernContext();
    const card = current.characters[Number(current.characterId)];
    return !current.groupId && card?.avatar === target.avatar_url && card.chat === target.file_name;
  };
  const updates = Array.isArray(input.updates)
    ? input.updates
    : input.update
      ? [input.update]
      : [{ message_id: input.message_id ?? input.messageId, message: input.content }];
  const expected = updates.map(value => {
    const update = record(value);
    const id = Number(update.message_id ?? update.messageId);
    const original = tavern.chat[id];
    if (!original) throw new Error(`保存目标消息 #${id} 不存在。`);
    const swipe = Number(original.swipe_id ?? 0);
    const text = update.message ?? update.mes ?? (Array.isArray(update.swipes) ? update.swipes[swipe] : undefined);
    if (typeof text !== 'string') throw new TypeError(`保存目标消息 #${id} 缺少文本。`);
    const extra = Object.fromEntries(Object.entries(record(update.extra)).filter(([key]) => key.startsWith('era_')));
    return { id, swipe, text, extra: structuredClone(extra) };
  });
  // 使用与提交边界相同的来源比较，但将本任务自身写入纳入依据。
  const basis = input.sourceBasis as { identity: unknown; messages: ReturnType<typeof projectMessage>[] } | undefined;
  const postWriteBasis = {
    identity: basis?.identity ?? {
      characterId: getCurrentCharacterId(),
      chatId: SillyTavern.getCurrentChatId(),
      groupId: SillyTavern.groupId || null,
    },
    messages: (basis?.messages ?? getChatMessages('0--1', { include_swipes: true }).map(projectMessage)).map(
      message => ({
        ...message,
        activeText: expected.find(item => item.id === message.messageId)?.text ?? message.activeText,
      }),
    ),
  };
  const sourceChange = () => {
    try {
      assertCurrentMessageBasis(postWriteBasis);
      return null;
    } catch (error) {
      if (error instanceof MessageWriteTargetChanged) return error;
      throw error;
    }
  };
  /** 必须以实际读回而非Promise判断落盘；失败保留内存已写事实，交由Service结算。 */
  return async () => {
    if (expected.length === 0) return { status: 'committed' };
    let persistenceConfirmed = false;
    try {
      signal.throwIfAborted();
      if (!sameChat()) throw new Error('消息已更新，但保存前聊天已切换。');
      await tavern.saveChat();
      // 上游会吞保存错误；Promise fulfilled 并不是落盘证据。
      const response = await fetch('/api/chats/get', {
        method: 'POST',
        headers: tavern.getRequestHeaders(),
        signal,
        body: JSON.stringify(target),
      });
      if (!response.ok) throw new Error(`聊天保存回读失败：HTTP ${response.status}`);
      assertPersistedMessages(await response.json(), expected);
      persistenceConfirmed = true;
      const changed = sourceChange();
      if (changed) throw changed;
      return { status: 'committed' };
    } catch (error) {
      return {
        status: 'failed',
        writeState: 'memory-written',
        persistenceConfirmed,
        sourceChanged: sourceChange() !== null,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  };
}
