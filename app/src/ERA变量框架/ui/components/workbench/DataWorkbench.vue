<template>
  <div class="data-workbench">
    <nav class="workbench-tabs" aria-label="变量与函数工作台">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="active === tab.key"
        :class="{ active: active === tab.key }"
        @click="active = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.count !== null">{{ tab.count }}</span>
      </button>
    </nav>
    <VariableWorkspace
      v-if="active === 'variables'"
      :data="data.statData"
      :stat-func="data.statFunc"
      :revision="data.revision"
      :identity-key="identityKey"
    />
    <FunctionWorkspace
      v-else-if="active === 'functions'"
      :library="data.statFunc"
      :revision="data.revision"
      :identity-key="identityKey"
    />
    <SnapshotManager v-else :latest-data="data" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EraPublicState } from '../../../service/public-api';
import SnapshotManager from '../SnapshotManager.vue';
import FunctionWorkspace from './FunctionWorkspace.vue';
import VariableWorkspace from './VariableWorkspace.vue';

const props = defineProps<{ data: EraPublicState }>();
const active = ref<'variables' | 'functions' | 'history'>('variables');
const identityKey = computed(() => JSON.stringify(props.data.identity ?? null));
const variableCount = computed(() =>
  props.data.statData !== null && typeof props.data.statData === 'object' && !Array.isArray(props.data.statData)
    ? Object.keys(props.data.statData as Record<string, unknown>).length
    : 0,
);
const functionCount = computed(() => Object.keys(props.data.statFunc).length);
const tabs = computed(() => [
  { key: 'variables' as const, label: '当前变量', count: variableCount.value },
  { key: 'functions' as const, label: '当前函数', count: functionCount.value },
  { key: 'history' as const, label: '历史快照', count: null },
]);
</script>

<style scoped>
.data-workbench {
  display: grid;
  gap: 10px;
}
.workbench-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 5px;
  border: 1px solid var(--border-normal);
  border-radius: 12px;
  background: var(--bg-soft);
}
.workbench-tabs button {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--text-normal);
  padding: 9px 7px;
  cursor: pointer;
  font-weight: 700;
}
.workbench-tabs button.active {
  border-color: var(--border-normal);
  background: var(--bg-solid);
  color: var(--text-title);
  box-shadow: var(--shadow-button);
}
.workbench-tabs span {
  min-width: 19px;
  border-radius: 999px;
  background: var(--mk-pill-bg);
  color: var(--mk-pill-text);
  padding: 1px 5px;
  font-size: 10px;
}
</style>
