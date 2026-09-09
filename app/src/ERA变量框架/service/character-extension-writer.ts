import { currentTavernContext } from './tavern-browser-host';
import type { EraCapabilityContext } from './types';

/** 必须按捕获 avatar 保存且成功后才更新镜像，避免切卡串写和失败后的伪成功显示。 */
export async function writeCharacterExtension(
  characterId: string,
  key: string,
  next: unknown,
  context: EraCapabilityContext,
): Promise<void> {
  context.signal.throwIfAborted();
  const tavern = currentTavernContext();
  const index = tavern.characters.findIndex(character => character.avatar === characterId);
  if (index < 0) throw new Error('目标角色卡已不存在');
  const character = tavern.characters[index];
  // 先准备可序列化镜像，避免服务端已成功后才因旧 JSON 损坏报告伪失败。
  const data = character.json_data ? JSON.parse(character.json_data) : undefined;
  if (data) {
    data.data ??= {};
    data.data.extensions ??= {};
    data.data.extensions[key] = next;
  }
  // writeExtensionField 先改镜像且吞掉 HTTP 错误，无法证明保存成功。
  // 使用同一原生接口，确认响应成功后才发布镜像，不触发聊天重绘。
  const response = await fetch('/api/characters/merge-attributes', {
    method: 'POST',
    headers: tavern.getRequestHeaders(),
    signal: context.signal,
    body: JSON.stringify({ avatar: character.avatar, data: { extensions: { [key]: next } } }),
  });
  if (!response.ok) throw new Error(`角色卡设置保存失败：HTTP ${response.status}`);
  character.data.extensions ??= {} as typeof character.data.extensions;
  const extension = character.data.extensions as unknown as Record<string, unknown>;
  extension[key] = next;
  if (data) {
    character.json_data = JSON.stringify(data);
    if (Number(tavern.characterId) === index) {
      const field = window.top?.document.querySelector<HTMLInputElement>('#character_json_data');
      if (field) field.value = character.json_data;
    }
  }
}
