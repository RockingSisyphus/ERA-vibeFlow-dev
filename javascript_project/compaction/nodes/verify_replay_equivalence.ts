/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { verifySegmentProgress } from "../base_lib/compaction_stages.ts";
import type { CandidateData } from "../base_lib/compaction_stages.ts";
export function* runProgress(inputs: Readonly<Record<string, {
    readonly value: unknown;
}>>): Generator<any, any, any> {
    return {
        verified: yield* verifySegmentProgress(inputs["era.command_compaction.candidate"].value as CandidateData),
    };
}
