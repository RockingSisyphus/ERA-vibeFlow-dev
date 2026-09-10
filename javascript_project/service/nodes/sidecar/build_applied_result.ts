import { assertSyncStep } from "../../base_lib/sync_contracts.ts";

interface Envelope<T> { readonly value: T; }

/**
 * Sidecar repair 已经完成独立的 files 事务，不得再借普通同步“顺带”结算，
 * 否则会把仅存在于当前变量状态的 API 变更重新按聊天文本计算而覆盖掉。
 */
export function run(inputs: Readonly<{ "era.sync.context": Envelope<unknown> }>): any {
  const context = inputs["era.sync.context"].value as { readonly step: unknown };
  const step = assertSyncStep(context.step);
  return {
    sidecar_binding_applied_result: {
      status: "no-op",
      settlements: step.sources.map((source) => ({
        status: "completed",
        eventId: source.event.eventId,
        sequence: source.event.sequence,
        taskId: step.task.id,
        relation: source.relation,
      })),
      notifications: [],
      diagnostics: [],
    },
  };
}
