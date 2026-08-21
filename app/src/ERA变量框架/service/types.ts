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

export interface EraCapabilityContext {
  readonly signal: AbortSignal;
}

/**
 * Tavern Helper 能力适配器；所有方法只执行工作流已声明的宿主操作，
 * 不拥有 CRUD、同步、回滚或资源选择规则。
 */
export interface EraTavernAdapter {
  subscribe(listener: (event: EraInboundEvent) => EraAdmissionResult): () => void;
  notify(notification: EraPreparedNotification, context: EraCapabilityContext): Promise<void>;
  readonly variables: {
    read(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    commit(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
  };
  readonly messages: {
    read_context(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    update_content(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    refresh(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
  };
  readonly worldbook: {
    read(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    create(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    bind(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    replace_entries(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
  };
  readonly regex: {
    read(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    upsert(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
  };
  readonly identity: {
    read(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown;
  };
  /** Sidecar 宿主机械能力；绑定规则与迁移决策位于 VibeFlow service workflow。 */
  readonly sidecar: {
    read_current(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    read_record(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    write_record(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    commit_metadata(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown>;
    create_id(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown;
    present_prompt(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown;
    clear_prompt(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown;
  };
}

/** 应用启动器和 UI client 共用的最小入站接口。 */
export interface EraServiceIngress {
  enqueue(type: string, source: Exclude<EraEventSource, 'timer'>, args?: readonly unknown[]): EraAdmissionResult;
  stopAccepting(): void;
}

export type EraRuntimeAdapter = EraTavernAdapter & EraServiceIngress;

/** 应用层只依赖 AOT Host 的公开生命周期 ABI。 */
export interface EraWorkflowHost {
  readonly started: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  runWorkflowAsync(inputs: object): Promise<unknown>;
}
