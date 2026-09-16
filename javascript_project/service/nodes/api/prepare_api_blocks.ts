import {
  buildAppend,
  prepareCommitSync,
} from "../../base_lib/facade_api_engine.ts";
import { planSyncWork } from "../../base_lib/sync_planning.ts";
import {
  consecutiveFacts,
  syncFailure,
} from "../../base_lib/sync_contracts.ts";
import { variablesForState } from "../../base_lib/sidecar_binding.ts";
import type { EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";

/** Build an in-memory message edit and hand it to the ordinary block planner. */
export function run(inputs: any, _params: any, context: any): any {
  const target = inputs["era.api.commit.target"].value;
  const append = buildAppend(target);
  const original = target.request.dispatchContext;
  const messages = target.messages.map((message: any) =>
    message.messageId === append.messageId
      ? { ...message, activeText: append.committedContent }
      : message,
  );
  const dispatchContext = {
    ...original,
    messages,
    sourceBasis: target.sourceBasis,
    processingMessage:
      original.processingMessage?.messageId === append.messageId
        ? { ...original.processingMessage, activeText: append.committedContent }
        : original.processingMessage,
    stagedMessageUpdates: [
      ...original.stagedMessageUpdates.filter(
        (update: any) => update.messageId !== append.messageId,
      ),
      { messageId: append.messageId, content: append.committedContent },
    ],
  };
  const prepared = prepareCommitSync({ ...append, dispatchContext });
  const working = context.capabilities["era.tavern.sidecar"].read_working(
    {},
  ).working;
  const work = planSyncWork(
    {
      step: prepared.syncStep,
      consecutive: consecutiveFacts(target.executionState),
      status: working && !target.readFailure ? "ready" : "failed",
      messagesRaw: { messages },
      variablesRaw: working
        ? variablesForState(working.record.state, working.record.sidecarId)
        : null,
      failure:
        target.readFailure ??
        (working
          ? null
          : syncFailure(
              "ERA_WORKING_STATE_MISSING",
              "当前聊天变量尚未就绪。",
              "domain",
            )),
    },
    true,
  );
  // Pending writes from earlier commits belong to this same save batch.
  const previous = working?.work?.plan;
  const merged =
    work.plan &&
    work.plan.status !== "failed" &&
    previous &&
    previous.status !== "failed"
      ? {
          ...work,
          plan: {
            ...work.plan,
            messageUpdates: [
              ...previous.messageUpdates.filter(
                (update: any) =>
                  !work.plan!.messageUpdates.some(
                    (next: any) => next.messageId === update.messageId,
                  ),
              ),
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
    apiContext: prepared.context,
  };
  return { block_step_state: state };
}
