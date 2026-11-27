import {emit, takeFrame, warn} from "../base_lib/frames.ts";

export function SnapshotReceipts(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  const sequence = f.input.sequence;
  f.barrier = {
    sequence, previousFailures: [...s.failureLedger.values()].filter((item: any) => item.sequence <= sequence),
    records: [...s.receipts.values()].filter((record: any) => record.event.sequence <= sequence).sort((a: any,b: any) => a.event.sequence-b.event.sequence),
    startedAt: s.clock.now(),
  };
  return emit({frame: f}, params);
}
export async function AwaitReceipts(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  const b = f.barrier;
  let pending;
  try {pending = await Promise.all(b.records.map(async (record: any) => ({eventId: record.event.eventId, sequence: record.event.sequence, outcome: await record.done})));}
  catch(error){if(!f.generationBarrier)throw error;f.barrierError=error;return emit({frame:f},params);}
  const outcomes = [...b.previousFailures, ...pending].sort((a: any,b: any) => a.sequence-b.sequence);
  f.result = Object.freeze({throughSequence: b.sequence, outcomes: Object.freeze(outcomes), hasFailures: outcomes.some(item => ["failed", "cancelled"].includes(item.outcome.status))});
  return emit({frame: f}, params);
}
export async function ReportBarrier(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  if(f.generationBarrier){
    try{if(f.barrierError)throw f.barrierError;if(f.result.hasFailures)f.session.onBarrierFailure?.(f.result);}
    catch(error){f.barrierFailed=true;f.session.log.error("生成栅栏回执异常，按原有fail-open策略结束。",error);}
  }
  return emit({frame: f}, params);
}
export async function AwaitHandoff(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  if (f.generationBarrier&&!f.barrierFailed) await Promise.all([...f.session.handoffs.values()].map((r: any) => r.promise));
  return emit({frame: f}, params);
}
export function CleanupWatchdog(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  if (f.watchdog !== undefined && s.watchdogs.delete(f.watchdog)) f.watchdog.controller.abort("barrier-completed");
  // 普通只读等待不消费生成屏障尚未报告的失败。
  if (f.generationBarrier) for (const sequence of s.failureLedger.keys()) if (sequence <= f.barrier.sequence) s.failureLedger.delete(sequence);
  // 在已有异步屏障完整收尾后交还原生生成，不在同步事件节点安排后续回调。
  const requestId = f.input.nativeCandidateRequestId;
  if (f.generationBarrier && requestId != null && s.nativeCandidate?.requestId === requestId && s.nativeCandidate.phase === "preparing")
    s.nativeCandidate = {...s.nativeCandidate, phase: "generating"};
  return emit({frame: f}, params);
}

