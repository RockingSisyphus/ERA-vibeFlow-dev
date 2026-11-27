/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { assertSidecarCurrent, durableFunctionRestoreInstruction, durableRestoreInstruction, enrich, factsWithRecord, failedSidecarContext, inspectSidecar, recordFor, sameSidecarValue, sidecarSourceBasis, stateForIndependentCopy, stateFromRecord, type SidecarRecordV1, type SidecarResolutionV1, type SyncContextV1 } from "../../base_lib/sidecar_binding.ts";
import { isRecord, stateFromSync, withAppendedRestore, withSidecarId } from "../../base_lib/sidecar_resolution_projection.ts";
import { matchesAppliedMessage, overlayWorkingMessages } from "../../base_lib/working_state.ts";
interface Ctx {
    readonly capabilities: {
        readonly "era.tavern.sidecar": {
            read_current(input: Readonly<Record<string, unknown>>): Promise<unknown>;
            read_working(input: Readonly<Record<string, unknown>>): any;
            write_working(input: Readonly<Record<string, unknown>>): any;
            read_record(input: Readonly<Record<string, unknown>>): Promise<unknown>;
            write_record(input: Readonly<Record<string, unknown>>): Promise<unknown>;
            commit_metadata(input: Readonly<Record<string, unknown>>): Promise<unknown>;
            publish_snapshot(input: Readonly<Record<string, unknown>>): unknown;
            create_id(input: Readonly<Record<string, unknown>>): {
                sidecarId: string;
            };
            clear_prompt(input: Readonly<Record<string, unknown>>): unknown;
        };
        readonly "era.tavern.messages": {
            update_content(input: Readonly<Record<string, unknown>>): Promise<unknown>;
        };
    };
}
interface TransactionProgress {
    sync: SyncContextV1;
    messageWriteState: string;
    persistenceConfirmed: boolean;
    sourceChanged: boolean;
    fileWriteState: string;
}
function* recheckCurrentProgress(_context: Ctx, sync: SyncContextV1, expectedId: string | null): Generator<any, void, any> {
    const current = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_current", input: {} };
    assertSidecarCurrent(current, sidecarSourceBasis(sync), expectedId);
}
function* publishProgress(_context: Ctx, record: SidecarRecordV1, progress: TransactionProgress, expectedId: string | null): Generator<any, void, any> {
    const current = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_current", input: {} };
    assertSidecarCurrent(current, sidecarSourceBasis(progress.sync), expectedId);
    const committed = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "commit_metadata", input: {
            sidecarId: record.sidecarId,
            snapshot: record,
            expectedSidecarId: expectedId,
            sourceBasis: sidecarSourceBasis(progress.sync),
        } };
    if (!isRecord(committed) || committed.status !== "committed")
        throw new Error("Sidecar 聊天指针提交失败。");
    yield { kind: "resource", capability: "era.tavern.sidecar", operation: "write_working", input: {
            record,
            dirty: false,
        } };
}
function* commitV3Progress(context: Ctx, record: SidecarRecordV1, progress: TransactionProgress, expectedId: string | null): Generator<any, void, any> {
    yield* recheckCurrentProgress(context, progress.sync, expectedId);
    progress.fileWriteState = "attempted";
    const written = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "write_record", input: {
            sidecarId: record.sidecarId,
            record,
            expectedSidecarId: expectedId,
            sourceBasis: sidecarSourceBasis(progress.sync),
        } };
    if (!isRecord(written) || written.status !== "committed")
        throw new Error("Sidecar 文件写入未确认。");
    progress.fileWriteState = "written";
    const reread = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_record", input: {
            sidecarId: record.sidecarId,
        } };
    const verified = inspectSidecar({
        identity: record.owner,
        meta: { SidecarId: record.sidecarId },
        stat: null,
    }, reread);
    if (!sameSidecarValue(verified.record, record))
        throw new Error("Sidecar 文件回读的身份、版本或内容不一致。");
    progress.fileWriteState = "confirmed";
    yield* publishProgress(context, record, progress, expectedId);
}
function* applyResolutionProgress(inputs: Readonly<{
    "era.sidecar.binding.input": {
        readonly value: unknown;
    };
    "era.sidecar.binding.resolution": {
        readonly value: unknown;
    };
}>, context: Ctx, progress: TransactionProgress): Generator<any, any, any> {
    const sync = (inputs["era.sidecar.binding.input"].value as {
        readonly sync: SyncContextV1;
    }).sync;
    const resolution = inputs["era.sidecar.binding.resolution"]
        .value as SidecarResolutionV1;
    const { facts, choice } = resolution;
    // 派发上下文若已在 Sidecar 之前失败，就没有安全的消息/变量快照可迁移。
    // 此时保持原失败上下文由后续同步结果结算，绝不为了“修复绑定”去读取或清空
    // 聊天状态；否则一个无关的 Tavern 事件错误会制造 Sidecar 半事务。
    const syncStatus = (sync as {
        readonly status?: unknown;
    }).status;
    if (syncStatus !== undefined && syncStatus !== "ready") {
        // 严格消息投影尚未 ready 时，禁止任何迁移、修复或持久化事务；但 owner
        // 已匹配的 V3 文件已经是当前聊天唯一真相，可以安全恢复新页面实例的
        // 易失只读快照。该能力不触碰聊天指针或用户文件。
        if (resolution.route === "continue" &&
            facts.status === "matched" &&
            facts.record !== null) {
            const published = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "publish_snapshot", input: {
                    sidecarId: facts.record.sidecarId,
                    snapshot: facts.record,
                } };
            if (!isRecord(published) || published.status !== "published") {
                throw new TypeError("ERA 已匹配 Sidecar 运行时快照发布失败。");
            }
        }
        return {
            sidecar_applied_context: {
                ...sync,
                sidecarBinding: facts,
                sidecarBindingRoute: "continue",
                sidecarBindingChoice: null,
            },
            sidecar_binding_route: "continue",
        };
    }
    yield* recheckCurrentProgress(context, sync, facts.sidecarId);
    if (facts.sidecarId !== null) {
        const cached = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_working", input: {} }).working;
        const record = cached?.record?.sidecarId === facts.sidecarId
            ? { status: "found", sidecarId: facts.sidecarId, record: cached.record }
            : yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_record", input: {
                    sidecarId: facts.sidecarId,
                } };
        const current = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_current", input: {} };
        assertSidecarCurrent(current, sidecarSourceBasis(sync), facts.sidecarId);
        if (!sameSidecarValue(inspectSidecar(current, record), facts))
            throw new Error("Sidecar 决议对应的记录或来源已变化。");
    }
    if (resolution.route === "continue") {
        const cached = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_working", input: {} }).working;
        if (facts.record !== null && !cached) {
            yield* publishProgress(context, facts.record, progress, facts.sidecarId);
        }
        let withWorking = sync;
        if (cached?.dirty || cached?.nativeCandidate) {
            const currentStep = sync.step as Record<string, unknown>;
            const dispatch = currentStep.dispatchContext as any;
            const projected = overlayWorkingMessages(sync.messagesRaw, cached, dispatch.sourceBasis, dispatch.stagedMessageUpdates);
            const staged = new Map<number, string>(dispatch.stagedMessageUpdates.map((update: any) => [
                update.messageId,
                update.content,
            ]));
            // 外部提交的正文已在宿主内存。保留仍匹配的写入，让同一批保存确认聊天文件后再保存 Sidecar。
            for (const { source, content } of cached.appliedMessageWrites ?? []) {
                const actual = dispatch.sourceBasis.messages.find((message: any) => message.messageId === source.messageId);
                if (!staged.has(source.messageId) && matchesAppliedMessage(source, actual) &&
                    actual.activeText === content) {
                    staged.set(source.messageId, content);
                }
            }
            for (const message of projected.messages) {
                const before = (sync.messagesRaw as any).messages.find((candidate: any) => candidate.messageId === message.messageId);
                if (before?.activeText !== message.activeText)
                    staged.set(message.messageId, message.activeText);
            }
            withWorking = {
                ...sync,
                messagesRaw: projected,
                step: {
                    ...currentStep,
                    dispatchContext: {
                        ...dispatch,
                        messages: projected.messages,
                        processingMessage: projected.messages.find((message: any) => message.messageId === dispatch.processingMessage?.messageId) ?? dispatch.processingMessage,
                        stagedMessageUpdates: [...staged].map(([messageId, content]) => ({
                            messageId,
                            content,
                        })),
                    },
                },
            };
        }
        return {
            sidecar_applied_context: enrich(withWorking, facts, "continue", choice),
            sidecar_binding_route: "continue",
        };
    }
    if (resolution.route === "blocked") {
        return {
            sidecar_applied_context: enrich(sync, facts, "blocked", choice),
            sidecar_binding_route: "blocked",
        };
    }
    if (facts.status === "create" && facts.current !== null) {
        const targetId = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "create_id", input: {} }).sidecarId;
        const resolved = withSidecarId(sync, targetId);
        const record = recordFor(targetId, facts.current, stateFromSync(resolved, facts), null);
        yield* commitV3Progress(context, record, progress, facts.sidecarId);
        // `apply` 只属于本 Nodeset 内部的决议阶段；事务已经完成后，输出给
        // task_sync 的同步上下文必须是可继续的正式路由。把它泄露为 `apply`
        // 会在工作流数据合同校验处被拒绝，导致已经完成的宿主写入无法结算。
        return {
            sidecar_applied_context: enrich(resolved, factsWithRecord(facts, record), "continue", choice),
            sidecar_binding_route: "continue",
        };
    }
    if (facts.status === "migrate-legacy" && facts.current !== null) {
        const targetId = facts.sidecarId ??
            (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "create_id", input: {} }).sidecarId;
        const resolved = withSidecarId(sync, targetId);
        const record = recordFor(targetId, facts.current, stateFromSync(resolved, facts), facts.record ?? facts.legacyRecord);
        yield* commitV3Progress(context, record, progress, facts.sidecarId);
        return {
            sidecar_applied_context: enrich(resolved, factsWithRecord(facts, record), "continue", choice),
            sidecar_binding_route: "continue",
        };
    }
    if ((facts.status === "invalid" || facts.status === "matched") &&
        facts.current !== null &&
        choice === "repair") {
        // 修复不是静默降级：只有用户点击明确的修复动作后，才会保留可用 ID 或分配新 ID，
        // 并以当前聊天已提交/可重放的 stat_data 重建本地镜像。
        const targetId = facts.sidecarId ??
            (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "create_id", input: {} }).sidecarId;
        const resolved = withSidecarId(sync, targetId);
        // 使用刚刚核对的记录作为修复基线；缺失或损坏记录时使用原任务的可重放状态。
        const record = recordFor(targetId, facts.current, facts.record === null
            ? stateFromSync(resolved, facts)
            : stateFromRecord(facts.record), facts.record);
        yield* commitV3Progress(context, record, progress, facts.sidecarId);
        yield* recheckCurrentProgress(context, progress.sync, record.sidecarId);
        yield { kind: "resource", capability: "era.tavern.sidecar", operation: "clear_prompt", input: {
                sourceBasis: sidecarSourceBasis(progress.sync),
                expectedSidecarId: record.sidecarId,
            } };
        // 文件失败前已经确认写入的 Variable 指令是唯一可重放事实。repair 先恢复
        // 一个经过回读验证的 V3 基线，再强制完整同步，使该指令重新得出状态；绝不
        // 读取聊天变量作为后备状态，也不把旧 Sidecar 快照当作最终恢复结果。
        return {
            sidecar_applied_context: enrich(resolved, factsWithRecord(facts, record), "continue", choice),
            sidecar_binding_route: "continue",
        };
    }
    if (facts.status !== "conflict" ||
        facts.current === null ||
        facts.record === null ||
        choice === null) {
        throw new TypeError("Sidecar 绑定决议无效；请重新检查当前聊天。");
    }
    const targetId = choice === "migrate"
        ? facts.record.sidecarId
        : (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "create_id", input: {} }).sidecarId;
    let resolved = sync;
    if (choice === "migrate" || choice === "copy") {
        const messages = (sync.messagesRaw as {
            readonly messages?: readonly {
                readonly messageId: number;
                readonly role: string;
                readonly activeText: string;
            }[];
        })?.messages ?? [];
        const lastAi = [...messages]
            .reverse()
            .find((item) => item.role === "assistant");
        if (lastAi === undefined || typeof lastAi.activeText !== "string")
            throw new TypeError("当前聊天没有可追加恢复指令的 AI 消息。");
        const restoreVariables = durableRestoreInstruction(stateFromSync(sync, facts).statData, facts.record.state.statData);
        const restoreFunctions = durableFunctionRestoreInstruction(stateFromSync(sync, facts).statFunc, facts.record.state.statFunc);
        if (restoreVariables === null || restoreFunctions === null) {
            throw new TypeError("当前聊天含有无法安全替换的受保护变量或函数库；请先修复当前聊天。");
        }
        const restore = `${restoreVariables}${restoreFunctions}`;
        progress.messageWriteState = "attempted";
        const saved = yield { kind: "resource", capability: "era.tavern.messages", operation: "update_content", input: {
                messageId: lastAi.messageId,
                content: `${lastAi.activeText}${restore}`,
                sourceBasis: sidecarSourceBasis(sync),
                expectedSidecarId: facts.sidecarId,
                purpose: "era-sidecar-restore",
            } };
        if (!isRecord(saved) || saved.status !== "committed") {
            if (isRecord(saved)) {
                progress.messageWriteState =
                    typeof saved.writeState === "string" ? saved.writeState : "attempted";
                progress.persistenceConfirmed = saved.persistenceConfirmed === true;
                progress.sourceChanged = saved.sourceChanged === true;
            }
            throw new Error(isRecord(saved) && typeof saved.message === "string"
                ? saved.message
                : "恢复消息持久化未确认。");
        }
        progress.messageWriteState = "committed";
        progress.persistenceConfirmed = true;
        resolved = withAppendedRestore(sync, lastAi.messageId, `${lastAi.activeText}${restore}`);
        progress.sync = resolved;
    }
    resolved = withSidecarId(resolved, targetId);
    const state = choice === "independent"
        ? stateFromSync(resolved, facts)
        : choice === "copy"
            ? stateForIndependentCopy(facts.record)
            : stateFromRecord(facts.record);
    const record = recordFor(targetId, facts.current, state, choice === "migrate" ? facts.record : null);
    yield* commitV3Progress(context, record, progress, facts.sidecarId);
    yield* recheckCurrentProgress(context, progress.sync, record.sidecarId);
    yield { kind: "resource", capability: "era.tavern.sidecar", operation: "clear_prompt", input: {
            sourceBasis: sidecarSourceBasis(progress.sync),
            expectedSidecarId: record.sidecarId,
        } };
    // 同上：选择已经被事务消费，后续完整同步只接收规范的 continue 路由。
    return {
        sidecar_applied_context: enrich(resolved, factsWithRecord(facts, record), "continue", choice),
        sidecar_binding_route: "continue",
    };
}
/** 普通事务失败进入既有同步错误终态；保留已完成副作用，不自动补偿或重试。 */
export function* runProgress(inputs: Readonly<{
    "era.sidecar.binding.input": {
        readonly value: unknown;
    };
    "era.sidecar.binding.resolution": {
        readonly value: unknown;
    };
}>, _params: Readonly<Record<string, unknown>>, context: Ctx): Generator<any, any, any> {
    const progress: TransactionProgress = {
        sync: (inputs["era.sidecar.binding.input"].value as {
            sync: SyncContextV1;
        })
            .sync,
        messageWriteState: "not-written",
        persistenceConfirmed: false,
        sourceChanged: false,
        fileWriteState: "not-written",
    };
    try {
        return yield* applyResolutionProgress(inputs, context, progress);
    }
    catch (error) {
        return {
            sidecar_applied_context: failedSidecarContext(progress.sync, error, {
                messageWriteState: progress.messageWriteState,
                persistenceConfirmed: progress.persistenceConfirmed,
                fileWriteState: progress.fileWriteState,
                sourceChanged: progress.sourceChanged ||
                    (isRecord(error) &&
                        error.code === "ERA_MESSAGE_WRITE_TARGET_CHANGED"),
            }),
            sidecar_binding_route: "continue",
        };
    }
}
