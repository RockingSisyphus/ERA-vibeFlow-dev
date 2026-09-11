import type {
  EraDomainTaskV1 as ContractDomainTaskV1,
  EraPlannedSourceV1 as ContractPlannedSourceV1,
  EraPlannedStepV1 as ContractPlannedStepV1,
  EraTaskResultV1 as ContractTaskResultV1,
  EraTaskRouteV1,
  EraTaskStateUpdateV1,
  EraTransportArg,
  EraTransportEventV1 as ContractTransportEventV1,
  JsonValue,
} from "@era/vibeflow-contracts";

export type { EraTransportArg } from "@era/vibeflow-contracts";

type TransportEventBaseV1 = Omit<ContractTransportEventV1, "source" | "type">;

/**
 * 与 Data Schema 一致地把内部 timer 来源和固定类型绑定为联合分支。
 *
 * 必须把公共字段分别并入每个分支、形成真正的对象字面量联合，而不是用
 * `Base & (A | B)`：生成契约按 schema 推导出的是后者那种扁平联合，
 * 交叉类型在嵌套（数组元素）位置无法赋给扁平联合，会让 AOT 的 ABI 校验失败。
 */
export type EraTransportEventV1 =
  | (TransportEventBaseV1 & {
      readonly source: "tavern" | "ui" | "era-api";
      readonly type: string;
    })
  | (TransportEventBaseV1 & {
      readonly source: "timer";
      readonly type: "era.service.collection_timer";
    });

export type TaskRoute = EraTaskRouteV1;
export type TaskStatus = "committed" | "no-op" | "failed" | "fatal";
export type DomainTaskV1 = ContractDomainTaskV1;
export type PlannedSourceV1 = ContractPlannedSourceV1;
export type TaskStateUpdateV1 = EraTaskStateUpdateV1;

/** 一步一块处理中，跨批次携带的块游标。不保存整条消息，只保存续做所需最小状态。 */
export interface EraSyncCursorV1 {
  readonly messageId: number;
  /** 楼层稳定 MK；恢复时按它核对楼层身份。 */
  readonly mk: string;
  readonly blockIndex: number;
  /**
   * 该楼层起点累计到当前块的变量状态。
   *
   * 必须是对象而不是 `unknown`：契约 schema 把该字段描述为对象，生成的 ABI 类型
   * 也只接受对象；用 `unknown` 会在 `exactOptionalPropertyTypes` 下无法赋给契约类型。
   */
  readonly stat?: Readonly<Record<string, unknown>>;
  readonly statFunc?: Readonly<Record<string, unknown>>;
  /** 调用方已处理但文本尚未写回的调用标识。 */
  readonly resolvedCallIds?: readonly string[];
  readonly done?: boolean;
}

export interface EraServiceStateV1 {
  readonly [key: string]: unknown;
  readonly schemaVersion: 1;
  readonly collection: readonly EraTransportEventV1[];
  readonly collectionBytes: number;
  readonly iteration: number;
  readonly consecutiveProcessingCount: number;
  readonly consecutiveMk: string | null;
  readonly timerToken: string | null;
  /**
   * 一步一块的续做游标：函数调用会把一条消息的处理推到下一个批次，
   * 因此块进度必须随服务状态跨批次携带，而不能只放在批次执行状态里。
   * 不在途时为 null；契约 schema 允许 null 与对象两种取值。
   */
  readonly syncCursor: EraSyncCursorV1 | null;
  readonly scopeWindow: {
    readonly token: number | null;
    readonly messageId: number | null;
    readonly messageAdmission: boolean | null;
    readonly branchAdmission: boolean | null;
  };
}

export type CollectionCommand =
  | {
      readonly kind: "schedule";
      readonly token: string;
      readonly dueAt: number;
    }
  | { readonly kind: "cancel"; readonly token: string };

export interface CollectionControlV1 {
  readonly [key: string]: unknown;
  readonly schemaVersion: 1;
  readonly frameId: string;
  readonly kind: "collection-control";
  readonly commands: readonly CollectionCommand[];
}

export interface CollectionReductionV1 {
  readonly [key: string]: unknown;
  readonly schemaVersion: 1;
  readonly route: "wait" | "execute";
  readonly nextState: EraServiceStateV1;
  readonly batchEvents: readonly EraTransportEventV1[];
  readonly throughSequence: number | null;
}

type ContractExecuteStepV1 = Extract<ContractPlannedStepV1, { readonly kind: "execute" }>;
type ContractIgnoreStepV1 = Extract<ContractPlannedStepV1, { readonly kind: "ignore" }>;
export type PlannedStepV1 =
  | (ContractExecuteStepV1 & { readonly dispatchContext?: unknown })
  | ContractIgnoreStepV1;

export interface BatchPlanV1 {
  readonly [key: string]: unknown;
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly throughSequence: number;
  readonly nextState: EraServiceStateV1;
  readonly events: readonly EraTransportEventV1[];
  readonly sourceSequences: readonly number[];
  readonly steps: readonly PlannedStepV1[];
}

interface SettlementBaseV1 {
  readonly eventId: string;
  readonly sequence: number;
}

export type SettlementV1 =
  | (SettlementBaseV1 & {
      readonly status: "completed";
      readonly taskId: string;
      readonly relation: "primary" | "combined" | "coalesced";
      readonly value?: JsonValue;
    })
  | (SettlementBaseV1 & {
      readonly status: "ignored" | "cancelled";
      readonly reason: string;
    })
  | (SettlementBaseV1 & {
      readonly status: "failed";
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly category: "input" | "domain" | "tavern" | "cancelled";
        readonly retryable: boolean;
        readonly details?: Readonly<Record<string, JsonValue>>;
      };
    });

export interface NotificationV1 {
  readonly type: string;
  readonly args: readonly EraTransportArg[];
}

export interface DiagnosticV1 {
  readonly code: string;
  readonly message: string;
  readonly sequence: number | null;
}

export type TaskResultV1 = ContractTaskResultV1;

export interface BatchSourceV1 {
  readonly eventId: string;
  readonly sequence: number;
}

export interface BatchExecutionStateV1 {
  readonly [key: string]: unknown;
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly throughSequence: number;
  readonly nextState: EraServiceStateV1;
  readonly sources: readonly BatchSourceV1[];
  readonly steps: readonly PlannedStepV1[];
  readonly index: number;
  readonly settlements: readonly SettlementV1[];
  readonly notifications: readonly NotificationV1[];
  readonly diagnostics: readonly DiagnosticV1[];
  readonly fatal: boolean;
  readonly coverageError: string | null;
}

export interface BatchFinalizationV1 {
  readonly [key: string]: unknown;
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly throughSequence: number;
  readonly nextState: EraServiceStateV1;
  readonly settlements: readonly SettlementV1[];
  readonly notifications: readonly NotificationV1[];
  readonly diagnostics: readonly DiagnosticV1[];
  readonly fatal: boolean;
}

export interface BatchResultFrameV1 {
  readonly [key: string]: unknown;
  readonly schemaVersion: 1;
  readonly frameId: string;
  readonly kind: "batch-result";
  readonly throughSequence: number;
  readonly settlements: readonly SettlementV1[];
  readonly notifications: readonly NotificationV1[];
  readonly diagnostics: readonly DiagnosticV1[];
  readonly fatal: boolean;
}
