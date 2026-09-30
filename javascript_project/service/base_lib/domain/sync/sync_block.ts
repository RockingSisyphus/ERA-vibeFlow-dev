/** 只读历史的旧单块接口。位置判断与操作都复用正式图的纯步骤，不调用作者函数或宿主。 */
import type { EraSyncPlanV1 } from "./sync_types.ts";
import type { EraFunctionCallSite } from "../commands/message_function_calls.ts";
import { foldOperations } from "../commands/operation_fold.ts";
import * as source from "../../sync/position_source.ts";
import { routeBlockLifecycle } from "../../sync/position_source.ts";
export interface EraSyncBlockResultV1 {
  readonly pendingCall?: EraFunctionCallSite;
  readonly plan: EraSyncPlanV1;
  readonly done: boolean;
  readonly failure: { readonly code: string; readonly message: string } | null;
  readonly messageIndex: number | null;
}
export function advanceEraSyncBlock(
  plan: EraSyncPlanV1,
  formal = true,
  suspendCalls = false,
  pauseBeforeBlock = false,
): EraSyncBlockResultV1 {
  const state: any = {
    work: { plan, step: {}, disposition: "commit" },
    done: false,
    sourceBasis: null,
  };
  const routed = routeBlockLifecycle(state);
  if (routed.route === "terminal")
    return {
      plan:
        plan.status !== "failed" && plan.execution
          ? { ...plan, execution: null }
          : plan,
      done: true,
      failure: null,
      messageIndex: null,
    };
  const origin = source.prepareFloorOrigin(routed.state);
  let position = origin.state;
  position.position.formal = formal;
  if (origin.route === "invalid")
    position = source.advanceInvalidFloor(position);
  else if (!pauseBeforeBlock) {
    const classified = source.classifySourceBlock(position);
    position = classified.state;
    if (classified.route === "command") {
      const seeded = source.seedCommandOperations(position);
      position = source.markCompletedCommand(
        source.acceptOperationResult(
          seeded.state,
          foldOperations(seeded.operations),
        ).state,
      );
    } else if (classified.route === "author-call") {
      const p = position.position;
      if (suspendCalls) {
        p.selected[p.index] = p.ensured.mk;
        const prepared: any = position.state.work.plan;
        return {
          plan: {
            ...prepared,
            meta: { ...prepared.meta, SelectedMks: p.selected },
          },
          done: false,
          failure: null,
          messageIndex: p.index,
          pendingCall: p.block.call,
        };
      }
      return {
        plan,
        done: true,
        messageIndex: p.index,
        failure: {
          code: "ERA_FCALL_NOT_IMPLEMENTED",
          message: `消息 #${p.ensured.message.messageId} 位置 ${p.block.start} 的 EraFCall ${p.block.call.name ?? "?"} 尚未实现。${p.block.call.diagnostics.map((d: any) => d.message).join(" ")}`,
        },
      };
    } else if (classified.route === "skip")
      position = source.markSkippedCall(position);
    else
      position = source.prepareSealedCandidate(source.finalizeFloor(position));
    position = source.advanceSourcePosition(position);
  }
  return {
    plan: position.state.work.plan!,
    done: position.state.done,
    failure: null,
    messageIndex: position.position.index,
  };
}

import { prepareEraSync } from "./sync_prepare.ts";
import { readMkMessageText } from "../mk_engine.ts";
import type {
  EraSyncInputV1,
  EraSyncMessageUpdateV1,
  EraSealedCompactionCandidateV1,
} from "./sync_types.ts";
/** 只读入口仅折叠同一块应用器，不写消息、不调用作者函数。 */
export function planEraSync(input: EraSyncInputV1): EraSyncPlanV1 {
  let plan = prepareEraSync(input);
  const updates: EraSyncMessageUpdateV1[] = [];
  const candidates: EraSealedCompactionCandidateV1[] = [];
  while (plan.status !== "failed" && plan.execution) {
    const step = advanceEraSyncBlock(plan, false);
    plan = step.plan;
    updates.push(...plan.messageUpdates);
    candidates.push(...plan.sealedCompactionCandidates);
  }
  if (plan.status === "failed") return plan;
  const byId = new Map(updates.map((u) => [u.messageId, u]));
  return {
    ...plan,
    messageUpdates: [...byId.values()].filter((update) => {
      const original = input.messages[update.messageIndex];
      return (
        original === undefined ||
        readMkMessageText(original) !==
          (update.content.kind === "text" ? update.content.text : "")
      );
    }),
    sealedCompactionCandidates: candidates,
  };
}
