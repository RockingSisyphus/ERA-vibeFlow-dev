import {
  canonicalDispatchContext,
  type DispatchCanonicalContextV1,
  type DispatchSeedV1,
} from "../../base_lib/dispatch_preparation.ts";
import { inspectSidecar, variablesForState } from "../../base_lib/sidecar_binding.ts";
import { projectWorkingMessages, nativeCandidateRecovery } from "../../base_lib/working_state.ts";

interface Envelope<T> { readonly value: T; }
interface MessageReadRequest {
  readonly projection: "era-active-message-v2";
  readonly range: string | number;
  readonly purpose?: string;
}
type Context = any;
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function failed(seed: DispatchSeedV1, error: unknown): DispatchCanonicalContextV1 {
  return {
    schemaVersion: 1,
    seed,
    status: "failed",
    messages: [],
    identity: {},
    meta: {},
    placeholder: { enabled: true, value: "<StatusPlaceHolderImpl/>" },
    failure: {
      code: /abort|cancel|取消/i.test(errorMessage(error)) ? "ERA_DISPATCH_READ_CANCELLED" : "ERA_DISPATCH_READ_FAILED",
      message: errorMessage(error),
      category: /abort|cancel|取消/i.test(errorMessage(error)) ? "cancelled" : "tavern",
      retryable: false,
    },
  };
}

export function* runProgress(
  inputs: Readonly<{ "era.dispatch.seed": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Generator<any,any,any> {
  const seed = inputs["era.dispatch.seed"].value as DispatchSeedV1;
  try {
    const group=yield {kind:"parallel",input:{kind:"dispatch",latest:seed.requirement==="latest-message"}};
    const {messages,current,variables:scriptVariables,identity:resolvedIdentity}=group;
    let working=current?.working;
    const recovery=nativeCandidateRecovery(working,messages);
    if(recovery)working={...working,...recovery};
    const overlay=projectWorkingMessages(messages,working);
    const projected={...overlay,messages:overlay.messages.filter((message:any)=>message.candidate.exists||message.candidate.phase!=="cancelled")};
    if (seed.requirement === "latest-message") {
      const canonical=canonicalDispatchContext(seed,projected,{variables:{}},{variables:{}},resolvedIdentity);
      return {canonical_dispatch_context:{...canonical,sourceMessages:messages.messages}};
    }
    const meta = current !== null && typeof current === "object" ? (current as Record<string, unknown>).meta : null;
    const id = meta !== null && typeof meta === "object" ? (meta as Record<string, unknown>).SidecarId : null;
    const stored = typeof id === "string" ? working?.record?.sidecarId===id
      ? {status:"found",sidecarId:id,record:working.record}
      : (yield {kind:"resource",capability:"era.tavern.sidecar",operation:"read_record",input:{sidecarId:id}}) : null;
    const facts = inspectSidecar(current, stored);
    const chatVariables = facts.record === null
      ? { variables: {} }
      : { variables: variablesForState(facts.record.state, facts.record.sidecarId) };
    return {
      canonical_dispatch_context: {...canonicalDispatchContext(
        seed,
        projected,
        chatVariables,
        scriptVariables,
        resolvedIdentity,
      ),sourceMessages:messages.messages},
    };
  } catch (error) {
    return { canonical_dispatch_context: failed(seed, error) };
  }
}
