/** 页面订阅只执行用户回调；下一业务阶段由 Service 的恢复事件决定。 */
export type EraGenerationStage = 'planning' | 'story' | 'settlement';
/** 只读成功阶段事实；规划尚无 AI 楼层时省略楼层身份。 */
export interface EraGenerationCompletion {
  readonly executionId: string;
  readonly completionId: string;
  readonly trigger: string;
  readonly chatKey: string;
  readonly stage: EraGenerationStage;
  readonly messageId?: number;
  readonly mk?: string;
  readonly swipeId?: number;
  readonly result: Readonly<Record<string, unknown>>;
}
/** Signal 只属于当前回调；作者的长任务应在取消后停止后续副作用。 */
export type EraGenerationEvent = Omit<EraGenerationCompletion, 'stage' | 'result'> & {
  readonly signal: AbortSignal;
} & (
    | {
        readonly stage: 'planning';
        readonly result: {
          readonly plan: Readonly<Record<string, unknown>>;
          readonly functionResults: readonly unknown[];
        };
      }
    | { readonly stage: 'story'; readonly result: { readonly story: string } }
    | {
        readonly stage: 'settlement';
        readonly result: { readonly operations: readonly Readonly<Record<string, unknown>>[] };
      }
  );
/** 返回 Promise 将暂缓下一阶段，不会占用 Service 的变量提交队列。 */
/** 托管页面卸载同时取消正在等待它的生成；普通注销只退出订阅。 */
export type GenerationSubscriptionStop = (() => void) & { cancelPending?: () => void };
export type EraGenerationListener = (event: EraGenerationEvent) => void | Promise<void>;
interface Subscription {
  listener: EraGenerationListener;
  stages?: readonly EraGenerationStage[];
  lifecycle: AbortController;
  waiting: Set<AbortController>;
}

/** 观察副本递归只读，避免作者回调改变随后提交的真实候选。 */
function freezeResult<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeResult(child);
    Object.freeze(value);
  }
  return value;
}
/** 取消时解除等待但仍观察原 Promise 拒绝，避免遗留未处理异常。 */
function untilAborted(work: Promise<void>, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener('abort', aborted);
      resolve();
    };
    const aborted = () => finish();
    signal.addEventListener('abort', aborted, { once: true });
    work.then(finish, error => {
      signal.removeEventListener('abort', aborted);
      reject(error);
    });
  });
}

export class GenerationSubscriptions {
  private readonly subscriptions = new Set<Subscription>();
  private readonly active = new Set<AbortController>();
  constructor(private readonly reportError: (error: unknown) => void) {}
  /** 返回生命周期注销器，因为卸载的作者脚本不应阻塞之后的阶段。 */
  subscribe(listener: EraGenerationListener, options: { stages?: readonly EraGenerationStage[] } = {}): () => void {
    if (typeof listener !== 'function') throw new TypeError('阶段订阅需要函数。');
    if (options.stages?.some(stage => !['planning', 'story', 'settlement'].includes(stage)))
      throw new TypeError('未知生成阶段。');
    const item: Subscription = {
      listener,
      stages: options.stages ? [...options.stages] : undefined,
      lifecycle: new AbortController(),
      waiting: new Set(),
    };
    this.subscriptions.add(item);
    const stop = () => {
      this.subscriptions.delete(item);
      item.lifecycle.abort();
    };
    return Object.assign(stop, {
      cancelPending: () => {
        for (const cycle of item.waiting) cycle.abort();
        stop();
      },
    });
  }
  /** 顺序等待作者 Promise，取消只释放等待，不能伪造作者操作已经完成。 */
  async publish(completion: EraGenerationCompletion): Promise<boolean> {
    const cycle = new AbortController();
    this.active.add(cycle);
    const result = freezeResult(structuredClone(completion));
    try {
      for (const item of [...this.subscriptions]) {
        if (cycle.signal.aborted) return false;
        if (!this.subscriptions.has(item) || (item.stages && !item.stages.includes(completion.stage))) continue;
        const signal = AbortSignal.any([cycle.signal, item.lifecycle.signal]);
        item.waiting.add(cycle);
        try {
          await untilAborted(
            Promise.resolve().then(() => {
              if (!signal.aborted) return item.listener(Object.freeze({ ...result, signal }) as EraGenerationEvent);
            }),
            signal,
          );
        } catch (error) {
          if (!signal.aborted) this.reportError(error);
        } finally {
          item.waiting.delete(cycle);
        }
      }
      return !cycle.signal.aborted;
    } finally {
      this.active.delete(cycle);
    }
  }
  /** 切聊只取消当前执行，保留页面脚本已有订阅。 */
  cancel(): void {
    for (const cycle of this.active) cycle.abort();
  }
  /** 停止 ERA 时同时释放订阅，旧脚本不能挂到新实例。 */
  clear(): void {
    this.cancel();
    for (const item of this.subscriptions) item.lifecycle.abort();
    this.subscriptions.clear();
  }
}

export const generationSubscriptions = new GenerationSubscriptions(error => {
  console.error('ERA 阶段订阅失败，继续后续生成。', error);
  toastr.error(`阶段订阅失败，继续后续生成：${error instanceof Error ? error.message : String(error)}`);
});
