/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { verifyLayerProgress } from "../base_lib/compaction_stages.ts";
import type { SegmentState } from "../base_lib/compaction_stages.ts";
export function* runProgress(inputs: Readonly<Record<string, {
    readonly value: unknown;
}>>): Generator<any, any, any> {
    return {
        verified: yield* verifyLayerProgress(inputs["era.command_compaction.segment.state"].value as SegmentState),
    };
}
