import { planDispatchPreparation, type DispatchCanonicalContextV1 } from "../../base_lib/dispatch_preparation.ts";
interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.dispatch.canonical_context": Envelope<unknown> }>): any {
  const plan = planDispatchPreparation(inputs["era.dispatch.canonical_context"].value as DispatchCanonicalContextV1);
  // 状态任务把消息更新暂存在 V3 派发上下文中，由同步事务一次性提交。
  // 只有纯 update-mk 任务仍沿用独立的预提交写入链。
  const shouldPrecommit = plan.seed.dispatchClass === "update-mk"
    && plan.status === "ready"
    && (plan.messageWriteRequired || plan.variableWriteRequired);
  return {
    dispatch_preparation_plan: plan,
    precommit_route: shouldPrecommit ? "commit" : "no-op",
  };
}
