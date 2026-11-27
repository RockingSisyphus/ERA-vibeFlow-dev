/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { messageContentVersion } from "../../base_lib/domain/mk_engine.ts";
import { basisAfterSyncWrites, observeWrite, } from "../../base_lib/sync/sync_commit_policy.ts";
import { cloneSyncJson, errorMessage, isCancellation, isHistorySyncStep, syncFailure, unwrapCapabilityFailure, type SyncCommitRequestV1, type SyncCommitResultV1, type SyncFailureV1, type SyncWorkV1, } from "../../base_lib/sync/sync_contracts.ts";
import { inspectSidecar, recordFor, type SidecarStateV2, } from "../../base_lib/sidecar_binding.ts";
import { retainNativeWork } from "../../base_lib/working_state.ts";
interface Envelope<T> {
    readonly value: T;
}
type CommitEnvelope = {
    readonly mode: "non-commit";
    readonly work: SyncWorkV1;
} | {
    readonly mode: "commit";
    readonly request: SyncCommitRequestV1;
};
type Context = any;
function result(request: SyncCommitRequestV1, status: "committed" | "deferred" | "no-op" | "failed" | "fatal", confirmedMessageWrites: number, variablesCommitted: boolean, failure: SyncFailureV1 | null): SyncCommitResultV1 {
    return {
        ...request,
        status,
        confirmedMessageWrites,
        variablesCommitted,
        failure,
    };
}
function isOrdinarySync(request: SyncCommitRequestV1): boolean {
    return isHistorySyncStep(request.step) && request.agentFloorCandidate === null;
}
function changedSource(request: SyncCommitRequestV1, written: number, sidecarCommitted: boolean, error: unknown): SyncCommitResultV1 | null {
    // 辅助workflow会再包一层Node错误；保留原reason/written事实才能沿用原保护分支。
    error = unwrapCapabilityFailure(error);
    if (error === null ||
        typeof error !== "object" ||
        (error as {
            code?: unknown;
        }).code !== "ERA_MESSAGE_WRITE_TARGET_CHANGED")
        return null;
    const ordinary = isOrdinarySync(request);
    return {
        ...result(request, sidecarCommitted ? "committed" : ordinary ? "no-op" : "failed", written, sidecarCommitted, ordinary
            ? null
            : syncFailure("ERA_SYNC_SOURCE_CHANGED", errorMessage(error), "tavern")),
        sourceChanged: true,
    };
}
function failureFor(error: unknown, code: string): SyncFailureV1 {
    error = unwrapCapabilityFailure(error);
    const cancelled = isCancellation(error);
    return syncFailure(cancelled ? `${code}_CANCELLED` : code, errorMessage(error), cancelled ? "cancelled" : "tavern");
}
/**
 * 消息已经确认写入后，Sidecar 文件失败并不是“消息拓扑未知”：指令仍在聊天
 * 历史中，可以由用户明确的修复操作安全重放。这里仅把 workflow 已知的
 * 修复状态交给宿主显示；宿主不参与任何绑定或恢复决策。
 */
