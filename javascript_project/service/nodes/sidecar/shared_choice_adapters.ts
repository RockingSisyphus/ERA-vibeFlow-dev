/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { type SidecarResolutionV1, resolveSidecar, type SidecarFactsV1, type SyncContextV1, } from "../../base_lib/sidecar_binding.ts";
import { assertSyncStep, syncFailure, type SyncCommitContractFailureV1, } from "../../base_lib/sync/sync_contracts.ts";
import { buildSyncContractFailureResult } from "../../base_lib/sync/sync_result_policy.ts";
/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sidecar/shared_choice_adapters.ts。 */
// Adapters with identical declared base libraries share this source.
// Original node: nodes/sidecar/publish_choice_prompt.ts
interface PublishChoicePrompt_Ctx {
    readonly capabilities: {
        readonly "era.tavern.sidecar": {
            present_prompt(input: Readonly<Record<string, unknown>>): unknown;
        };
    };
}
export function* PublishChoicePromptProgress(inputs: Readonly<{
    "era.sidecar.binding.resolution": {
        readonly value: unknown;
    };
}>, _params: Readonly<Record<string, unknown>>, context: PublishChoicePrompt_Ctx): Generator<any, any, any> {
    const resolution = inputs["era.sidecar.binding.resolution"]
        .value as SidecarResolutionV1;
    // 用户已经做出选择时，决议会进入 apply。此时只应执行受控事务，不能在
    // apply_resolution 前再次发布同一冲突弹窗，避免出现“重复冲突提示后才清除”的
    // 短暂错误状态。
    if (resolution.route !== "blocked")
        return {};
    const facts = resolution.facts;
    if (facts.status === "conflict" &&
        facts.current !== null &&
        facts.record !== null) {
        yield { kind: "resource", capability: "era.tavern.sidecar", operation: "present_prompt", input: {
                prompt: {
                    kind: "conflict",
                    sidecarId: facts.sidecarId,
                    current: facts.current,
                    owner: facts.record.owner,
                    revision: facts.record.revision,
                },
            } };
    }
    if (facts.status === "invalid") {
        yield { kind: "resource", capability: "era.tavern.sidecar", operation: "present_prompt", input: {
                prompt: {
                    kind: "repair",
                    sidecarId: facts.sidecarId,
                    current: facts.current,
                    owner: null,
                    revision: null,
                    reason: facts.reason,
                },
            } };
    }
    return {};
}
// Original node: nodes/sidecar/resolve_choice.ts
export function ResolveChoiceNode(inputs: Readonly<{
    "era.sidecar.binding.input": {
        readonly value: unknown;
    };
    "era.sidecar.binding.facts": {
        readonly value: unknown;
    };
}>): any {
    const bindingInput = inputs["era.sidecar.binding.input"].value as {
        readonly sync: SyncContextV1;
    };
    const resolution = resolveSidecar(inputs["era.sidecar.binding.facts"].value as SidecarFactsV1, bindingInput.sync);
    return { sidecar_binding_resolution: resolution };
}
/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sidecar/build_applied_result.ts。 */
interface buildappliedresultEnvelope<T> {
    readonly value: T;
}
/**
 * Sidecar repair 已经完成独立的 files 事务，不得再借普通同步“顺带”结算，
 * 否则会把仅存在于当前变量状态的 API 变更重新按聊天文本计算而覆盖掉。
 */
export function BuildAppliedResultNode(inputs: Readonly<{
    "era.sync.context": buildappliedresultEnvelope<unknown>;
}>): any {
    const context = inputs["era.sync.context"].value as {
        readonly step: unknown;
    };
    const step = assertSyncStep(context.step);
    return {
        sidecar_binding_applied_result: {
            status: "no-op",
            settlements: step.sources.map((source) => ({
                status: "completed",
                eventId: source.event.eventId,
                sequence: source.event.sequence,
                taskId: step.task.id,
                relation: source.relation,
            })),
            notifications: [],
            diagnostics: [],
        },
    };
}
/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sidecar/build_blocked_result.ts。 */
interface buildblockedresultEnvelope<T> {
    readonly value: T;
}
export function BuildBlockedResultNode(inputs: Readonly<{
    "era.sync.context": buildblockedresultEnvelope<unknown>;
}>): any {
    const context = inputs["era.sync.context"].value as SyncContextV1;
    const result: SyncCommitContractFailureV1 = {
        schemaVersion: 1,
        step: context.step as SyncCommitContractFailureV1["step"],
        failure: syncFailure("ERA_SIDECAR_BINDING_DECISION_REQUIRED", "当前聊天的 SidecarId 已被另一角色卡或聊天占用；请在 ERA 弹窗中选择迁移、创建独立变量或复制变量。", "domain"),
    };
    return {
        sidecar_binding_blocked_result: buildSyncContractFailureResult(result),
    };
}
