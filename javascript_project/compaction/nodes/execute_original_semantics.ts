/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { executeOriginalSemanticsProgress } from "../base_lib/compaction_stages.ts";
import type { ParsedLayer } from "../base_lib/command_compaction_engine.ts";
export function* runProgress(inputs: Readonly<Record<string, {
    readonly value: unknown;
}>>): Generator<any, any, any> {
    return {
        trace: yield* executeOriginalSemanticsProgress(inputs["era.command_compaction.parsed"].value as ParsedLayer),
    };
}