function* presentRecoverableSidecarFailureProgress(_context: Context, reason: any = "sidecar-state-commit-failed"): Generator<any, void, any> {
    try {
        const current = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_current", input: {} };
        const meta = current !== null && typeof current === "object"
            ? (current as Record<string, unknown>).meta
            : null;
        const sidecarId = meta !== null && typeof meta === "object"
            ? (meta as Record<string, unknown>).SidecarId
            : null;
        if (typeof sidecarId !== "string")
            return;
        const stored = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_record", input: { sidecarId } };
        const facts = inspectSidecar(current, stored);
        if (facts.current === null)
            return;
        yield { kind: "resource", capability: "era.tavern.sidecar", operation: "present_prompt", input: {
                prompt: {
                    kind: "repair",
                    sidecarId,
                    current: facts.current,
                    owner: facts.record?.owner ?? null,
                    revision: facts.record?.revision ?? null,
                    reason,
                },
            } };
    }
    catch {
        // 原始文件失败仍须如实结算；弹窗显示失败不得把一个可重放状态升级为未知提交。
    }
}
export function* runProgress(inputs: Readonly<{
    "era.tavern.commit.request": Envelope<unknown>;
}>, _params: Readonly<Record<string, unknown>>, context: Context): Generator<any, any, any> {
    const envelope = inputs["era.tavern.commit.request"].value as CommitEnvelope;
    if ((envelope as any).mode === "settled") return {sync_commit_result:(envelope as any).result};
    if (envelope.mode === "non-commit") {
        return {
            sync_commit_result: envelope as unknown as Readonly<Record<string, unknown>>,
        };
    }
    const request = envelope.request;
    const initialWorking = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_working", input: {} }).working;
    if(initialWorking?.nativeCandidate?.messages.some((item:any)=>!request.messageWrites.some(write=>write.messageId===item.source.messageId))) {
        return {sync_commit_result:result(request,'failed',0,false,syncFailure('ERA_SYNC_PENDING_RECORD_MISSING','本批保存缺少仍待写入的候选正文，不能先保存其变量效果。','domain'))};
    }
    let confirmedMessageWrites = 0;
    if (request.messageWrites.length > 0) {
        let response: unknown;
        try {
            response = yield { kind: "resource", capability: "era.tavern.messages", operation: "update_content", input: {
                    sourceBasis: request.sourceBasis,
                    updates: request.messageWrites.map((write) => ({
                        message_id: write.messageId,
                        message: write.content,
                        ...(write.extra === undefined ? {} : { extra: write.extra }),
                    })),
                    refresh: request.messageRefresh ?? "none",
                    purpose: "era-sync",
                } };
        }
        catch (error) {
            const pending = unwrapCapabilityFailure(error) as any;
            if (pending?.code === "ERA_MESSAGE_CANDIDATE_PENDING" && pending.written === false) {
                const original = request.sourceBasis.messages.find(message => message.messageId === pending.messageId);
                if (original?.candidate.generation === pending.candidate?.candidate.generation && pending.candidate?.candidate.phase !== 'cancelled') {
                    const previous = (yield {kind:"resource",capability:"era.tavern.sidecar",operation:"read_working",input:{}}).working;
                    const basis = {...request.sourceBasis,messages:request.sourceBasis.messages.map(message => message.messageId === pending.messageId ? {...message,candidate:pending.candidate.candidate} : message)};
                    yield {kind:"resource",capability:"era.tavern.sidecar",operation:"write_working",input:{...previous,expectedVersion:previous.version,nativeCandidate:retainNativeWork(previous,basis,request.messageWrites)}};
                    return {sync_commit_result:result(request,"deferred",0,false,null)};
                }
                return {sync_commit_result:{...result(request,"no-op",0,false,null),sourceChanged:true}};
            }
            return {
                sync_commit_result: changedSource(request, confirmedMessageWrites, false, error) ??
                    (result(request, confirmedMessageWrites === 0 ? "failed" : "fatal", confirmedMessageWrites, false, failureFor(error, "ERA_SYNC_MESSAGE_COMMIT_FAILED")) as unknown as Readonly<Record<string, unknown>>),
            };
        }
        if (response !== null &&
            typeof response === "object" &&
            (response as Record<string, unknown>).writeState === "memory-written") {
            const observed = response as Record<string, unknown>;
            const sourceChanged = observed.sourceChanged === true;
            const persistenceConfirmed = observed.persistenceConfirmed === true;
            // 只在固定目标的落盘已证实时正常结束过时同步；来源变化不能证明保存成功。
            if (sourceChanged && persistenceConfirmed && isOrdinarySync(request)) {
                return {
                    sync_commit_result: {
                        ...result(request, "no-op", request.messageWrites.length, false, null),
                        sourceChanged: true,
                    },
                };
            }
            if (!sourceChanged)
                yield* presentRecoverableSidecarFailureProgress(context, "message-persistence-unconfirmed");
            return {
                sync_commit_result: {
                    ...result(request, "failed", observed.persistenceConfirmed === true
                        ? request.messageWrites.length
                        : 0, false, syncFailure(sourceChanged && persistenceConfirmed
                        ? "ERA_SYNC_SOURCE_CHANGED"
                        : "ERA_SYNC_MESSAGE_PERSISTENCE_UNCONFIRMED", String((response as Record<string, unknown>).message), "tavern", {
                        memoryWritten: true,
                        persistenceConfirmed: observed.persistenceConfirmed === true,
                    })),
                    sourceChanged,
                },
            };
        }
        const observation = observeWrite(response);
        if (observation.kind !== "confirmed") {
            const isSafeFailure = observation.kind === "not-written" && confirmedMessageWrites === 0;
            return {
                sync_commit_result: result(request, isSafeFailure ? "failed" : "fatal", confirmedMessageWrites, false, syncFailure(isSafeFailure
                    ? "ERA_SYNC_MESSAGE_NOT_WRITTEN"
                    : "ERA_SYNC_MESSAGE_COMMIT_UNKNOWN", observation.message, "tavern")) as unknown as Readonly<Record<string, unknown>>,
            };
        }
        confirmedMessageWrites = request.messageWrites.length;
    }
    let stateResponse: unknown;
    let sidecarCommitted = false;
    const sourceBasis = basisAfterSyncWrites(request);
    let saveWorkingVersion = initialWorking?.version;
    try {
        if (initialWorking) {
            const rebased = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "write_working", input: {
                    ...initialWorking,
                    expectedVersion: initialWorking.version,
                    sourceBasis,
                    nativeCandidate: null,
                } }).working;
            saveWorkingVersion = rebased.version;
        }
        const current = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_current", input: {} };
        const meta = current !== null && typeof current === "object"
            ? (current as Record<string, unknown>).meta
            : null;
        const id = meta !== null && typeof meta === "object"
            ? (meta as Record<string, unknown>).SidecarId
            : null;
        if (typeof id !== "string")
            throw new TypeError("ERA 当前聊天没有已加载的 SidecarId。");
        const stored = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_record", input: { sidecarId: id } };
        const facts = inspectSidecar(current, stored);
        if (facts.current === null ||
            facts.record === null ||
            facts.status !== "matched")
            throw new TypeError("ERA Sidecar 状态在提交前已变化。");
        const eraMeta = cloneSyncJson(request.meta) as Record<string, unknown>;
        delete eraMeta.SidecarId;
        eraMeta.MessageContentVersions = sourceBasis.messages.map((message) => messageContentVersion(message.activeText));
        const state: SidecarStateV2 = {
            statData: cloneSyncJson(request.stat),
            eraMeta,
            statFunc: cloneSyncJson(request.statFunc) as Record<string, unknown>,
        };
        const record = recordFor(id, facts.current, state, facts.record);
        stateResponse = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "write_record", input: { sidecarId: id, record, sourceBasis, expectedSidecarId: id } };
        const observation = observeWrite(stateResponse);
        if (observation.kind !== "confirmed")
            throw new TypeError(observation.message);
        const verify = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_record", input: { sidecarId: id } };
        const checked = inspectSidecar(current, verify);
        if (checked.record === null || checked.record.revision !== record.revision)
            throw new TypeError("ERA Sidecar 提交回读不一致。");
        sidecarCommitted = true;
        // 指针已经存在；重复机械提交不会写入任何 ERA 聊天状态，只在文件回读成功后
        // 刷新当前页面宏快照。
        yield { kind: "resource", capability: "era.tavern.sidecar", operation: "commit_metadata", input: {
                sidecarId: id,
                snapshot: record,
                sourceBasis,
                expectedSidecarId: id,
                notifySubscribers: initialWorking ? false : request.syncCursor == null,
                ...(initialWorking ? { workingVersion: saveWorkingVersion } : {}),
            } };
        const latestWorking = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_working", input: {} }).working;
        if (latestWorking && latestWorking.version === saveWorkingVersion) {
            yield { kind: "resource", capability: "era.tavern.sidecar", operation: "write_working", input: {
                    expectedVersion: latestWorking.version,
                    record,
                    dirty: false,
                    nativeCandidate: null,
                    notifySubscribers: request.syncCursor == null,
                } };
        }
    }
    catch (error) {
        const changed = changedSource(request, confirmedMessageWrites, sidecarCommitted, error);
        if (changed !== null)
            return { sync_commit_result: changed };
        yield* presentRecoverableSidecarFailureProgress(context);
        return {
            sync_commit_result: result(request, 
            // Sidecar 写入发生在所有消息写入均已确认之后。状态文件不是聊天历史
            // 的替代提交物，失败时保留已确认指令并要求显式 repair，而非停服。
            "failed", confirmedMessageWrites, false, failureFor(error, "ERA_SYNC_SIDECAR_COMMIT_FAILED")) as unknown as Readonly<Record<string, unknown>>,
        };
    }
    return {
        sync_commit_result: result(request, "committed", confirmedMessageWrites, true, null) as unknown as Readonly<Record<string, unknown>>,
    };
}
