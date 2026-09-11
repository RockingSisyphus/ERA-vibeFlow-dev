/**
 * @file 消息内函数调用的 Host 后置交接
 * @description 收到 Service 的 `era.message.invoke_required` 后，在**步骤之外**驱动
 * 一次作者函数，再把终态与函数产出的操作以 `era.message.invoke_continue` 作为真实
 * 新事件送回 Service——不是新的调度器，只是把「函数结束」变成一次正常入队。
 *
 * 为什么不占用 FIFO 等待：通知发生在 FIFO 片段之后，函数可能等待酒馆交互或生成；
 * 若在这里阻塞 FIFO，双方互等，工作流永不前进。
 */

import type { EraFunctionsRuntime } from './era-functions-capability';
import type { EraAdmissionResult, EraEventSource, EraPreparedNotification } from './types';

export const MESSAGE_FUNCTION_INVOKE_REQUIRED = 'era.message.invoke_required';
export const MESSAGE_FUNCTION_INVOKE_CONTINUE = 'era.message.invoke_continue';

interface FunctionHandoffV1 {
  readonly messageId: number;
  readonly mk: string;
  readonly callId: string;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 解析交接载荷。
 *
 * 缺字段时**不执行**函数：没有位置就没有绑定上下文，凭空执行只会把操作写到错误的
 * 位置上。这里的拒绝是静默的——Service 侧会因为消息仍未处理而保留待处理状态。
 */
export function functionHandoffOf(notification: EraPreparedNotification): FunctionHandoffV1 | null {
  if (notification.type !== MESSAGE_FUNCTION_INVOKE_REQUIRED) return null;
  const value = notification.args[0];
  if (!isRecord(value)) return null;
  const messageId = value.messageId;
  const callId = value.callId;
  const name = value.name;
  if (!Number.isSafeInteger(messageId) || typeof callId !== 'string' || callId.length === 0) return null;
  if (typeof name !== 'string' || name.length === 0) return null;
  return {
    messageId: Number(messageId),
    mk: typeof value.mk === 'string' ? value.mk : '',
    callId,
    name,
    args: isRecord(value.args) ? value.args : {},
    stat: value.stat,
    statFunc: isRecord(value.statFunc) ? value.statFunc : {},
  };
}

/**
 * 在调用位置驱动一次函数并把结果作为新事件送回。
 *
 * 恢复事件必须携带终态与操作：Service 会把操作写成调用块下方的操作区并让整条消息
 * 按原文位置重放；只回送「成功」而丢掉操作会让函数效果凭空消失。
 */
export async function dispatchMessageFunctionHandoff(
  notification: EraPreparedNotification,
  signal: AbortSignal,
  enqueue: (type: string, source: Exclude<EraEventSource, 'timer'>, args: readonly unknown[]) => EraAdmissionResult,
  runtime: EraFunctionsRuntime,
): Promise<void> {
  const handoff = functionHandoffOf(notification);
  if (handoff === null) return;
  if (signal.aborted) return;
  const invoked = await runtime.drive({
    // 调用标识必须稳定且逐次唯一：同一条消息里同名同参的两处调用各自独立。
    invocationId: `${handoff.mk}#${handoff.callId}`,
    name: handoff.name,
    args: handoff.args,
    messageId: handoff.messageId,
    mk: handoff.mk,
    stat: handoff.stat,
    statFunc: handoff.statFunc,
  });
  if (signal.aborted) return;
  const admission = enqueue(MESSAGE_FUNCTION_INVOKE_CONTINUE, 'era-api', [
    {
      messageId: handoff.messageId,
      mk: handoff.mk,
      callId: handoff.callId,
      name: handoff.name,
      status: invoked.outcome.status,
      result: invoked.outcome.result,
      message: invoked.outcome.message,
      unregistered: invoked.outcome.unregistered,
      operations: invoked.operations,
    },
  ]);
  if (!admission.accepted) throw new Error(admission.message);
  await admission.done;
}
