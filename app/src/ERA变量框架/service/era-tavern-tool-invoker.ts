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

/**
 * 按「顶层窗口优先、当前全局兜底」解析酒馆容器。
 *
 * ERA 运行在 Tavern Helper 的脚本 iframe 内，而工具是注册在**顶层页面**的
 * `SillyTavern` 上下文里的（实测脚本 iframe 内的 `SillyTavern` 没有 ToolManager，
 * 直接读它会得到 ERA_TOOL_MANAGER_UNAVAILABLE）。同源 iframe 可以安全地读顶层，
 * 跨源读取会抛异常，因此必须逐个候选兜底而不是一次性取定。
 */
function tavernContainers(): readonly unknown[] {
  const containers: unknown[] = [];
  try {
    const top = window.top;
    if (top !== null && top !== window) {
      containers.push((top as unknown as { SillyTavern?: unknown }).SillyTavern);
    }
  } catch {
    // 跨源访问顶层被拒绝：忽略这个候选，继续用当前全局。
  }
  containers.push((globalThis as { SillyTavern?: unknown }).SillyTavern);
  return containers;
}

function toolManager(): TavernToolManager | null {
  for (const container of tavernContainers()) {
    if (container === null || typeof container !== 'object') continue;
    const manager = (container as { ToolManager?: unknown }).ToolManager;
    if (manager === null || typeof manager !== 'object') continue;
    const invoke = (manager as { invokeFunctionTool?: unknown }).invokeFunctionTool;
    if (typeof invoke !== 'function') continue;
    return manager as TavernToolManager;
  }
  return null;
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
