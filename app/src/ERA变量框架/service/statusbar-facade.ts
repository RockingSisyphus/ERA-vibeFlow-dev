/** 在 DOM 和楼层身份就绪前同步安装局部 Facade，避免作者脚本误读顶层状态。 */
import type { GenerationSubscriptionStop } from './generation-subscriptions';
import type { EraFacade, EraGetOptions, EraPublicState } from './public-api';
import { projectPublicState } from './public-state';

/** 只暂存读取意图与订阅；绑定后沿用同一公开对象，不能把早期写入送到最新楼。 */
export function createPendingStatusbarFacade(globalFacade: EraFacade) {
  const generationStops = new Set<GenerationSubscriptionStop>();
  let bound: EraFacade | null = null;
  let failure: Error | null = null;
  let options: EraGetOptions = {};
  const waiters = new Set<{ resolve: (state: EraPublicState) => void; reject: (error: Error) => void }>();
  const subscriptions = new Map<(state: EraPublicState) => void, (() => void) | null>();
  const request = (next: EraGetOptions): void => {
    options = { ...options, ...next, force: options.force || next.force };
  };
  const facade: EraFacade = Object.freeze({
    ...globalFacade,
    generation: Object.freeze({
      /** 跟随 iframe 释放回调等待，避免作者页面卸载后仍阻断生成。 */
      subscribe: (...args: Parameters<EraFacade['generation']['subscribe']>) => {
        if (failure) return () => undefined;
        const stop = globalFacade.generation.subscribe(...args);
        generationStops.add(stop);
        return () => {
          stop();
          generationStops.delete(stop);
        };
      },
    }),
    get: (next: EraGetOptions = {}) => {
      request(next);
      return failure ? projectPublicState(null) : (bound?.get(options) ?? projectPublicState(null));
    },
    ready: (next: EraGetOptions = {}): Promise<EraPublicState> => {
      request(next);
      if (failure) return Promise.reject(failure);
      if (bound) return bound.ready(options);
      return new Promise((resolve, reject) => waiters.add({ resolve, reject }));
    },
    /** 尚未绑定时拒绝写入，防止来源缺失的操作被错误路由。 */
    commit: (...args: Parameters<EraFacade['commit']>) => {
      if (failure || !bound) return Promise.reject(failure ?? new Error('ERA_STATUSBAR_NOT_READY'));
      return bound.commit(...args);
    },
    /** 将早期订阅迁移到同一楼层接口，避免作者首次订阅丢失。 */
    subscribe: (listener: (state: EraPublicState) => void) => {
      if (failure) return () => undefined;
      subscriptions.set(listener, bound?.subscribe(listener) ?? null);
      return () => {
        subscriptions.get(listener)?.();
        subscriptions.delete(listener);
      };
    },
  });
  return {
    facade,
    bind(local: EraFacade): void {
      if (failure) return;
      bound = local;
      bound.get(options);
      for (const listener of subscriptions.keys()) subscriptions.set(listener, local.subscribe(listener));
      for (const waiter of waiters) void local.ready(options).then(waiter.resolve, waiter.reject);
      waiters.clear();
    },
    dispose(error = new Error('ERA_STATUSBAR_FRAME_CLOSED')): void {
      failure = error;
      for (const stop of generationStops) (stop.cancelPending ?? stop)();
      generationStops.clear();
      bound = null;
      for (const unsubscribe of subscriptions.values()) unsubscribe?.();
      subscriptions.clear();
      for (const waiter of waiters) waiter.reject(error);
      waiters.clear();
    },
  };
}
