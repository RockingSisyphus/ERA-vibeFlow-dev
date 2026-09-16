import { prepareSessionWrite } from "../../base_lib/agent_session_binding.ts";

/** Install the retained history before a replacement stage model request. */
export function run(inputs: any, _params: any, runtime: any): any {
  let request = inputs["era.agent.generation.request"].value;
  const step = inputs["era.step.request.routed"].value;
  const baseline = request.context?.stageBaseline;
  if (baseline) {
    try {
      const sidecar = runtime.capabilities["era.tavern.sidecar"];
      const working = sidecar.read_working({}).working;
      if (!working) throw new Error("ERA_WORKING_STATE_MISSING");
      const { plan, floor, content } = baseline;
      const index = plan.messages.findIndex(
        (message: any) => message.messageId === floor?.messageId,
      );
      const { SidecarId: _pointer, ...eraMeta } = plan.meta;
      sidecar.write_working({
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
              ...plan.messageUpdates.filter(
                (update: any) => update.messageId !== floor.messageId,
              ),
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
      });
      const agent = runtime.capabilities["era.tavern.agent"];
      const chatKey = request.context.identity.chatId;
      if (request.context.session) agent.write_session(
        prepareSessionWrite(
          { chatKey, session: request.context.session },
          agent.read_session_binding({ chatKey }),
        ),
      );
    } catch (error) {
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
