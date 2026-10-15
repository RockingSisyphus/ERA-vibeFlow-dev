import {record, currentTavern, identity} from "../browser.ts";
import {stableStringify} from "../frames.ts";
import {projectMessage} from "./projection.ts";
import {assertCurrentMessageBasis} from "./target.ts";

/** 固定文件和写后依据的数据投影；不发起保存、请求或等待。 */
export function persistenceFacts(api: any, input: any): any {
  const tavern = currentTavern(api);
  const character = tavern.characters[Number(tavern.characterId)];
  if (!character || tavern.groupId) throw new Error("消息保存需要当前单角色聊天。");
  const target = {avatar_url: character.avatar, ch_name: character.name, file_name: character.chat};
  const updates = Array.isArray(input.updates) ? input.updates : input.update ? [input.update]
    : [{message_id: input.message_id ?? input.messageId, message: input.content}];
  const expected = updates.map((value: any) => {
    const update = record(value) ? value : {};
    const id = Number(update.message_id ?? update.messageId);
    const original = tavern.chat[id];
    if (!original) throw new Error(`保存目标消息 #${id} 不存在。`);
    const swipe = Number(original.swipe_id ?? 0);
    const text = update.message ?? update.mes ?? (Array.isArray(update.swipes) ? update.swipes[swipe] : undefined);
    if (typeof text !== "string") throw new TypeError(`保存目标消息 #${id} 缺少文本。`);
    const extra = Object.fromEntries(Object.entries(record(update.extra) ? update.extra : {}).filter(([key]) => key.startsWith("era_")));
    return {id, swipe, text, extra: structuredClone(extra)};
  });
  const basis = input.sourceBasis;
  const postWriteBasis = {
    identity: basis?.identity ?? identity(api),
    messages: (basis?.messages ?? api.getChatMessages("0--1", {include_swipes: true}).map(projectMessage)).map((message: any) => ({
      ...message, activeText: expected.find((item: any) => item.id === message.messageId)?.text ?? message.activeText,
    })),
  };
  return {tavern, target, expected, postWriteBasis};
}
export function sameChat(api: any, target: any): boolean {
  const current = currentTavern(api);
  const card = current.characters[Number(current.characterId)];
  return !current.groupId && card?.avatar === target.avatar_url && card.chat === target.file_name;
}
export function sourceChanged(api: any, basis: any): boolean {
  try { assertCurrentMessageBasis(api, basis); return false; }
  catch (error: any) {
    if (error?.code === "ERA_MESSAGE_WRITE_TARGET_CHANGED") return true;
    throw error;
  }
}
/** 对本次明确字段逐项比较；原生文件第零项为 header。 */
export function assertPersistedMessages(data: any, expected: any[]): void {
  if (!Array.isArray(data)) throw new Error("聊天保存回读没有返回消息数组。");
  for (const item of expected) {
    const message = record(data[item.id + 1]) ? data[item.id + 1] : {};
    const swipe = Number(message.swipe_id ?? 0);
    const swipeText = Array.isArray(message.swipes) ? message.swipes[item.swipe] : swipe === item.swipe ? message.mes : undefined;
    const info = Array.isArray(message.swipe_info) && record(message.swipe_info[item.swipe]) ? message.swipe_info[item.swipe] : {};
    const extra = record(swipe === item.swipe ? message.extra : info.extra) ? (swipe === item.swipe ? message.extra : info.extra) : {};
    if ((swipe === item.swipe && message.mes !== item.text) || swipeText !== item.text ||
      !Object.entries(item.extra).every(([key, value]) => stableStringify(extra[key]) === stableStringify(value)))
      throw new Error(`聊天保存未确认：消息 #${item.id} 的正文、Swipe或ERA附加数据不一致。`);
  }
}
