/**
 * @file ERA 后置通知的统一路由
 * @description 只处理「必须变成一次真实新事件」的通知：生成阶段完成与消息内函数调用
 * 交接；其余通知按原样交给 Tavern 事件发射。
 *
 * 为什么要单独成模块：这两条分支都必须回到 Service FIFO 才能继续，而它们各自的
 * 驱动细节（生成等待、函数执行与位置门面）不属于适配器自身的生命周期职责；留在
 * `tavern-adapter` 里会让适配器继续膨胀并让「谁负责驱动」变得含混。
 */

import type { EraFunctionsRuntime } from './era-functions-capability';
import { dispatchMessageFunctionHandoff } from './era-message-function-handoff-host';
import { dispatchGenerationHandoff } from './generation-handoff-host';
import type { EraAdmissionResult, EraCapabilityContext, EraEventSource, EraPreparedNotification } from './types';

/**
 * 路由一条后置通知所需的全部依赖。
 *
 * 四条依赖都必须由适配器注入：通知本体与终止信号来自当前后置阶段，`enqueue` 是
 * 唯一回 Service 的入口，`functionsRuntime` 持有位置绑定门面；缺任何一条都无法把
 * 通知变成真实新事件，因此不做默认值。
 */
export interface EraNotificationRouteInput {
  readonly notification: EraPreparedNotification;
  readonly context: EraCapabilityContext;
  readonly enqueue: (
    type: string,
    source: Exclude<EraEventSource, 'timer'>,
    args: readonly unknown[],
  ) => EraAdmissionResult;
  readonly functionsRuntime: EraFunctionsRuntime;
}

/**
 * 路由一条后置通知。
 *
 * 返回 true 表示这条通知已经由专门驱动处理完毕（它自己会入队后续事件），调用方
 * **不得**再把它当普通事件发射，否则作者会看到同一条通知触发两次。
 */
export async function routeEraNotification(input: EraNotificationRouteInput): Promise<boolean> {
  const { notification, context, enqueue, functionsRuntime } = input;
  if (notification.type === 'era.agent.stage_completed') {
    await dispatchGenerationHandoff(notification, context.signal, enqueue);
    return true;
  }
  // 函数调用交接：在步骤之外驱动函数，再把终态与产出操作作为新事件送回 Service。
  if (notification.type === 'era.message.invoke_required') {
    await dispatchMessageFunctionHandoff(notification, context.signal, enqueue, functionsRuntime);
    return true;
  }
  return false;
}
