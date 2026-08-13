/**
 * UI 消息 ID 的唯一提交边界。Vue 的 `.number` 只负责尽量转换输入值，
 * 不能保证运行时值一定是数字、整数或处于 JavaScript 安全整数范围内。
 */
export function isNonNegativeSafeMessageId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
