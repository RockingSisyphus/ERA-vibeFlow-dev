/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
// Adapters with identical declared base libraries share this source.
import { type EraBlockStepStateV1 } from "../../base_lib/sync/sync_contracts.ts";
import { isHistorySyncStep, syncFailure, unwrapCapabilityFailure, type SyncWorkV1 } from "../../base_lib/sync/sync_contracts.ts";
import { retainNativeWork } from "../../base_lib/working_state.ts";
function supersededHistorySwipe(state: EraBlockStepStateV1, error: unknown): boolean {
    const changed = error as {
        code?: unknown;
        reason?: unknown;
        written?: unknown;
    } | null;
    return (isHistorySyncStep(state.work.step) &&
        state.sourceBasis !== null &&
        !state.functionFrame &&
        !state.stageOutcome &&
        changed?.code === "ERA_MESSAGE_WRITE_TARGET_CHANGED" &&
        changed.reason === "swipe" &&
        changed.written === false);
}
// Original node: nodes/sync/publish_block_application.ts
/** Fold the actual block result, without a persistence transaction per block. */
export function* PublishBlockApplicationProgress(inputs: any, _params: any, _context: any): Generator<any, any, any> {
    const carried = inputs["era.command_compaction.result"].value as SyncWorkV1;
    const state = carried.blockStepState as unknown as EraBlockStepStateV1;
    const { blockStepState: _carried, ...work } = carried;
    // A failed application still needs one turn through the call owner to reject
    // the pending commit and release the author function before the loop exits.
    const next: EraBlockStepStateV1 = {
        ...state,
        work,
        done: work.disposition === "failed" && state.functionFrame ? false : state.done,
    };
    try {
        if (work.plan && work.plan.status !== "failed") {
            const sidecar = "era.tavern.sidecar";
            const previous = (yield { kind: "resource", capability: sidecar, operation: "read_working", input: {} }).working;
            if (!previous)
                throw new Error("ERA_WORKING_STATE_MISSING");
            const { SidecarId: _pointer, ...eraMeta } = work.plan.meta;
            yield { kind: "resource", capability: sidecar, operation: "write_working", input: {
                    expectedVersion: previous.version,
                    record: {
                        ...previous.record,
                        state: {
                            statData: work.plan.stat,
                            statFunc: work.plan.statFunc,
                            eraMeta,
                        },
                    },
                    work,
                    sourceBasis: state.sourceBasis,
                    dirty: true,
                    publishApplied: next.done && work.disposition === "commit" && !state.apiContext && !state.stageOutcome,
                    nativeCandidate: retainNativeWork(previous, state.sourceBasis, work.plan.messageUpdates),
                    stage: (state.stageOutcome as any)?.stageWorkInput?.stageFloor
                        ? {
                            ...(state.stageOutcome as any).stageWorkInput.stageFloor,
                            phase: (state.stageOutcome as any).stageBoundary.stage,
                            candidateRecovery: (state.stageOutcome as any).stageWorkInput.recovery,
                        }
                        : (previous.stage ?? null),
                } };
        }
    }
    catch (error) {
        const unwrapped = unwrapCapabilityFailure(error) as any;
        // 原生 Swipe 已替换历史快照，且宿主明确拒绝了本次写入；统一沿已有
        // 历史重算出口收尾。作者函数和多阶段操作仍保留原来的失败结果。
        const superseded = supersededHistorySwipe(state, unwrapped);
        const failed = {
            ...work,
            disposition: superseded ? ("no-op" as const) : ("failed" as const),
            plan: null,
            ...(superseded ? { payload: null, initialPresentation: null } : {}),
            failure: syncFailure(unwrapped?.code ?? "ERA_WORKING_APPLICATION_FAILED", unwrapped instanceof Error ? unwrapped.message : String(unwrapped), "tavern"),
        };
        const done = !state.functionFrame;
        return {
            block_step_state_after: { ...state, work: failed, done },
            block_step_done: done,
        };
    }
    return { block_step_state_after: next, block_step_done: next.done };
}
