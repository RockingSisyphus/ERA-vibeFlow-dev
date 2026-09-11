/**
 * @file 消息内函数调用的宿主能力装配
 * @description 把 `era.tavern.functions` 的三个操作装配成适配层可注入的能力对象。
 *
 * 为什么单独成模块：这段装配包含位置绑定 apply 的语义决定（就地应用、绝不入队），
 * 与适配器自身的生命周期、事件监听、消息写入职责无关；放在适配器里会同时推高它
 * 的函数数与行数，也会让「谁拥有位置绑定状态」变得含混。
 */

import { EraFunctionOperationsHost } from './era-function-operations-host';
import { createTavernToolInvoker } from './era-tavern-tool-invoker';
import type { EraCapabilityContext, EraTavernAdapter } from './types';

export type EraFunctionsCapability = EraTavernAdapter['functions'];

/**
 * 建立消息内函数调用的宿主能力。
 *
 * 位置绑定的 `apply` 只做「就地应用 + 计数」：真正的状态推进由 Service 侧的消息
 * 函数流程负责。宿主复制一套变量引擎会让两侧状态分歧，而入队则会让处理该消息的
 * FIFO 事件与等待函数返回的自身互等。
 *
 * `invoke` 只表示已受理，不表示函数已完成；终态由 `result` 回送，工具失败以返回值
 * 表达（酒馆的 invokeFunctionTool 失败时返回 Error 对象而不是抛异常）。
 */
export function createEraFunctionsCapability(): EraFunctionsCapability {
  const host = new EraFunctionOperationsHost(createTavernToolInvoker(), () => ({ sequence: 1 }));
  return {
    invoke: (input: Readonly<Record<string, unknown>>, _context: EraCapabilityContext) =>
      host.invoke(input as never).then(() => ({ status: 'accepted' as const })),
    result: (input: Readonly<Record<string, unknown>>, _context: EraCapabilityContext) => host.result(input as never),
    release: (input: Readonly<Record<string, unknown>>, _context: EraCapabilityContext) => {
      host.release(input as never);
      return { released: true };
    },
  };
}
