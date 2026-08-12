/**
 * @file ERA 宏模块兼容入口
 *
 * `src/ERA变量框架/index.ts` 仍然通过导入本文件启动宏功能。具体职责已经拆分为：
 * - `syntax.ts`：无浏览器依赖的纯解析规则；
 * - `registration.ts`：酒馆助手宏的注册与卸载；
 * - `dom-refresh.ts`：状态提交后的消息显示刷新。
 */

import { removeMetaFields } from '../utils/era_data';
import { registerEraMacroDomRefresh } from './dom-refresh';
import { readCurrentEraMacroSnapshot, registerEraMacro } from './registration';
import {
  parseEraMacroText,
  type EraMacroSnapshot,
  containsEraMacro,
  createEraMacroRegex,
  parseEraMacroContent,
  parseEraMacroPrompt,
} from './syntax';

export {
  containsEraMacro,
  createEraMacroRegex,
  parseEraMacroContent,
  parseEraMacroPrompt,
  parseEraMacroText,
  type EraMacroSnapshot,
};

/**
 * 保留旧模块的便捷解析接口。
 *
 * 新代码若已经持有状态快照，应直接调用 `parseEraMacroText`；
 * 仅省略快照时，本兼容函数才会同步读取当前 ERA 状态。
 */
export function parseEraMacros(text: string, statWithMeta?: object | null, statWithoutMeta?: object | null): string {
  let currentSnapshot: EraMacroSnapshot | null = null;
  const readSnapshot = () => (currentSnapshot ??= readCurrentEraMacroSnapshot());
  const currentStat = statWithMeta ?? readSnapshot().statWithMeta;
  return parseEraMacroText(text, {
    statWithMeta: currentStat,
    statWithoutMeta:
      statWithoutMeta ?? (statWithMeta == null ? readSnapshot().statWithoutMeta : removeMetaFields(currentStat)),
  });
}

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
