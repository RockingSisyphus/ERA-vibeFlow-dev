import { shallowRef } from 'vue';
import { currentTavernContext } from './tavern-browser-host';
import { writeCharacterExtension } from './character-extension-writer';
import { requestEraService, requireAccepted } from './client';
import { ERA_UI_EVENT, type EraCapabilityContext } from './types';

export const SINGLE_FLOOR_KEY = 'era_single_floor';
export const singleFloorSelection = shallowRef<{ characterId: string; chatId: string; enabled: boolean } | null>(null);
/** 每次从当前卡重读，避免把上一聊天的开关或不存在的角色当成可用配置。 */
export function refreshSingleFloorSelection(): void {
  const host = currentTavernContext();
  const character = host.characters[Number(host.characterId)];
  const extension = character?.data?.extensions as unknown as Record<string, unknown> | undefined;
  const config = extension?.[SINGLE_FLOOR_KEY] as { enabled?: boolean } | undefined;
  singleFloorSelection.value =
    host.groupId || !character?.avatar
      ? null
      : {
          characterId: character.avatar,
          chatId: SillyTavern.getCurrentChatId() ?? '',
          enabled: config?.enabled === true,
        };
}
export async function saveSingleFloor(characterId: string, enabled: boolean): Promise<void> {
  const request = requireAccepted(
    requestEraService(ERA_UI_EVENT.UPDATE_SETTINGS, [{ singleFloor: { characterId, enabled } }]),
  );
  const result = await request.done;
  if (result.status !== 'completed')
    throw new Error(`单层模式保存失败：${JSON.stringify(result.error ?? result.status)}`);
  refreshSingleFloorSelection();
}
export async function patchSingleFloor(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext) {
  await writeCharacterExtension(
    String(input.characterId),
    SINGLE_FLOOR_KEY,
    { version: 1, enabled: input.enabled },
    context,
  );
  refreshSingleFloorSelection();
  return { status: 'updated' };
}
