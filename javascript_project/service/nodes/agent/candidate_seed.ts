/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { prepareSessionWrite } from "../../base_lib/agent/agent_session_binding.ts";
/** Install the retained history before a replacement stage model request. */
export function* runProgress(inputs: any, _params: any, _runtime: any): Generator<any, any, any> {
    let request = inputs["era.agent.generation.request"].value;
    const step = inputs["era.step.request.routed"].value;
    const baseline = request.context?.stageBaseline;
    if (baseline) {
        try {
            const sidecar = "era.tavern.sidecar";
            const working = (yield { kind: "resource", capability: sidecar, operation: "read_working", input: {} }).working;
            if (!working)
                throw new Error("ERA_WORKING_STATE_MISSING");
            const { plan, floor, content } = baseline;
            const index = plan.messages.findIndex((message: any) => message.messageId === floor?.messageId);
            const { SidecarId: _pointer, ...eraMeta } = plan.meta;
            yield { kind: "resource", capability: sidecar, operation: "write_working", input: {
                    expectedVersion: working.version,
                    record: {
                        ...working.record,
                        state: { statData: plan.stat, statFunc: plan.statFunc, eraMeta },
                    },
                    work: {
                        schemaVersion: 1,
                        step,
                        disposition: "commit",
                        payload: null,
                        failure: null,
                        plan: {
                            ...plan,
                            messageUpdates: floor ? [
                                ...plan.messageUpdates.filter((update: any) => update.messageId !== floor.messageId),
                                {
                                    kind: "update-message-content",
                                    messageId: floor.messageId,
                                    messageIndex: index,
                                    mk: floor.mk,
                                    content: { kind: "text", text: content },
                                },
                            ] : plan.messageUpdates,
                        },
                    },
                    sourceBasis: step.dispatchContext.sourceBasis,
                    stage: floor ? { ...floor, phase: baseline.phase } : null,
                    dirty: true,
                } };
            const agent = "era.tavern.agent";
            const chatKey = request.context.identity.chatId;
            if (request.context.session)
                yield { kind: "resource", capability: agent, operation: "write_session", input: prepareSessionWrite({ chatKey, session: request.context.session }, yield { kind: "resource", capability: agent, operation: "read_session_binding", input: { chatKey } }) };
        }
        catch (error) {
            request = {
                ...request,
                phase: "finish",
                disposition: {
                    mode: "execute-only",
                    status: "failed",
                    diagnostics: [
                        {
                            code: "ERA_AGENT_STAGE_BASELINE_FAILED",
                            message: error instanceof Error ? error.message : String(error),
                        },
                    ],
                },
            };
        }
    }
    return {
        candidate_state: {
            request,
            step,
            executionState: inputs["era.batch.execution.state"].value,
        },
    };
}
