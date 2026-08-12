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

/** 与 Data Schema 一致地把内部 timer 来源和固定类型绑定为联合分支。 */
export type EraTransportEventV1 = TransportEventBaseV1 &
  (
    | {
        readonly source: "tavern" | "ui" | "era-api";
        readonly type: string;
      }
    | {
        readonly source: "timer";
        readonly type: "era.service.collection_timer";
      }
  );

export type TaskRoute = EraTaskRouteV1;
export type TaskStatus = "committed" | "no-op" | "failed" | "fatal";
export type DomainTaskV1 = ContractDomainTaskV1;
export type PlannedSourceV1 = ContractPlannedSourceV1;
export type TaskStateUpdateV1 = EraTaskStateUpdateV1;

export interface EraServiceStateV1 {
  readonly [key: string]: unknown;
  readonly schemaVersion: 1;
  readonly collection: readonly EraTransportEventV1[];
  readonly collectionBytes: number;
  readonly iteration: number;
  readonly consecutiveProcessingCount: number;
  readonly consecutiveMk: string | null;
  readonly timerToken: string | null;
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

export type PlannedStepV1 = ContractPlannedStepV1 &
  Readonly<Record<string, unknown>>;

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

export type TaskResultV1 = ContractTaskResultV1 &
  Readonly<Record<string, unknown>>;

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
