/** Preserve an application failure even when its successful prefix was saved. */
export function run(inputs: any, _params: any, context: any): any {
  const result = inputs["era.tavern.commit.result"].value;
  const work =
    result.mode === "non-commit" ? result.work : result.blockStepState?.work;
  const sourceChanged =
    result.sourceChanged === true ||
    work?.failure?.code === "ERA_MESSAGE_WRITE_TARGET_CHANGED";
  // A Helper edit may only render the new text, without a separate edit event.
  // The rejected write must therefore hand the changed source back to the
  // ordinary history synchronizer instead of leaving a dirty snapshot pending.
  if (sourceChanged) {
    context.capabilities["era.lifecycle.admission"].schedule({
      key: "era-working-save",
      delayMs: 0,
      maxDelayMs: 0,
      event: {
        type: "era.facade.sync",
        source: "era-api",
        args: [{ mode: "full" }],
      },
    });
  }
  if (result.status === "committed" && !sourceChanged) {
    const working = context.capabilities["era.tavern.sidecar"].read_working(
      {},
    ).working;
    if (!working?.dirty)
      context.capabilities["era.lifecycle.admission"].cancel({
        key: "era-working-save",
      });
  }
  return {
    completed_sync_result:
      (result.status === "committed" || result.status === "no-op") &&
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
