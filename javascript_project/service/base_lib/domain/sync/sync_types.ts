/** Contracts for the Service sync engine; no runtime planner imports. */
import type { EraMkContentV1, EraMkMessageV1, EraMkSeedV1 } from "../mk_engine.ts";

export type EraSyncReasonV1 =
  | "history-changed"
  | "edited"
  | "swipe-regeneration"
  | "manual"
  | "facade-commit";

export interface EraActionsTakenV1 {
  readonly rollback: boolean;
  readonly apply: boolean;
  readonly resync: boolean;
  readonly api: boolean;
  readonly editedResync: boolean;
  readonly swipedRollback: boolean;
}

export interface EraConsecutiveMkStateV1 {
  readonly mk: string | null;
  readonly count: number;
}

export interface EraSyncInputV1 {
  readonly messages: readonly EraMkMessageV1[];
  readonly stat: unknown;
  /** Sidecar V3 function library. Chat variables never carry this state. */
  readonly statFunc?: Readonly<Record<string, unknown>>;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly reason: EraSyncReasonV1;
  readonly forceFullRebuild?: boolean;
  readonly targetMessageId?: number;
  readonly stopAtTarget?: boolean;
  readonly traditionalToSimplified?: boolean;
  readonly mkSeedsByIndex?: readonly (EraMkSeedV1 | null)[];
  readonly processingMk: string | null;
  readonly consecutiveState: EraConsecutiveMkStateV1 | null;
}

export type EraSyncDivergenceV1 =
  | {
      readonly type: "FAST_SYNC";
      readonly firstMismatch: number;
      readonly newSelectedMks: readonly (string | null)[];
    }
  | {
      readonly type: "FULL_RECALC";
      readonly recalcId: number;
      readonly cause: "forced" | "targeted" | "no-divergence" | "divergence";
    };

export interface EraSyncMessageUpdateV1 {
  readonly kind: "update-message-content";
  readonly messageId: number;
  readonly messageIndex: number;
  readonly mk: string;
  readonly content: EraMkContentV1;
}

export interface EraSyncDiagnosticV1 {
  readonly code: string;
  readonly message: string;
  readonly messageIndex: number | null;
  readonly path?: string;
}

/** A sealed assistant layer eligible for the pure command-compaction Nodeset. */
export interface EraSealedCompactionCandidateV1 {
  readonly messageId: number;
  readonly messageIndex: number;
  readonly mk: string;
  readonly layerStartStat: unknown;
  readonly layerStartStatFunc: Readonly<Record<string, unknown>>;
  readonly layerEndStat: unknown;
  readonly layerEndStatFunc: Readonly<Record<string, unknown>>;
  readonly eraMeta: Readonly<Record<string, unknown>>;
  readonly traditionalToSimplified: boolean;
}

export type EraSyncPlanV1 =
  | {
      readonly kind: "sync";
      readonly status: "no-op" | "fast-sync" | "recalculated";
      readonly committed: boolean;
      readonly divergence: EraSyncDivergenceV1 | null;
      readonly stat: unknown;
      readonly statFunc: Readonly<Record<string, unknown>>;
      readonly meta: Readonly<Record<string, unknown>>;
      readonly messages: readonly EraMkMessageV1[];
      readonly messageUpdates: readonly EraSyncMessageUpdateV1[];
      /** Internal pure-workflow hand-off; never itself becomes persistent state. */
      readonly sealedCompactionCandidates: readonly EraSealedCompactionCandidateV1[];
      readonly recalculatedMessageIndexes: readonly number[];
      /**
       * 每条被重算楼层的**起步世界**：引擎回退掉旧分支之后的 stat/statFunc。
       *
       * 为什么必须暴露它：块步进循环要一条楼层一条楼场地累计状态，而「侧车里已提交的状态」
       * 可能还含有这条楼层**旧版本**的效果（换 swipe / 重新生成 / 编辑）。从已提交状态起步，
       * 新版本的 `insert` 会被「键已存在」挡掉，提交出去的仍是旧分支（真机 UI-SWIPE-001 实测）。
       */
      readonly execution?: EraSyncExecutionV1 | null;
      readonly rollback: {
        readonly applied: boolean;
        readonly fromMk: string | null;
        readonly toMk: string | null;
      };
      readonly actionsTaken: EraActionsTakenV1;
      readonly consecutiveProcessingCount: number | null;
      readonly nextConsecutiveState: EraConsecutiveMkStateV1 | null;
      readonly diagnostics: readonly EraSyncDiagnosticV1[];
    }
  | {
      readonly kind: "sync";
      readonly status: "failed";
      readonly committed: false;
      readonly divergence: EraSyncDivergenceV1 | null;
      readonly stat: unknown;
      readonly statFunc: Readonly<Record<string, unknown>>;
      readonly meta: Readonly<Record<string, unknown>>;
      readonly messages: readonly EraMkMessageV1[];
      readonly messageUpdates: readonly [];
      readonly sealedCompactionCandidates: readonly [];
      readonly recalculatedMessageIndexes: readonly [];
      readonly rollback: {
        readonly applied: false;
        readonly fromMk: null;
        readonly toMk: null;
      };
      readonly actionsTaken: EraActionsTakenV1;
      readonly consecutiveProcessingCount: number;
      readonly nextConsecutiveState: EraConsecutiveMkStateV1;
      readonly diagnostics: readonly EraSyncDiagnosticV1[];
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

export interface EraSyncExecutionV1 {
  readonly messageIndex: number;
  readonly endIndex: number;
  readonly blockIndex: number;
  readonly randomDrawOffset: number;
  readonly floorStarted: boolean;
  readonly layerStartStat: unknown;
  readonly layerStartStatFunc: Readonly<Record<string, unknown>>;
  readonly mkSeedsByIndex: readonly (EraMkSeedV1 | null)[];
  readonly traditionalToSimplified: boolean;
}
