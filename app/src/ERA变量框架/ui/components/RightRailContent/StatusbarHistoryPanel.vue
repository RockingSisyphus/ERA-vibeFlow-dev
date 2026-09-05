<template>
  <section class="history-card" role="region" aria-label="指定显示历史状态栏">
    <button class="card-header" :aria-expanded="open" @click="toggle">
      <span>指定显示历史状态栏</span><span aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </button>
    <div v-show="open" class="content">
      <p class="hint">默认只激活最近 {{ historyRange }} 个状态栏。可在当前页面临时额外显示一楼。</p>
      <div v-if="items.length" class="floor-list">
        <button
          v-for="item in items"
          :key="`${item.messageId}:${item.mk}`"
          class="floor"
          :class="{ selected: item.selected }"
          :disabled="busy"
          @click="selectFloor(item.messageId)"
        >
          <span class="floor-id">#{{ item.messageId }}</span>
          <span class="summary">{{ item.summary || '（无正文摘要）' }}</span>
          <span class="state">{{ item.selected ? '已指定' : item.active ? '范围内' : '休眠' }}</span>
        </button>
      </div>
      <p v-else class="hint">当前聊天没有托管状态栏。</p>
      <button class="clear" :disabled="busy || !hasSelection" @click="clearSelection">取消指定</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { EraStatusbarListItem } from '../../../service/public-api';
import { settings } from '../../../utils/era_data';
import { waitForEraFacade } from '../../utils/facade';

const open = ref(false);
const busy = ref(false);
const items = ref<readonly EraStatusbarListItem[]>([]);
const historyRange = computed(() => settings.value['历史状态栏显示范围']);
const hasSelection = computed(() => items.value.some(item => item.selected));
/** 折叠卡关闭或卸载时必须释放页面级订阅。 */
let unsubscribe = (): void => undefined;

async function refresh(): Promise<void> {
  const api = await waitForEraFacade();
  items.value = api.statusbar.list();
}

async function toggle(): Promise<void> {
  open.value = !open.value;
  if (!open.value) return;
  const api = await waitForEraFacade();
  unsubscribe();
  /** 任一 Sidecar 发布只重读楼层摘要，不在 UI 中重算历史快照。 */
  const onState = (): void => void refresh();
  unsubscribe = api.subscribe(onState);
  await refresh();
}

async function selectFloor(messageId: number): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    const api = await waitForEraFacade();
    await api.statusbar.select(messageId);
    await refresh();
  } finally {
    busy.value = false;
  }
}

async function clearSelection(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    const api = await waitForEraFacade();
    api.statusbar.clearSelection();
    await refresh();
  } finally {
    busy.value = false;
  }
}

onBeforeUnmount(() => unsubscribe());
</script>

<style scoped>
.history-card {
  width: 100%;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  background: var(--settings-bg-glass);
  box-shadow: var(--settings-shadow-card), var(--settings-shadow-inset);
}
.card-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  background: var(--chip-bg);
  color: var(--text-title);
  font-weight: 800;
  cursor: pointer;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}
.floor-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.floor {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--border-soft);
  border-radius: 9px;
  background: var(--chip-bg);
  color: var(--text-normal);
  text-align: left;
  cursor: pointer;
}
.floor.selected {
  border-color: var(--accent-primary);
}
.floor-id,
.state {
  font-size: 11px;
  white-space: nowrap;
}
.summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.clear {
  align-self: flex-end;
  padding: 6px 10px;
  border: 1px solid var(--border-normal);
  border-radius: 8px;
  background: var(--chip-bg);
  color: var(--text-normal);
  cursor: pointer;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
