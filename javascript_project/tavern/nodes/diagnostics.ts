import {emit, takeFrame} from "../base_lib/frames.ts";
export function ReadResources(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  f.result = Object.freeze({
    started: s.started, stopping: s.stopping, fatal: s.fatalLatched || s.fatalTransitioning,
    accepted: s.acceptedCount, settled: s.settledCount, queueEvents: s.queue.length, queueBytes: s.queueBytes,
    pendingReceipts: s.receipts.size, timers: s.timers.size + s.delayedAdmissions.size + s.watchdogs.size,
    hostRefs: s.refs.size, notifications: s.activeNotifications.size,
    portWaiters: s.pendingReceive ? 1 : 0, processedFrames: s.processedFrames.size, nextSequence: s.nextSequence,
  });
  return emit({frame: f}, params);
}
