/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { overlayWorkingMessages, retainAppliedMessageWrite } from "../../base_lib/working_state.ts";
import { type EraTaskResultV1 } from "@era/vibeflow-contracts";
import { adaptSyncResult, buildFailureResult, buildSkippedResult, buildSyncFailure, buildTransaction, inspectWindow, mergeExclusiveResults, planFacadeSync, routeFacadeCommand, recheckWindow, validateCommit, } from "../../base_lib/facade_api_engine.ts";
import { type BatchExecutionStateV1, type PlannedStepV1, } from "../../base_lib/service_types.ts";
import { prepared, type NodeInputs, } from "../../base_lib/task_continuation.ts";
/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/api/facade_nodes.ts。 */
interface facadenodesEnvelope<T> {
    readonly value: T;
}
interface Context {
    readonly capabilities: {
        readonly "era.tavern.messages": {
            read_context(input: Readonly<Record<string, unknown>>): Promise<unknown>;
            update_content(input: Readonly<Record<string, unknown>>): Promise<unknown>;
        };
        readonly "era.tavern.sidecar": {
            read_working(input: Readonly<Record<string, unknown>>): any;
        };
        readonly "era.tavern.identity": {
            read(input: Readonly<Record<string, unknown>>): unknown;
        };
    };
}
function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function envelope(inputs: Readonly<Record<string, facadenodesEnvelope<unknown>>>, key: string): unknown {
    const value = inputs[key]?.value;
    if (value === undefined)
        throw new TypeError(`缺少节点输入 ${key}。`);
    return value;
}
function* readMessagesProgress(_context: Context, purpose: string): Generator<any, unknown, any> {
    const raw = yield { kind: "resource", capability: "era.tavern.messages", operation: "read_context", input: {
            projection: "era-active-message-v2",
            range: "0--1",
            purpose,
        } };
    return overlayWorkingMessages(raw, (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_working", input: {} }).working);
}
function identityInput(purpose: string, rawRequest: unknown): Readonly<Record<string, unknown>> {
    if (!isRecord(rawRequest))
        return { purpose };
    const detail = isRecord(rawRequest.detail) ? rawRequest.detail : {};
    return Object.prototype.hasOwnProperty.call(detail, "sourceContext")
        ? { purpose, sourceContext: detail.sourceContext }
        : { purpose };
}
export function routeFacadeNode(inputs: any): any {
    const routed = routeFacadeCommand(envelope(inputs, "era.step.request.routed") as PlannedStepV1, envelope(inputs, "era.batch.execution.state") as BatchExecutionStateV1);
    return {
        facade_request: routed.request,
        facade_route: routed.route,
        facade_execution_state: routed.executionState,
    };
}
function* workingRequestProgress(request: any, raw: any, _context: Context): Generator<any, any, any> {
    const working = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_working", input: {} }).working;
    if (!working?.dirty)
        return request;
    const dispatch = request.dispatchContext;
    if (!dispatch || !Array.isArray(raw?.messages))
        return request;
    const pending = raw.messages.find((message: any) => message.messageId ===
        (working.stage?.messageId ?? dispatch.processingMessage?.messageId));
    if (!pending)
        return request;
    return {
        ...request,
        dispatchContext: {
            ...dispatch,
            processingMessage: pending,
            ...(working.stage
                ? {
                    processingMk: working.stage.mk,
                    floorIdentity: {
                        chatId: working.stage.chatId,
                        messageId: working.stage.messageId,
                        swipeId: working.stage.swipeId,
                        mk: working.stage.mk,
                    },
                }
                : {}),
        },
    };
}
export function* readWindowProgress(inputs: any, _params: any, context: any): Generator<any, any, any> {
    const request = envelope(inputs, "era.api.request");
    try {
        const identity = yield { kind: "resource", capability: "era.tavern.identity", operation: "read", input: identityInput("era-facade-window", request) };
        const messages = yield* readMessagesProgress(context, "era-facade-window");
        return {
            facade_commit_inspected: inspectWindow(yield* workingRequestProgress(request, messages, context), envelope(inputs, "era.batch.execution.state") as BatchExecutionStateV1, identity, messages),
        };
    }
    catch (error) {
        const executionState = envelope(inputs, "era.batch.execution.state") as BatchExecutionStateV1;
        return {
            facade_commit_inspected: {
                request,
                executionState,
                window: executionState.nextState.scopeWindow,
                readFailure: syncFailure("ERA_API_CONTEXT_READ_FAILED", error instanceof Error ? error.message : String(error), "tavern"),
            },
        };
    }
}
export function validateCommitNode(inputs: any): any {
    const result = validateCommit(envelope(inputs, "era.api.commit.inspected"));
    return {
        commit_admission_route: result.route,
        facade_commit_validated: result.context,
        facade_commit_validation_failure: result,
    };
}
export function buildTransactionNode(inputs: any): any {
    return {
        facade_commit_transaction: buildTransaction(envelope(inputs, "era.api.commit.validated")),
    };
}
export function* readTargetProgress(inputs: any, _params: any, context: any): Generator<any, any, any> {
    const candidate = envelope(inputs, "era.api.commit.transaction");
    try {
        const messages = yield* readMessagesProgress(context, "era-facade-commit-target");
        const request = isRecord(candidate) ? candidate.request : null;
        const identity = yield { kind: "resource", capability: "era.tavern.identity", operation: "read", input: identityInput("era-facade-commit-target", request) };
        if (!isRecord(candidate))
            throw new TypeError("era_tx 上下文损坏。");
        const checked = recheckWindow(candidate, identity);
        if (checked.route !== "current")
            return {
                facade_commit_target: { ...candidate, readFailure: checked.error },
            };
        const refreshed = inspectWindow(yield* workingRequestProgress(candidate.request, messages, context), candidate.executionState as BatchExecutionStateV1, identity, messages);
        return {
            facade_commit_target: {
                ...candidate,
                messages: refreshed.messages,
                latest: refreshed.latest,
            },
        };
    }
    catch (error) {
        return {
            facade_commit_target: {
                ...(candidate as object),
            readFailure: syncFailure("ERA_API_TARGET_READ_FAILED", error instanceof Error ? error.message : String(error), "tavern"),
            },
        };
    }
}
export function adaptSyncNode(inputs: any): any {
    return {
        facade_sync_committed_result: adaptSyncResult(envelope(inputs, "era.task.result") as EraTaskResultV1, envelope(inputs, "era.api.sync.context")),
    };
}
export function mergeSyncNode(inputs: any): any {
    const input = inputs["era.api.sync.result"];
    const values = Array.isArray(input)
        ? input.map((item) => item.value)
        : [input?.value];
    return {
        sync_result: mergeExclusiveResults(values.filter(Boolean) as EraTaskResultV1[]),
    };
}
export function mergeFacadeNode(inputs: any): any {
    const input = inputs["era.api.facade.result"];
    const values = Array.isArray(input)
        ? input.map((item) => item.value)
        : [input?.value];
    return {
        api_task_result: mergeExclusiveResults(values.filter(Boolean) as EraTaskResultV1[]),
    };
}
/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/api/task_continuation.ts。 */
export function prepareCommitContinuation(inputs: NodeInputs): any {
    return {
        prepare_commit_continuation_prepared_task: prepared("commit", {
            request: inputs["era.api.request"].value,
            executionState: inputs["era.batch.execution.state"].value,
        }, inputs["era.task.continuation.context"].value),
    };
}
/** 接收脚本请求并保留原任务回执资料。 */
export function identifyTaskRequest(inputs: NodeInputs): any {
    return { ...routeFacadeNode(inputs), facade_continuation: inputs['era.task.continuation.context'].value };
}
/** 将历史同步请求转为共享消息流程可执行的任务。 */
export function prepareHistorySync(inputs: NodeInputs): any {
    const plan = planFacadeSync(envelope(inputs, 'era.api.request'));
    const continuation = inputs['era.task.continuation.context'].value;
    return { sync_prepared: plan.route === 'sync'
            ? prepared('sync', { step: plan.syncStep, executionState: inputs['era.batch.execution.state'].value }, { ...continuation, apiContext: plan })
            : prepared('direct', buildSyncFailure(plan), continuation) };
}
/** 读取提交窗口与正文，区分指令提交和工作台草稿。 */
export function* inspectSubmissionProgress(inputs: any, params: any, context: any): Generator<any, any, any> {
    const request = inputs['era.api.request.selected'].value;
    const read = yield* readWindowProgress({ ...inputs, 'era.api.request': { value: request } }, params, context);
    return { commit_inspected: read.facade_commit_inspected, workbench_request_kind: submissionKind(request) };
}
/** 复读提交目标，准备交给共享消息循环的正文与操作。 */
export function* prepareApplicationProgress(inputs: any, params: any, context: any): Generator<any, any, any> {
    const transaction = buildTransactionNode(inputs).facade_commit_transaction;
    const target = yield* readTargetProgress({ 'era.api.commit.transaction': { value: transaction } }, params, context);
    return yield* prepareApiBlocksProgress({ 'era.api.commit.target': { value: target.facade_commit_target } }, params, context);
}
/** 返回无需进入消息循环的跳过或失败回执。 */
export function returnImmediateResult(inputs: any): any {
    const route = inputs['era.api.commit.admission.route']?.value;
    const result = route === 'skipped' ? buildSkippedResult(inputs['era.api.commit.validated'].value) : buildFailureResult(inputs['era.api.commit.failure_context'].value);
    return { immediate_facade_result: mergeExclusiveResults([result]) };
}
/** 返回实际应用结果，并沿用原有异步保存安排。 */
export function* returnApplicationResultProgress(inputs: any, params: any, context: any): Generator<any, any, any> {
    return { applied_facade_result: mergeExclusiveResults([(yield* returnAppliedReceiptProgress(inputs, params, context)).facade_commit_result]) };
}
import { buildAppend, prepareCommitSync, buildCommittedResult } from '../../base_lib/facade_api_engine.ts';
import { planSyncWork } from '../../base_lib/sync/sync_work_preparation.ts';
import { consecutiveFacts, syncFailure, unwrapCapabilityFailure, type EraBlockStepStateV1 } from '../../base_lib/sync/sync_contracts.ts';
import { variablesForState } from '../../base_lib/sidecar_binding.ts';
import { diagnosticsForPlan } from '../../base_lib/sync/sync_result_policy.ts';
function messageFailure(error: unknown, fallbackCode: string) {
    const cause = unwrapCapabilityFailure(error);
    const code = isRecord(cause) && typeof cause.code === "string" && cause.code.length !== 0 ? cause.code : fallbackCode;
    const message = isRecord(cause) && typeof cause.message === "string" ? cause.message : String(cause);
    return syncFailure(code, message, "tavern");
}
export function* prepareApiBlocksProgress(inputs: any, _params: any, _context: any): Generator<any, any, any> {
    const target = inputs["era.api.commit.target"].value;
    const append = buildAppend(target);
    const original = target.request.dispatchContext;
    const messages = target.messages.map((message: any) => message.messageId === append.messageId
        ? { ...message, activeText: append.committedContent }
        : message);
    const dispatchContext = {
        ...original,
        messages,
        sourceBasis: target.sourceBasis,
        processingMessage: original.processingMessage?.messageId === append.messageId
            ? { ...original.processingMessage, activeText: append.committedContent }
            : original.processingMessage,
        stagedMessageUpdates: [
            ...original.stagedMessageUpdates.filter((update: any) => update.messageId !== append.messageId),
            { messageId: append.messageId, content: append.committedContent },
        ],
    };
    const prepared = prepareCommitSync({ ...append, dispatchContext });
    const working = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_working", input: {} }).working;
    const source = target.sourceBasis?.messages.find((message: any) => message.messageId === append.messageId);
    const applyToMessage = !working?.stage && source?.candidate?.exists === true &&
        (source.candidate.phase === "idle" || source.candidate.phase === "completed");
    let failure = target.readFailure;
    if (applyToMessage && !failure) {
        try {
            yield { kind: "resource", capability: "era.tavern.messages", operation: "read_context", input: {
                projection: "era-active-message-v2", range: append.messageId, requireClosedEditorFor: append.messageId,
            } };
        } catch (error) {
            failure = messageFailure(error, "ERA_API_TARGET_READ_FAILED");
        }
    }
    const work = planSyncWork({
        step: prepared.syncStep,
        consecutive: consecutiveFacts(target.executionState),
        status: working && !failure ? "ready" : "failed",
        messagesRaw: { messages },
        variablesRaw: working
            ? variablesForState(working.record.state, working.record.sidecarId)
            : null,
        failure: failure ??
            (working
                ? null
                : syncFailure("ERA_WORKING_STATE_MISSING", "当前聊天变量尚未就绪。", "domain")),
    });
    // Pending writes from earlier commits belong to this same save batch.
    const previous = working?.work?.plan;
    const merged = work.plan &&
        work.plan.status !== "failed" &&
        previous &&
        previous.status !== "failed"
        ? {
            ...work,
            plan: {
                ...work.plan,
                messageUpdates: [
                    ...previous.messageUpdates.filter((update: any) => !work.plan!.messageUpdates.some((next: any) => next.messageId === update.messageId)),
                    ...work.plan.messageUpdates,
                ],
            },
        }
        : work;
    const state: EraBlockStepStateV1 = {
        work: merged,
        done: work.disposition !== "commit",
        sourceBasis: target.sourceBasis,
        scopeWindow: target.window,
        apiContext: { ...prepared.context, ...(applyToMessage && working ? { beforeApplication: working } : {}) },
    };
    return { block_step_state: state };
}
export function* returnAppliedReceiptProgress(inputs: any, _params: any, _context: any): Generator<any, any, any> {
    const state = inputs["era.sync.block.step.state.next"]
        .value as EraBlockStepStateV1;
    if (!state.apiContext)
        throw new TypeError("API 应用缺少请求上下文。");
    if (state.work.disposition === "failed") {
        return {
            facade_commit_result: buildFailureResult({
                context: state.apiContext,
                error: state.work.failure,
            }),
        };
    }
    const working = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_working", input: {} }).working;
    if (state.work.disposition === "commit") {
        const owner = state.sourceBasis?.identity;
        if (!owner || !working || working.identity.chatId !== owner.chatId ||
            working.identity.characterId !== owner.characterId || working.identity.groupId !== owner.groupId) {
            return { facade_commit_result: buildFailureResult({ context: state.apiContext,
                error: syncFailure("ERA_API_WINDOW_CHANGED", "提交回执前聊天已切换。", "cancelled"),
            }) };
        }
        const before = state.apiContext.beforeApplication as any;
        if (before) {
            const messageId = state.apiContext.messageId;
            const content = working.work?.plan?.messageUpdates.find((update: any) => update.messageId === messageId)?.content;
            const source = state.sourceBasis?.messages.find((message: any) => message.messageId === messageId);
            try {
                if (!source || content?.kind !== "text") throw new Error("提交缺少目标楼层的文本更新。");
                const applied = yield { kind: "resource", capability: "era.tavern.messages", operation: "update_content", input: {
                    ...state.apiContext.capabilityInput as object, content: content.text, expectedSidecarId: working.record.sidecarId,
                } };
                if (applied?.status !== "applied") throw new Error(applied?.message ?? "酒馆未确认正文已写入。");
                yield { kind: "resource", capability: "era.tavern.sidecar", operation: "write_working", input: {
                    ...working, expectedVersion: working.version, sourceBasis: applied.sourceBasis, publishApplied: true,
                    appliedMessageWrites: retainAppliedMessageWrite(working, source, content.text),
                } };
            } catch (error) {
                // 写入目标变化时仍以当前宿主事实核对回退归属，保留上一项已应用的操作。
                try {
                    const current = yield { kind: "resource", capability: "era.tavern.messages", operation: "read_context", input: {
                        projection: "era-active-message-v2", range: "0--1",
                    } };
                    yield { kind: "resource", capability: "era.tavern.sidecar", operation: "write_working", input: {
                        ...before, expectedVersion: working.version,
                        expectedSourceBasis: { identity: state.sourceBasis?.identity, messages: current.messages },
                    } };
                } catch (rollbackError) {
                    // 已切换的聊天由原身份的恢复流程处理，不能把旧工作写进当前聊天。
                    if ((unwrapCapabilityFailure(rollbackError) as any)?.code !== "ERA_MESSAGE_WRITE_TARGET_CHANGED") throw rollbackError;
                }
                return { facade_commit_result: buildFailureResult({ context: state.apiContext,
                    error: messageFailure(error, "ERA_API_MESSAGE_APPLY_FAILED"),
                }) };
            }
        }
        else {
            // 原生候选的正文仍由生成流程负责。外部回执也应提供本次已经完整应用的变量。
            yield { kind: "resource", capability: "era.tavern.sidecar", operation: "write_working", input: {
                ...working, expectedVersion: working.version, publishApplied: true,
            } };
        }
        if (!working.stage) yield { kind: "resource", capability: "era.lifecycle.admission", operation: "schedule", input: {
                key: "era-working-save",
                delayMs: 200,
                maxDelayMs: 2000,
                event: {
                    type: "manual_sync",
                    source: "era-api",
                    args: [],
                },
            } };
    }
    return {
        facade_commit_result: buildCommittedResult({
            status: state.work.disposition === "commit" ? "committed" : "no-op",
            settlements: [],
            notifications: [],
            diagnostics: diagnosticsForPlan(state.work.plan, state.work.step),
        }, {
            ...(state.apiContext as object),
            ...(state.scopeWindow ? { window: state.scopeWindow } : {}),
        }),
    };
}
/** 区分工作台草稿和直接提交的指令。 */
export function submissionKind(request: any): string { return request.detail.command === "workbench-commit" ? "draft" : "operations"; }
