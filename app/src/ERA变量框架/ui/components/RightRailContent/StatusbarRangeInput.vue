<template>
  <input
    :id="controlId"
    class="ipt"
    type="number"
    min="0"
    step="1"
    :aria-label="label"
    :placeholder="String(savedValue)"
    :value="modelValue"
    @input="onInput"
  />
</template>

<script setup lang="ts">
defineProps<{ modelValue: unknown; savedValue: unknown; controlId: string; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

/** 输入只转换为数字草稿，非负整数约束仍由整体设置事务统一决定。 */
function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).valueAsNumber);
}
</script>

<style scoped>
.ipt {
  width: 100%;
}
</style>
