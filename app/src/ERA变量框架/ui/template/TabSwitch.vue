<template>
  <section class="tabs">
    <!-- 页签行 -->
    <div class="tab-bar" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab-btn"
        :class="{ active: t.key === innerActive }"
        role="tab"
        @click="setActive(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- 内容区：根据活动键渲染对应插槽 -->
    <div class="tab-content">
      <div>
        <slot :name="innerActive" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Logger } from '../../utils/log';

type TabItem = { key: string; label: string };

const logger = new Logger();
const props = defineProps<{ tabs: TabItem[]; active?: string }>();
const emit = defineEmits<{ 'update:active': [string] }>();

const innerActive = ref(props.active ?? 'pure');

watch(
  () => props.active,
  v => {
    if (v) {
      logger.debug('watch:active', `外部同步 active tab 为: ${v}`);
      innerActive.value = v;
    }
  },
); // 外部变更时同步
function setActive(k: string) {
  logger.debug('setActive', `用户点击，切换 tab 到: ${k}`);
  innerActive.value = k;
  emit('update:active', k);
} // 切换并抛出
</script>

<style scoped>
.tabs {
  min-width: 0;
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  overflow: hidden;
  background: var(--accordion-bg);
  transition:
    background 0.3s ease,
    border-color 0.3s ease;
}
.tab-bar {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--mk-pill-null-bg);
  transition:
    background 0.3s ease,
    border-color 0.3s ease;
}
.tab-btn {
  flex: 1 1 0;
  min-width: 0;
  padding: 8px 12px;
  font-weight: 800;
  font-size: 13px;
  color: var(--text-normal);
  background: var(--bg-solid);
  border: 1px solid var(--settings-border-input);
  border-radius: 10px;
  cursor: pointer;
  white-space: normal;
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    box-shadow 0.3s ease;
}
.tab-btn.active {
  color: var(--settings-text-input);
  border-color: var(--settings-border-btn-primary);
  box-shadow: var(--settings-shadow-inset), var(--tab-active-shadow);
}
.tab-content {
  padding: 10px 12px;
  background: var(--tab-content-bg);
  transition: background 0.3s ease;
}
</style>
