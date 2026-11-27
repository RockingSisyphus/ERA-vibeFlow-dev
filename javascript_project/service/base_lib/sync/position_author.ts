/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { currentFunctionBlock, finishFunction, functionApiSettlement, prepareFunctionApi, } from "./function_block_execution.ts";
import { syncFailure, unwrapCapabilityFailure } from "./sync_contracts.ts";
import { blockExecutionIsTerminal, forkPosition, type PositionState, } from "./position_source.ts";
export function routeAuthorLifecycle(input: PositionState): {
    state: PositionState;
    route: string;
} {
    const state = input.state;
    return {
        state: input,
        route: blockExecutionIsTerminal(state)
            ? "terminal"
            : state.functionFrame?.phase === "start"
                ? "start"
                : "wait",
    };
}
export function* releaseTerminalFunctionProgress(input: PositionState, functions: any): Generator<any, PositionState, any> {
    let position = forkPosition(input);
    const state = position.state, frame = state.functionFrame;
    try {
        if (frame) {
            if (frame.request && state.work.failure)
                yield { kind: "resource", capability: functions, operation: "acknowledge", input: {
                        id: frame.id,
                        requestId: frame.request.id,
                        settlement: functionApiSettlement(state, frame.request, null, state.work.failure),
                    } };
            yield { kind: "resource", capability: functions, operation: "release", input: { id: frame.id } };
        }
        const plan: any = state.work.plan;
        position.state = {
            ...state,
            done: true,
            functionFrame: null,
            ...(plan?.execution?.messageIndex >= plan?.execution?.endIndex
                ? { work: { ...state.work, plan: { ...plan, execution: null } } }
                : {}),
        };
    }
    catch (error) {
        position = yield* recordHostFailureProgress({ ...position, failure: hostFailureFacts(error) }, functions);
    }
    return position;
}
export function inspectAuthorCall(input: PositionState): {
    state: PositionState;
    route: string;
} {
    const state = forkPosition(input), { block, message } = currentFunctionBlock(state.state);
    state.position = {
        ...(state.position ?? {}),
        sourceMessageId: message.messageId,
    };
    if (block.call.diagnostics.length) {
        state.incomingFunctionEvent = {
            kind: "done",
            error: {
                code: block.call.diagnostics[0].code,
                message: block.call.diagnostics
                    .map((item: any) => item.message)
                    .join(" "),
            },
        };
        return { state, route: "invalid" };
    }
    return { state, route: "valid" };
}
export function* beginAuthorFunctionProgress(input: PositionState, functions: any): Generator<any, PositionState, any> {
    const position = forkPosition(input), state = position.state, frame = state.functionFrame!, { block } = currentFunctionBlock(state);
    yield { kind: "resource", capability: functions, operation: "begin", input: {
            id: frame.id,
            name: block.call.name,
            args: block.call.args,
            sourceBasis: state.sourceBasis,
        } };
    position.state = { ...state, functionFrame: { ...frame, phase: "waiting" } };
    return position;
}
export function* acknowledgeCompletedCommitProgress(input: PositionState, functions: any): Generator<any, PositionState, any> {
    const position = forkPosition(input), state = position.state, frame = state.functionFrame!;
    if (frame.request) {
        yield { kind: "resource", capability: functions, operation: "acknowledge", input: {
                id: frame.id,
                requestId: frame.request.id,
                settlement: functionApiSettlement(state, frame.request, frame.request.receiptValue),
            } };
        position.state = {
            ...state,
            functionFrame: { ...frame, phase: "waiting", request: null },
        };
    }
    return position;
}
export function* waitFunctionEventProgress(input: PositionState, _runtime: any): Generator<any, PositionState, any> {
    const state = forkPosition(input);
    try {
        state.incomingFunctionEvent = yield { kind: "resource", capability: "era.tavern.functions", operation: "next", input: { id: state.state.functionFrame!.id } };
        if (state.incomingFunctionEvent.kind !== "done")
            state.position = {
                ...(state.position ?? {}),
                identity: yield { kind: "resource", capability: "era.tavern.identity", operation: "read", input: {
                        purpose: "era-function-api",
                    } },
            };
    }
    catch (error) {
        state.failure = hostFailureFacts(error);
    }
    return state;
}
export function routeFunctionEvent(input: PositionState): {
    state: PositionState;
    route: string;
} {
    const incoming = input.incomingFunctionEvent;
    return {
        state: input,
        route: input.failure
            ? "failed"
            : incoming.kind === "done"
                ? "done"
                : incoming.type === "era.facade.commit"
                    ? "commit"
                    : "unsupported",
    };
}
export function* rejectFunctionSyncProgress(input: PositionState, functions: any): Generator<any, PositionState, any> {
    const state = input.state, request = input.incomingFunctionEvent;
    yield { kind: "resource", capability: functions, operation: "acknowledge", input: {
            id: state.functionFrame!.id,
            requestId: request.id,
            settlement: functionApiSettlement(state, request, null, {
                code: "ERA_FUNCTION_SYNC_UNSUPPORTED",
                message: "消息内函数禁止重算或回退，请在调用结束后由外部发起。",
                layer: "domain",
            }),
        } };
    return input;
}
export function prepareFunctionCommit(input: PositionState): {
    state: PositionState;
    route: string;
} {
    const position = forkPosition(input);
    try {
        const prepared = prepareFunctionApi(position.state, position.incomingFunctionEvent, position.position.identity);
        position.state = prepared.state;
        position.position = {
            ...position.position,
            settlement: prepared.settlement,
        };
        return {
            state: position,
            route: prepared.settlement ? "immediate" : "apply",
        };
    }
    catch (error) {
        return {
            state: { ...position, failure: hostFailureFacts(error) },
            route: "failed",
        };
    }
}
export function* acknowledgeImmediateRequestProgress(input: PositionState, functions: any): Generator<any, PositionState, any> {
    yield { kind: "resource", capability: functions, operation: "acknowledge", input: {
            id: input.state.functionFrame!.id,
            requestId: input.incomingFunctionEvent.id,
            settlement: input.position.settlement,
        } };
    return input;
}
export function* finishAuthorFunctionProgress(input: PositionState, functions: any): Generator<any, PositionState, any> {
    const position = forkPosition(input), frame = position.state.functionFrame!;
    const { message } = currentFunctionBlock(position.state);
    position.state = finishFunction(position.state, position.incomingFunctionEvent?.error);
    if (frame.phase !== "start")
        yield { kind: "resource", capability: functions, operation: "release", input: { id: frame.id } };
    position.position = {
        ...(position.position ?? {}),
        sourceMessageId: message.messageId,
    };
    position.consumedSource = true;
    return position;
}
export function* recordHostFailureProgress(input: PositionState, functions: any): Generator<any, PositionState, any> {
    const position = forkPosition(input), state = position.state;
    const reason = unwrapCapabilityFailure(input.failure) as any;
    if (state.functionFrame) {
        try {
            yield { kind: "resource", capability: functions, operation: "release", input: { id: state.functionFrame.id } };
        }
        catch {
            /* 取消的宿主自行清理。 */
        }
    }
    position.state = {
        ...state,
        done: true,
        functionFrame: null,
        work: {
            ...state.work,
            disposition: "failed",
            failure: syncFailure(reason?.code ?? "ERA_FUNCTION_CONTEXT_FAILED", reason?.message ?? String(reason), "tavern"),
        },
    };
    return position;
}
/** 宿主操作失败沿显式 failed 边进入收尾，不隐去 Console 或放宽业务期待。 */
export function* functionEffectProgress(input: PositionState, action: any): Generator<any, {
    state: PositionState;
    route: string;
}, any> {
    try {
        return { state: yield* action(input), route: "ok" };
    }
    catch (error) {
        return {
            state: { ...input, failure: hostFailureFacts(error) },
            route: "failed",
        };
    }
}
/** 跨节点只传可序列化的错误事实，保留能力包装的原始错误码和说明。 */
function hostFailureFacts(error: any): any {
    error = unwrapCapabilityFailure(error);
    return {
        ...(typeof error?.code === "string" ? { code: error.code } : {}),
        message: typeof error?.message === "string" ? error.message : String(error),
    };
}
