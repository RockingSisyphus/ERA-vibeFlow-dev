<template>
  <div class="var-row">
    <label for="era-single-floor-enabled">单层模式</label>
    <input id="era-single-floor-enabled" v-model="enabled" type="checkbox" :disabled="busy || !singleFloorSelection" />
    <span class="hint">{{ singleFloorSelection ? '随角色卡保存；只显示最后 AI 回复' : '当前无可用的单角色卡' }}</span>
    <p class="hint">旧楼脚本停止，临时表单不保留；查看或编辑旧楼请关闭。恢复显示会重新执行加载脚本。</p>
    <p v-if="singleFloorDiagnostic" role="alert">{{ singleFloorDiagnostic }}</p>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { singleFloorSelection, saveSingleFloor } from '../../../service/single-floor-configuration';
import { singleFloorDiagnostic } from '../../../service/single-floor-runtime';
defineProps<{ busy: boolean }>();
const enabled = ref(false);
let characterId: string | null = null;
/** 保存时使用读取草稿时的角色，避免切卡后误写新的角色。 */
function load() {
  enabled.value = singleFloorSelection.value?.enabled ?? false;
  characterId = singleFloorSelection.value?.characterId ?? null;
}
async function save() {
  if (characterId && enabled.value !== singleFloorSelection.value?.enabled) {
    await saveSingleFloor(characterId, enabled.value);
  }
}
defineExpose({ load, save });
</script>

<style scoped>
.hint {
  color: var(--text-muted);
  font-size: 12px;
}
p {
  grid-column: 1 / -1;
  margin: 0;
  line-height: 1.5;
}
[role='alert'] {
  color: var(--text-danger, #ffad93);
}
</style>
