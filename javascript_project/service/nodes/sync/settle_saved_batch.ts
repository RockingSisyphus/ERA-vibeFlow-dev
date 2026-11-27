/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
/** Preserve an application failure even when its successful prefix was saved. */
export function* runProgress(inputs: any, _params: any, _context: any): Generator<any, any, any> {
    const result = inputs["era.tavern.commit.result"].value;
    const work = result.mode === "non-commit" ? result.work : result.blockStepState?.work;
    const sourceChanged = result.sourceChanged === true ||
        work?.failure?.code === "ERA_MESSAGE_WRITE_TARGET_CHANGED";
    // A Helper edit may only render the new text, without a separate edit event.
    // The rejected write must therefore hand the changed source back to the
    // ordinary history synchronizer instead of leaving a dirty snapshot pending.
    if (sourceChanged) {
        yield { kind: "resource", capability: "era.lifecycle.admission", operation: "schedule", input: {
                key: "era-working-save",
                delayMs: 0,
                maxDelayMs: 0,
                event: {
                    type: "manual_full_sync",
                    source: "era-api",
                    args: [],
                },
            } };
    }
    if (result.status === "committed" && !sourceChanged) {
        const working = (yield { kind: "resource", capability: "era.tavern.sidecar", operation: "read_working", input: {} }).working;
        if (!working?.dirty)
            yield { kind: "resource", capability: "era.lifecycle.admission", operation: "cancel", input: {
                    key: "era-working-save",
                } };
    }
    return {
        completed_sync_result: (result.status === "committed" || result.status === "no-op") &&
            work?.disposition === "failed"
            ? {
                ...result,
                status: "failed",
                failure: work.failure,
                initialPresentation: null,
            }
            : result,
    };
}
