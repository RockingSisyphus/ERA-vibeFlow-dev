import { prepareSessionWrite } from "../../base_lib/agent_session_binding.ts";
import { interruptedCandidateRecovery } from "../../base_lib/working_state.ts";
import {
  inspectSidecar,
  sidecarSourceBasis,
  sidecarInitialId,
  assertSidecarCurrent,
  sameSidecarValue,
  failedSidecarContext,
  type SyncContextV1,
} from "../../base_lib/sidecar_binding.ts";

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

export async function run(
  inputs: Readonly<{ "era.sync.context": { readonly value: unknown } }>,
  _params: Readonly<Record<string, unknown>>,
  context: Ctx,
): Promise<any> {
  const sync = inputs["era.sync.context"].value as SyncContextV1;
  try {
    const basis = sync.status === "failed" ? null : sidecarSourceBasis(sync);
    const current = await context.capabilities[
      "era.tavern.sidecar"
    ].read_current({});
    const initial = inspectSidecar(current, null);
    if (basis) assertSidecarCurrent(current, basis, sidecarInitialId(sync));
    let working = context.capabilities["era.tavern.sidecar"].read_working(
      {},
    ).working;
    const recovery = basis && working?.record?.sidecarId === initial.sidecarId
      ? interruptedCandidateRecovery(working, (sync.step as any).dispatchContext?.sourceBasis)
      : null;
    const record =
      initial.sidecarId === null
        ? null
        : working?.record?.sidecarId === initial.sidecarId
          ? {
              status: "found",
              sidecarId: initial.sidecarId,
              record: recovery?.working.record ?? working.record,
            }
          : await context.capabilities["era.tavern.sidecar"].read_record({
              sidecarId: initial.sidecarId,
            });
    const latest = await context.capabilities[
      "era.tavern.sidecar"
    ].read_current({});
    if (basis) assertSidecarCurrent(latest, basis, initial.sidecarId);
    if (!sameSidecarValue(current, latest))
      throw new Error("Sidecar 读取期间来源状态已变化。");
    if (recovery) {
      const chatKey = (sync.step as any).dispatchContext.sourceBasis.identity.chatId;
      const agent = context.capabilities["era.tavern.agent"];
      if (recovery.session) {
        agent.write_session(prepareSessionWrite({ chatKey, session: recovery.session },
          agent.read_session_binding({ chatKey })));
      } else agent.clear_session({ chatKey });
      context.capabilities["era.tavern.sidecar"].write_working({
        ...recovery.working, expectedVersion: working.version,
      });
    }
    return {
      sidecar_binding_input: { sync },
      sidecar_binding_facts: inspectSidecar(current, record),
    };
  } catch (error) {
    return {
      sidecar_binding_input: { sync: failedSidecarContext(sync, error) },
      sidecar_binding_facts: inspectSidecar(null, null),
    };
  }
}
