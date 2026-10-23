/**
 * @file ERA 宏子系统的注册与释放
 *
 * `src/ERA变量框架/index.ts` 仍然通过导入本文件启动宏功能。本模块组合以下职责：
 * - `syntax.ts`：向同步 Macro AOT 传入文本和快照；
 * - `registration.ts`：酒馆助手宏的注册与卸载；
 * - `dom-refresh.ts`：状态提交后的消息显示刷新。
 */

import { registerEraMacroDomRefresh } from './dom-refresh';
import { registerEraMacro } from './registration';

/**
 * 启动 ERA 宏子系统，并返回幂等的停止函数。
 *
 * 为了避免热重载累加宏监听器，生产入口统一编排 Service、宏和 UI 的
 * 先后顺序；本模块不得再依赖 document-ready 或 pagehide 的隐式注册。
 */
export function startEraMacroSubsystem(): () => void {
  const unregisterMacro = registerEraMacro();
  const unregisterDomRefresh = registerEraMacroDomRefresh();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    unregisterDomRefresh();
    unregisterMacro();
  };
}
