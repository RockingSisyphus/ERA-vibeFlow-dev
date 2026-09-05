<template>
  <select :id="controlId" class="ipt" :aria-label="label" :value="modelValue" @change="onChange">
    <option value="placeholder">显示 ERA 休眠占位栏</option>
    <option value="empty">保留空外壳</option>
    <option value="hidden">完全隐藏</option>
  </select>
</template>

<script setup lang="ts">
defineProps<{ modelValue: unknown; controlId: string; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

/** 选项只写入设置草稿，最终合法性仍由统一保存事务校验。 */
function onChange(event: Event): void {
  emit('update:modelValue', (event.target as HTMLSelectElement).value);
}
</script>

<style scoped>
.ipt {
  width: 100%;
}
</style>
