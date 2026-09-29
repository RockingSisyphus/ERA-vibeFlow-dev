/** 只持有阶段等待 Promise；业务续体保存在 Service 会话，恢复由原 FIFO 执行。 */
import type { EraGenerationCompletion } from './generation-subscriptions';
import type { EraAdmissionResult, EraPreparedNotification, EraEventSource, EraSettlement } from './types';
import { generationSubscriptions } from './generation-subscriptions';
class GenerationHandoffHost {
  private readonly pending = new Map<
    string,
    { promise: Promise<EraSettlement | null>; resolve: (value: EraSettlement | null) => void }
  >();
  has(id: string): boolean {
    return this.pending.has(id);
  }
  open(id: string): void {
    if (this.pending.has(id)) return;
    let resolve!: (value: EraSettlement | null) => void;
    const promise = new Promise<EraSettlement | null>(done => {
      resolve = done;
    });
    this.pending.set(id, { promise, resolve });
  }
  wait(id: string): Promise<EraSettlement | null> {
    return this.pending.get(id)?.promise ?? Promise.resolve(null);
  }
  async waitCurrent(): Promise<void> {
    await Promise.all([...this.pending.values()].map(item => item.promise));
  }
  finish(id: string, result: EraSettlement | null): void {
    this.pending.get(id)?.resolve(result);
    this.pending.delete(id);
  }
  cancel(): void {
    generationSubscriptions.cancel();
    for (const id of this.pending.keys()) this.finish(id, null);
  }
}
export const generationHandoffs = new GenerationHandoffHost();

/** 后置通知只回送恢复标识，不能持有 FIFO 执行锁等待用户提交。 */
export async function dispatchGenerationHandoff(
  notification: EraPreparedNotification,
  signal: AbortSignal,
  enqueue: (type: string, source: Exclude<EraEventSource, 'timer'>, args: readonly unknown[]) => EraAdmissionResult,
): Promise<void> {
  const completion = notification.args[0] as EraGenerationCompletion;
  if (!generationHandoffs.has(completion.completionId)) return;
  try {
    const proceed = await generationSubscriptions.publish(completion);
    if (signal.aborted || !generationHandoffs.has(completion.completionId)) {
      generationHandoffs.finish(completion.completionId, null);
      return;
    }
    const admission = enqueue('era.agent.stage_continue', 'era-api', [
      {
        completionId: completion.completionId,
        ...(!proceed ? { cancelled: true } : {}),
      },
    ]);
    if (!admission.accepted) throw new Error(admission.message);
    let result = await admission.done;
    if (!proceed) {
      generationHandoffs.finish(completion.completionId, null);
      return;
    }
    const value = result.value as { completionId?: string } | undefined;
    if (value?.completionId) {
      const final = await generationHandoffs.wait(value.completionId);
      if (!final) {
        generationHandoffs.finish(completion.completionId, null);
        return;
      }
      result = final;
    }
    generationHandoffs.finish(completion.completionId, result);
  } catch (error) {
    generationHandoffs.finish(completion.completionId, null);
    throw error;
  }
}

/** UI 必须等待整个重生成，否则收到片段 receipt 就会错误解除按钮 busy；FIFO 保持原始回执。 */
export function generationAdmission(type: string, admission: EraAdmissionResult): EraAdmissionResult {
  if (!admission.accepted || type !== 'era.ui.agent_retry') return admission;
  const done = admission.done.then(async result => {
    const value = result.value as { completionId?: string } | undefined;
    if (!value?.completionId) return result;
    const final = await generationHandoffs.wait(value.completionId);
    return final
      ? { ...final, eventId: result.eventId, sequence: result.sequence }
      : { ...result, status: 'cancelled' as const, reason: '生成会话已取消' };
  });
  return { ...admission, done };
}

/** 因为旧页面等待已失去来源，新生成与导航取消它；后续业务路径仍由 Service 决定。 */
export function cancelGenerationWaitForEvent(type: string, args: readonly unknown[]): void {
  if (
    ['message_sent', 'generation_stopped', 'message_swiped', 'chat_id_changed'].includes(type) ||
    (type === 'generation_started' && args[2] !== true && args[0] !== 'normal')
  )
    generationHandoffs.cancel();
}
