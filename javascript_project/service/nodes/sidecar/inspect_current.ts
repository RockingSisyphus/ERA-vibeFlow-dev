/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
import { prepareSessionWrite } from "../../base_lib/agent/agent_session_binding.ts";
import { interruptedCandidateRecovery, nativeCandidateRecovery } from "../../base_lib/working_state.ts";
import { inspectSidecar, sidecarSourceBasis, sidecarInitialId, assertSidecarCurrent, sameSidecarValue, failedSidecarContext, type SyncContextV1, } from "../../base_lib/sidecar_binding.ts";
interface Ctx {
    readonly capabilities: {
        readonly "era.tavern.agent": any;
        readonly "era.tavern.sidecar": {
            read_current(input: Readonly<Record<string, unknown>>): Promise<unknown>;
            read_working(input: Readonly<Record<string, unknown>>): any;
            write_working(input: Readonly<Record<string, unknown>>): any;
            read_record(input: Readonly<Record<string, unknown>>): Promise<unknown>;
        };
    };
}
export function* runProgress(inputs: Readonly<{
    "era.sync.context": {
        readonly value: unknown;
    };
}>, _params: Readonly<Record<string, unknown>>, _context: Ctx): Generator<any, any, any> {
    const sync = inputs["era.sync.context"].value as SyncContextV1;
    try {
        const basis = sync.status === "failed" ? null : sidecarSourceBasis(sync);
        const current = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_current", input: {} };
        const initial = inspectSidecar(current, null);
        if (basis)
            assertSidecarCurrent(current, basis, sidecarInitialId(sync));
        let working = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_working", input: {} }).working;
        const nativeRecovery = basis ? nativeCandidateRecovery(working, basis) : null;
        if (nativeRecovery) {
            working = (yield {kind:"resource",capability:"era.tavern.sidecar",operation:"write_working",input:{...nativeRecovery,expectedVersion:working.version,expectedSourceBasis:basis}}).working;
        }
        // 恢复已通过当前来源及版本校验；后续比较应包含本次写入的工作状态，仍核对其他来源事实。
        const expectedCurrent = nativeRecovery ? { ...current, working } : current;
        const recovery = basis && working?.record?.sidecarId === initial.sidecarId
            ? interruptedCandidateRecovery(working, (sync.step as any).dispatchContext?.sourceBasis)
            : null;
        const record = initial.sidecarId === null
            ? null
            : working?.record?.sidecarId === initial.sidecarId
                ? {
                    status: "found",
                    sidecarId: initial.sidecarId,
                    record: recovery?.working.record ?? working.record,
                }
                : yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_record", input: {
                        sidecarId: initial.sidecarId,
                    } };
        const latest = yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_current", input: {} };
        if (basis)
            assertSidecarCurrent(latest, basis, initial.sidecarId);
        if (!sameSidecarValue(expectedCurrent, latest))
            throw new Error("Sidecar 读取期间来源状态已变化。");
        if (recovery) {
            const chatKey = (sync.step as any).dispatchContext.sourceBasis.identity.chatId;
            const agent = "era.tavern.agent";
            if (recovery.session) {
                yield { kind: "resource", capability: agent, operation: "write_session", input: prepareSessionWrite({ chatKey, session: recovery.session }, yield { kind: "resource", capability: agent, operation: "read_session_binding", input: { chatKey } }) };
            }
            else
                yield { kind: "resource", capability: agent, operation: "clear_session", input: { chatKey } };
            yield { kind: "resource", capability: "era.tavern.sidecar", operation: "write_working", input: {
                    ...recovery.working, expectedVersion: working.version, expectedSourceBasis: basis,
                } };
        }
        return {
            sidecar_binding_input: { sync },
            sidecar_binding_facts: inspectSidecar(current, record),
        };
    }
    catch (error) {
        return {
            sidecar_binding_input: { sync: failedSidecarContext(sync, error) },
            sidecar_binding_facts: inspectSidecar(null, null),
        };
    }
}
