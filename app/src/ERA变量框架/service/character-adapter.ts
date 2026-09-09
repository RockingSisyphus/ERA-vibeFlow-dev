import { createCharacterGreetingAdapter } from './character-greeting-adapter';
import { patchExternalStatusbar } from './external-statusbar-configuration';
import { patchSingleFloor } from './single-floor-configuration';

/** 角色卡能力集中接线，避免增加一个扩展就继续扩大主宿主适配器。 */
export function createCharacterAdapter(check: (signal: AbortSignal) => void) {
  return {
    ...createCharacterGreetingAdapter(check),
    patch_external_statusbar: patchExternalStatusbar,
    patch_single_floor: patchSingleFloor,
  };
}
