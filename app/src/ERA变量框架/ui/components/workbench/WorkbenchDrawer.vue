<template>
  <section class="workbench-drawer" role="region" :aria-label="title">
    <header class="drawer-header">
      <div>
        <strong>{{ title }}</strong>
        <small v-if="subtitle">{{ subtitle }}</small>
      </div>
      <button type="button" aria-label="关闭编辑器" @click="$emit('close')">×</button>
    </header>
    <div class="drawer-body"><slot /></div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
defineEmits<{ close: [] }>();
</script>

<style scoped>
.workbench-drawer {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 4;
  width: min(92%, 430px);
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-normal);
  background: var(--bg-blur-heavy);
  backdrop-filter: blur(18px);
  box-shadow: -18px 0 40px rgba(0, 0, 0, 0.16);
}
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text-title);
}
.drawer-header div {
  min-width: 0;
  display: grid;
  gap: 3px;
}
.drawer-header small {
  color: var(--text-normal);
  overflow-wrap: anywhere;
}
.drawer-header button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-normal);
  border-radius: 9px;
  background: var(--bg-solid);
  color: var(--text-title);
  cursor: pointer;
}
.drawer-body {
  min-height: 0;
  overflow: auto;
  padding: 16px;
}
@media (max-width: 560px) {
  .workbench-drawer {
    /* EraPanel 提供定位块；移动端编辑器必须锚定在面板内，避免变换祖先将其移出视口。 */
    position: absolute;
    inset: 0;
    width: 100%;
    max-height: none;
    border-left: 0;
    border: 1px solid var(--border-normal);
    border-radius: 18px;
  }
}
</style>
