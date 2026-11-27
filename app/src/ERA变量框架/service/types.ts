/*
 * 模块职责：定义 ERA 应用接线层的最小公开契约，描述 Host、Tavern adapter
 * 与 UI client 之间的入口和出口。模块边界：不复制工作流领域 DTO，否则应用层
 * 会与生成的 AOT 内部实现发生双向依赖。
 */

export type EraEventSource = 'tavern' | 'ui' | 'era-api' | 'timer';

/** 仅供 ERA 自身 UI 直达 Service 的内部事件，不占用 13 个对外 API 名额。 */
export const ERA_UI_EVENT = {
  INITIALIZE_RESOURCES: 'era.ui.initialize_resources',
  UPDATE_SETTINGS: 'era.ui.update_settings',
  SIDECAR_BINDING_CHOICE: 'era.ui.sidecar_binding_choice',
  AGENT_CONFIGURATION: 'era.ui.agent_configuration',
  AGENT_RETRY: 'era.ui.agent_retry',
} as const;

/** 单个入站事件在 Host receipt 上可观察到的最终结算。 */
export interface EraSettlement {
  readonly eventId: string;
  readonly sequence: number;
  readonly status: 'completed' | 'ignored' | 'failed' | 'cancelled';
  readonly [key: string]: unknown;
}

/** high-water barrier 等待到指定序号后的聚合结果。 */
export interface EraWaitThroughResult {
  readonly throughSequence: number;
  readonly outcomes: readonly {
    readonly eventId: string;
    readonly sequence: number;
    readonly outcome: EraSettlement;
  }[];
  readonly hasFailures: boolean;
}

/** Host 已接纳事件并为其分配单调序号与唯一回执。 */
export interface EraAdmissionAccepted {
  readonly accepted: true;
  readonly eventId: string;
  readonly sequence: number;
  readonly done: Promise<EraSettlement>;
  waitThrough(): Promise<EraWaitThroughResult>;
}

/** Host 在事件进入 FIFO 前返回的带类型拒绝。 */
export interface EraAdmissionRejected {
  readonly accepted: false;
  readonly code: string;
  readonly message: string;
}

export type EraAdmissionResult = EraAdmissionAccepted | EraAdmissionRejected;

/** 应用接线层提交给 Host 的未编码入站事件。 */
export interface EraInboundEvent {
  readonly type: string;
  readonly source: EraEventSource;
  readonly args?: readonly unknown[];
  readonly occurredAt?: number;
}

export interface EraPreparedNotification {
  readonly type: string;
  readonly args: readonly unknown[];
}

/** 主 workflow 的安装作用域结论；应用组合层据此决定是否挂载 client/宏/UI。 */
export interface EraStartupGateDecision {
  readonly classification: 'character' | 'global' | 'preset' | 'ambiguous' | 'unknown' | 'legacy';
  readonly route: 'allow' | 'dormant';
  readonly warn?: boolean;
}

/** 应用启动器和 UI client 共用的最小入站接口。 */
export interface EraServiceIngress {
  enqueue(type: string, source: Exclude<EraEventSource, 'timer'>, args?: readonly unknown[]): EraAdmissionResult;
  /** 只等待调用时已接收事件的回执；不发起同步或等待未来事件。 */
  waitForCurrentWork(): Promise<EraWaitThroughResult>;
  /** 当前页面实例的单调 Tavern 生命周期 token；只作为 Service 的原始输入事实。 */
  currentLifecycleToken(): number;
  forCall?(parameters: object): import('./public-api').EraFacade;
  subscribeGeneration?(
    listener: import('./generation-subscriptions').EraGenerationListener,
    options?: { readonly stages?: readonly import('./generation-subscriptions').EraGenerationStage[] },
  ): import('./generation-subscriptions').GenerationSubscriptionStop;
  clearGenerationSubscriptions?(): void;
  readAgentSession?(): Record<string, unknown> | null;
  diagnostics?(): Readonly<{ started: boolean; stopping: boolean }>;
}
