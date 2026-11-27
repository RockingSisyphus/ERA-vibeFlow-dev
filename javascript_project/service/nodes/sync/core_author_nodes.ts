/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { acknowledgeCompletedCommitProgress, functionEffectProgress, acknowledgeImmediateRequestProgress, beginAuthorFunctionProgress, finishAuthorFunctionProgress, inspectAuthorCall, prepareFunctionCommit, recordHostFailureProgress, rejectFunctionSyncProgress, releaseTerminalFunctionProgress, routeAuthorLifecycle, routeFunctionEvent, waitFunctionEventProgress, } from "../../base_lib/sync/position_author.ts";
/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/route_author_lifecycle.ts。 */
export function RouteAuthorLifecycleNode(inputs: any, _params: any, _context: any): any {
    const result = routeAuthorLifecycle(inputs["era.sync.position.state"].value);
    return {
        route_author_lifecycle_position_state: result.state,
        route_author_lifecycle_author_lifecycle_route: result.route,
    };
}
/** 一次作者函数处理结束后才返回外层位置，不把中间状态当成多个最终结果。 */
export function CompleteAuthorStepNode(inputs: any): any {
    return {
        complete_author_step_position_state: inputs["era.sync.author.state"].value,
    };
}
function* finishEffectProgress(result: any, _context: any): Generator<any, any, any> {
    return result.route === 'failed' ? yield* recordHostFailureProgress(result.state, "era.tavern.functions") : result.state;
}
/** 读取正文调用，启动作者函数或记录解析结果。 */
export function* BeginAuthorCallProgress(inputs: any, _params: any, context: any): Generator<any, any, any> {
    const inspected = inspectAuthorCall(inputs['era.sync.author.state'].value);
    const effect = yield* functionEffectProgress(inspected.state, function* (state: any): Generator<any, any, any> {
        return inspected.route === 'valid' ? yield* beginAuthorFunctionProgress(state, "era.tavern.functions") : yield* finishAuthorFunctionProgress(state, "era.tavern.functions");
    });
    return { begin_author_call_author_state: yield* finishEffectProgress(effect, context) };
}
/** 确认已经应用的提交，等待作者函数下一步事件。 */
export function* ReceiveAuthorEventProgress(inputs: any, _params: any, context: any): Generator<any, any, any> {
    const ack = yield* functionEffectProgress(inputs['era.sync.author.state'].value, function* (state: any): Generator<any, any, any> {
        return yield* acknowledgeCompletedCommitProgress(state, "era.tavern.functions");
    });
    if (ack.route === 'failed')
        return { receive_author_event_author_state: yield* finishEffectProgress(ack, context), author_event: 'complete', author_finish: false };
    const event = routeFunctionEvent(yield* waitFunctionEventProgress(ack.state, context));
    return { receive_author_event_author_state: event.state, author_event: event.route, author_finish: event.route === 'done' || event.route === 'failed' };
}
/** 将作者提交接入当前正文；立即完成的请求就地回告。 */
export function* PrepareAuthorCommitProgress(inputs: any, _params: any, context: any): Generator<any, any, any> {
    const commit = prepareFunctionCommit(inputs['era.sync.author.state'].value);
    const state = commit.route === 'failed' ? yield* recordHostFailureProgress(commit.state, "era.tavern.functions") : commit.route === 'immediate' ? yield* finishEffectProgress(yield* functionEffectProgress(commit.state, function* (state: any): Generator<any, any, any> {
        return yield* acknowledgeImmediateRequestProgress(state, "era.tavern.functions");
    }), context) : commit.state;
    return { prepare_author_commit_author_state: state };
}
/** 回告运行中作者函数的历史同步请求。 */
export function* AnswerAuthorSyncProgress(inputs: any, _params: any, context: any): Generator<any, any, any> {
    return { answer_author_sync_author_state: yield* finishEffectProgress(yield* functionEffectProgress(inputs['era.sync.author.state'].value, function* (state: any): Generator<any, any, any> {
            return yield* rejectFunctionSyncProgress(state, "era.tavern.functions");
        }), context) };
}
/** 作者调用结束后，整理正文标记并释放运行资料。 */
export function* FinishAuthorCallProgress(inputs: any, _params: any, context: any): Generator<any, any, any> {
    const state = inputs['era.sync.author.state'].value;
    const functions = "era.tavern.functions";
    return { finish_author_call_author_state: inputs['era.sync.author.lifecycle.route']?.value === 'terminal' ? yield* releaseTerminalFunctionProgress(state, functions) : inputs['era.sync.author.event.action']?.value === 'failed' ? yield* recordHostFailureProgress(state, functions) : yield* finishEffectProgress(yield* functionEffectProgress(state, function* (next: any): Generator<any, any, any> {
            return yield* finishAuthorFunctionProgress(next, functions);
        }), context) };
}
