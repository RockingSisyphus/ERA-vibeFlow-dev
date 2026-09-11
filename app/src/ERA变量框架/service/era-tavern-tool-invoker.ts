/**
 * @file ERA 消息内函数调用到酒馆工具注册表的适配
 * @description 把 `SillyTavern.ToolManager.invokeFunctionTool` 包装成宿主调用器。
 *
 * 关键事实：该接口失败时**不抛异常**，而是返回一个 `Error` 对象。适配层必须原样透传
 * 这个返回值，把「失败/未注册」的判定留给上层分类——如果在这里抛错或把 Error 当成
 * 结果字符串，未注册调用就会被记成成功，作者看到的现象是「函数静默无效」。
 *
 * 同时裸露的 `Error` 通道也有例外：真正的传输异常仍会 reject，这里不吞。
 */

import type { EraToolInvoker } from './era-function-invocation-host';

interface TavernToolManager {
  invokeFunctionTool(name: string, args: Readonly<Record<string, unknown>>): Promise<unknown>;
}

function toolManager(): TavernToolManager | null {
  const container = (globalThis as { SillyTavern?: unknown }).SillyTavern;
  if (container === null || typeof container !== 'object') return null;
  const manager = (container as { ToolManager?: unknown }).ToolManager;
  if (manager === null || typeof manager !== 'object') return null;
  const invoke = (manager as { invokeFunctionTool?: unknown }).invokeFunctionTool;
  if (typeof invoke !== 'function') return null;
  return manager as TavernToolManager;
}

/**
 * 建立调用器。
 *
 * 每次调用都重新解析 ToolManager：脚本热重载或页面实例更换后旧引用会失效，
 * 缓存它会让后续调用打到已经不存在的注册表上。ToolManager 缺失时返回类型化
 * 错误而不是抛异常，保持与「工具失败返回 Error」一致的上层分类路径。
 */
export function createTavernToolInvoker(): EraToolInvoker {
  return {
    async invoke(name, args) {
      const manager = toolManager();
      if (manager === null) {
        return new Error('ERA_TOOL_MANAGER_UNAVAILABLE: 当前酒馆页面没有可用的工具注册表。');
      }
      return manager.invokeFunctionTool(name, args);
    },
  };
}
