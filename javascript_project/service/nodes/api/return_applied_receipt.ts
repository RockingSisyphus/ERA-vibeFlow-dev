import {
  buildCommittedResult,
  buildFailureResult,
} from "../../base_lib/facade_api_engine.ts";
import type { EraBlockStepStateV1 } from "../../base_lib/sync/sync_contracts.ts";
import { diagnosticsForPlan } from "../../base_lib/sync/sync_result_policy.ts";

/** Completion acknowledges application; saving and its notification happen separately. */
export function run(inputs: any, _params: any, context: any): any {
  const state = inputs["era.sync.block.step.state.next"]
    .value as EraBlockStepStateV1;
  if (!state.apiContext) throw new TypeError("API 应用缺少请求上下文。");
  if (state.work.disposition === "failed") {
    return {
      facade_commit_result: buildFailureResult({
        context: state.apiContext,
        error: state.work.failure,
      }),
    };
  }
  const working = context.capabilities["era.tavern.sidecar"].read_working(
    {},
  ).working;
  if (state.work.disposition === "commit" && !working?.stage) {
    context.capabilities["era.lifecycle.admission"].schedule({
      key: "era-working-save",
      delayMs: 200,
      maxDelayMs: 2000,
      event: {
        type: "era.facade.sync",
        source: "era-api",
        args: [{ mode: "auto" }],
      },
    });
  }
  return {
    facade_commit_result: buildCommittedResult(
      {
        status: state.work.disposition === "commit" ? "committed" : "no-op",
        settlements: [],
        notifications: [],
        diagnostics: diagnosticsForPlan(state.work.plan, state.work.step),
      },
      {
        ...(state.apiContext as object),
        ...(state.scopeWindow ? { window: state.scopeWindow } : {}),
      },
    ),
  };
}
