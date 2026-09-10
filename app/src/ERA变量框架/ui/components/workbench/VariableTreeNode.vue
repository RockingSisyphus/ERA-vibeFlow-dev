<template>
  <li v-if="matchesFilter" class="variable-node">
    <div class="variable-row" :style="{ paddingLeft: `${depth * 14 + 8}px` }">
      <button
        v-if="isObject"
        class="tree-toggle"
        type="button"
        :aria-label="`${expanded ? '折叠' : '展开'}变量 ${label}`"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? '▾' : '▸' }}
      </button>
      <span v-else class="tree-spacer" aria-hidden="true">·</span>
      <span class="variable-name">{{ label }}</span>
      <span class="type-chip">{{ typeLabel }}</span>
      <span v-if="protectedLabel" class="lock-chip">{{ protectedLabel }}</span>
      <span class="variable-summary">{{ summary }}</span>
      <span class="row-actions">
        <button type="button" :aria-label="`编辑变量 ${pathLabel}`" @click="$emit('edit', path)">编辑</button>
        <button v-if="isObject" type="button" :aria-label="`在变量 ${pathLabel} 中新增`" @click="$emit('add', path)">
          新增
        </button>
        <button class="danger" type="button" :aria-label="`删除变量 ${pathLabel}`" @click="$emit('remove', path)">
          删除
        </button>
      </span>
    </div>
    <ul v-if="isObject && expanded" class="variable-children">
      <VariableTreeNode
        v-for="childKey in childKeys"
        :key="childKey"
        :label="childKey"
        :value="objectValue[childKey]"
        :path="[...path, childKey]"
        :depth="depth + 1"
        :filter="filter"
        @edit="$emit('edit', $event)"
        @add="$emit('add', $event)"
        @remove="$emit('remove', $event)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

defineOptions({ name: 'VariableTreeNode' });

const props = defineProps<{
  label: string;
  value: unknown;
  path: readonly string[];
  depth: number;
  filter: string;
}>();

defineEmits<{
  edit: [path: readonly string[]];
  add: [path: readonly string[]];
  remove: [path: readonly string[]];
}>();

const expanded = ref(props.depth < 1);
const isObject = computed(() => props.value !== null && typeof props.value === 'object' && !Array.isArray(props.value));
const objectValue = computed(() => (isObject.value ? (props.value as Record<string, unknown>) : {}));
const childKeys = computed(() => Object.keys(objectValue.value));
const pathLabel = computed(() => props.path.join('.'));
const searchNeedle = computed(() => props.filter.trim().toLocaleLowerCase());
watch(
  searchNeedle,
  needle => {
    if (needle) expanded.value = true;
  },
  { immediate: true },
);
const matchesFilter = computed(() => {
  if (!searchNeedle.value) return true;
  return matchesVariable(props.value, pathLabel.value, searchNeedle.value);
});
function matchesVariable(value: unknown, path: string, needle: string): boolean {
  if (path.toLocaleLowerCase().includes(needle)) return true;
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).some(([key, child]) => matchesVariable(child, `${path}.${key}`, needle));
  }
  return String(typeof value === 'string' ? value : JSON.stringify(value))
    .toLocaleLowerCase()
    .includes(needle);
}
const typeLabel = computed(() => {
  if (props.value === null) return 'null';
  if (Array.isArray(props.value)) return `数组 ${props.value.length}`;
  if (isObject.value) return `对象 ${childKeys.value.length}`;
  return typeof props.value;
});
const summary = computed(() => {
  if (isObject.value) return `{ ${childKeys.value.slice(0, 3).join(', ')}${childKeys.value.length > 3 ? '…' : ''} }`;
  if (Array.isArray(props.value)) return JSON.stringify(props.value).slice(0, 80);
  if (typeof props.value === 'string') return JSON.stringify(props.value).slice(0, 80);
  return String(props.value);
});
const protectedLabel = computed(() => {
  const meta =
    isObject.value && objectValue.value.$meta && typeof objectValue.value.$meta === 'object'
      ? (objectValue.value.$meta as Record<string, unknown>)
      : null;
  if (!meta) return '';
  const labels = [];
  if (meta.updatable === false) labels.push('禁改');
  if (typeof meta.necessary === 'string') labels.push(`必需:${meta.necessary}`);
  if (typeof meta.unInsertAble === 'string') labels.push(`禁增:${meta.unInsertAble}`);
  return labels.join(' · ');
});
</script>

<style scoped>
.variable-node,
.variable-children {
  margin: 0;
  padding: 0;
  list-style: none;
}
.variable-row {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 7px;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text-normal);
}
.variable-row:hover {
  background: var(--json-hover-bg);
}
.tree-toggle,
.tree-spacer {
  flex: 0 0 22px;
  width: 22px;
  border: 0;
  background: transparent;
  color: var(--text-normal);
}
.tree-toggle {
  cursor: pointer;
}
.variable-name {
  min-width: 72px;
  color: var(--text-title);
  font-weight: 700;
  overflow-wrap: anywhere;
}
.type-chip,
.lock-chip {
  flex: 0 0 auto;
  border-radius: 999px;
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--chip-text);
  padding: 2px 7px;
  font-size: 10px;
}
.lock-chip {
  border-color: #fca5a5;
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.72);
}
.variable-summary {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}
.row-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
  padding-right: 8px;
}
.row-actions button {
  border: 1px solid var(--border-normal);
  border-radius: 7px;
  background: var(--bg-solid);
  color: var(--text-subtitle);
  padding: 4px 7px;
  cursor: pointer;
  font-size: 11px;
}
.row-actions .danger {
  color: #b91c1c;
}
@media (max-width: 560px) {
  .variable-row {
    flex-wrap: wrap;
    padding-block: 7px;
  }
  .variable-summary {
    order: 5;
    flex-basis: calc(100% - 42px);
    margin-left: 29px;
  }
  .row-actions {
    margin-left: auto;
  }
}
</style>
