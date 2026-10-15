import { shallowRef } from 'vue';
import { currentTavernContext } from './tavern-browser-host';
import { requestEraService, requireAccepted } from './client';
import { ERA_UI_EVENT } from './types';

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
