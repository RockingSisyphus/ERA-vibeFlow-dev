import {warn, EraServiceHostError} from "./frames.ts";
/** 单个回执的原子结算，遍历顺序由原生 Loop 控制。 */
export function settleReceipt(s: any, outcome: any): void {
  const record = s.receipts.get(outcome.sequence);
  if (!record || record.settled) throw new EraServiceHostError("ERA_HOST_SETTLEMENT_CONFLICT", `事件序号 ${outcome.sequence} 已结算或不存在。`);
  record.settled = true;
  s.receipts.delete(outcome.sequence);
  for (const token of s.refsBySequence.get(outcome.sequence) ?? []) s.refs.delete(token);
  s.refsBySequence.delete(outcome.sequence);
  s.settledCount++;
  if (["failed", "cancelled"].includes(outcome.status)) s.failureLedger.set(outcome.sequence, {eventId: record.event.eventId, sequence: outcome.sequence, outcome});
  record.resolve(outcome);
  try { record.external?.settle(outcome); }
  catch (error: any) { warn(s, "宿主回执回调发生异常；内部回执已经完成。", {sequence: outcome.sequence, error: error.message}); }
}
