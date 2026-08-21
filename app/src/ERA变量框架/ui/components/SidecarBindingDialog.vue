<template>
  <div
    v-if="prompt !== null"
    class="era-sidecar-overlay"
    role="alertdialog"
    aria-modal="true"
    :aria-label="prompt.kind === 'conflict' ? 'ERA 变量绑定冲突' : 'ERA Sidecar 数据需要修复'"
  >
    <section class="era-sidecar-dialog">
      <template v-if="prompt.kind === 'conflict'">
        <h2>检测到已有 ERA 变量数据</h2>
        <p>此聊天携带的 Sidecar ID 已属于另一张角色卡或聊天。请为当前聊天选择变量来源。</p>
        <div class="era-sidecar-actions">
          <button type="button" @click="choose('migrate')">迁移变量</button>
          <button type="button" @click="choose('independent')">创建独立变量</button>
          <button type="button" @click="choose('copy')">复制变量</button>
        </div>
      </template>
      <template v-else>
        <h2>ERA 本地变量数据需要修复</h2>
        <p>当前聊天的 Sidecar 记录缺失或损坏。请确认以当前聊天可重放的变量状态重建本地镜像。</p>
        <div class="era-sidecar-actions">
          <button type="button" @click="choose('repair')">修复当前聊天</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { requestEraService } from '../../service/client';
import { ERA_UI_EVENT } from '../../service/types';
import { useUiStore } from '../store';

const store = useUiStore();
const { sidecarBindingPrompt: prompt } = storeToRefs(store);

function choose(choice: 'migrate' | 'independent' | 'copy' | 'repair') {
  if (prompt.value === null) return;
  requestEraService(ERA_UI_EVENT.SIDECAR_BINDING_CHOICE, [
    { choice, sidecarId: prompt.value.sidecarId, revision: prompt.value.revision },
  ]);
}
</script>

<style scoped>
.era-sidecar-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: grid;
  /* ERA 根容器默认不接收鼠标事件，Sidecar 决策弹窗必须显式恢复交互，
   * 否则用户无法执行迁移、独立、复制或修复这一必选操作。 */
  pointer-events: auto;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 55%);
}
.era-sidecar-dialog {
  width: min(100%, 440px);
  border-radius: 12px;
  padding: 20px;
  color: var(--SmartThemeBodyColor, #fff);
  background: var(--SmartThemeBlurTintColor, #263242);
  box-shadow: 0 16px 48px rgb(0 0 0 / 45%);
}
.era-sidecar-dialog h2 {
  margin: 0 0 10px;
  font-size: 1.15rem;
}
.era-sidecar-dialog p {
  margin: 0;
  line-height: 1.55;
}
.era-sidecar-actions {
  display: grid;
  gap: 8px;
  margin-top: 18px;
}
.era-sidecar-actions button {
  min-height: 38px;
  white-space: normal;
}
</style>
