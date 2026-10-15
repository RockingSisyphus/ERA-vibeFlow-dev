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
