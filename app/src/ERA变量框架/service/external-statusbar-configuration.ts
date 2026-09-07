import { shallowRef } from 'vue';
import { currentTavernContext } from './tavern-browser-host';
import { requestEraService, requireAccepted } from './client';
import { ERA_UI_EVENT, type EraCapabilityContext } from './types';

export const EXTERNAL_STATUSBAR_KEY = 'era_external_statusbar';
/** 可分享的角色卡配置，不包含聊天状态或运行时引用。 */
export interface ExternalStatusbarConfig {
  version: 1;
  enabled: boolean;
  html: string;
}
/** 当前页面选中的角色与聊天，作为 UI 会话重建依据。 */
export interface ExternalStatusbarSelection {
  characterId: string;
  chatId: string;
  config: ExternalStatusbarConfig;
}

export function readExternalConfig(value: unknown): ExternalStatusbarConfig {
  const source = value && typeof value === 'object' ? (value as Partial<ExternalStatusbarConfig>) : {};
  return { version: 1, enabled: source.enabled === true, html: typeof source.html === 'string' ? source.html : '' };
}

export const externalStatusbarSelection = shallowRef<ExternalStatusbarSelection | null>(null);

/** 必须从宿主角色镜像读取，避免把上一聊天配置展示给新角色。 */
export function refreshExternalStatusbarSelection(): void {
  const tavern = currentTavernContext();
  const character = tavern.characters[Number(tavern.characterId)];
  if (tavern.groupId || !character?.avatar) {
    externalStatusbarSelection.value = null;
    return;
  }
  externalStatusbarSelection.value = {
    characterId: character.avatar,
    chatId: SillyTavern.getCurrentChatId() ?? '',
    config: readExternalConfig(
      (character.data?.extensions as unknown as Record<string, unknown>)?.[EXTERNAL_STATUSBAR_KEY],
    ),
  };
}

/** 为保证串行 receipt 与错误真实可见，保存必须经过唯一 Service 队列。 */
export async function saveExternalStatusbar(
  characterId: string,
  patch: Partial<Pick<ExternalStatusbarConfig, 'enabled' | 'html'>>,
): Promise<void> {
  const admission = requireAccepted(
    requestEraService(ERA_UI_EVENT.UPDATE_SETTINGS, [{ externalStatusbar: { characterId, patch } }]),
  );
  const result = await admission.done;
  if (result.status !== 'completed')
    throw new Error(`外置状态栏保存失败：${JSON.stringify(result.error ?? result.status)}`);
  refreshExternalStatusbarSelection();
}

/** 必须按捕获的 avatar 寻址，避免异步保存误写新选中的角色卡。 */
export async function patchExternalStatusbar(
  input: Readonly<Record<string, unknown>>,
  context: EraCapabilityContext,
): Promise<unknown> {
  context.signal.throwIfAborted();
  const tavern = currentTavernContext();
  const index = tavern.characters.findIndex(character => character.avatar === input.characterId);
  if (index < 0) throw new Error('外置状态栏目标角色卡已不存在');
  const character = tavern.characters[index];
  const config = readExternalConfig(
    (character.data?.extensions as unknown as Record<string, unknown>)?.[EXTERNAL_STATUSBAR_KEY],
  );
  const next = { ...config, ...(input.patch as Partial<ExternalStatusbarConfig>), version: 1 };
  // 先准备可序列化镜像，避免服务端已成功后才因旧 JSON 损坏报告伪失败。
  const data = character.json_data ? JSON.parse(character.json_data) : undefined;
  if (data) {
    data.data ??= {};
    data.data.extensions ??= {};
    data.data.extensions[EXTERNAL_STATUSBAR_KEY] = next;
  }
  // writeExtensionField 先改镜像且吞掉 HTTP 错误，无法证明保存成功。
  // 使用同一原生接口，确认响应成功后才发布镜像，不触发聊天重绘。
  const response = await fetch('/api/characters/merge-attributes', {
    method: 'POST',
    headers: tavern.getRequestHeaders(),
    signal: context.signal,
    body: JSON.stringify({ avatar: character.avatar, data: { extensions: { [EXTERNAL_STATUSBAR_KEY]: next } } }),
  });
  if (!response.ok) throw new Error(`外置状态栏保存失败：HTTP ${response.status}`);
  character.data.extensions ??= {} as typeof character.data.extensions;
  const extension = character.data.extensions as unknown as Record<string, unknown>;
  extension[EXTERNAL_STATUSBAR_KEY] = next;
  if (data) {
    character.json_data = JSON.stringify(data);
    if (Number(tavern.characterId) === index) {
      const field = window.top?.document.querySelector<HTMLInputElement>('#character_json_data');
      if (field) field.value = character.json_data;
    }
  }
  refreshExternalStatusbarSelection();
  return { status: 'updated' };
}
