/** 单块循环只携带一个工作项、已确认写入依据和最后的真实提交结果。 */
import type { EraMessageSourceBasisV1 } from "@era/vibeflow-contracts";
import type { SyncWorkV1, SyncCommitResultV1 } from "./sync_contracts.ts";
export interface EraBlockStepStateV1 {
  readonly work: SyncWorkV1;
  readonly done: boolean;
  readonly sourceBasis: EraMessageSourceBasisV1 | null;
  readonly lastResult: SyncCommitResultV1 | null;
}
