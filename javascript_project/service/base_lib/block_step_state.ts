/** 单块循环携带累计工作项与原始消息依据，最终统一保存。 */
import type { EraMessageSourceBasisV1 } from "@era/vibeflow-contracts";
import type { SyncWorkV1 } from "./sync_contracts.ts";
export interface EraBlockStepStateV1 {
  readonly work: SyncWorkV1;
  readonly done: boolean;
  readonly sourceBasis: EraMessageSourceBasisV1 | null;
  readonly stageOutcome?: Readonly<Record<string, unknown>>;
  readonly functionFrame?: {
    readonly id: string;
    readonly callIndex: number;
    readonly appliedBlocks: number;
    readonly phase: "start" | "waiting" | "applying";
    readonly remaining: number;
    readonly request: Readonly<Record<string, unknown>> | null;
  } | null;
  readonly scopeWindow?: Readonly<Record<string, unknown>>;
  readonly apiContext?: Readonly<Record<string, unknown>>;
}
