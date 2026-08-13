<template>
  <aside class="right-rail">
    <div class="right-rail-content-wrapper">
      <ActionButtons />
      <EraSettingsPanel />
      <AboutEra />
    </div>
  </aside>
</template>

<script setup lang="ts">
import AboutEra from './RightRailContent/AboutEra.vue';
import ActionButtons from './RightRailContent/ActionButtons.vue';
import EraSettingsPanel from './RightRailContent/EraSettingsPanel.vue';
</script>

<style scoped>
.right-rail {
  flex: 1 1 420px;
  min-width: 0;
  max-width: 100%;
  height: var(--era-region-height);
  align-self: flex-start;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.right-rail-content-wrapper {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  overflow-x: clip;
  overscroll-behavior: contain;
  flex-grow: 1;
}
</style>
