import {DEFAULT_ERA_SERVICE_CONFIG_V1} from "../base_lib/contracts.ts";
import {emit, takeFrame, EraServiceHostError, route} from "../base_lib/frames.ts";
import {clock, listenAbort, deferred, suspendCall} from "../base_lib/resources.ts";
import {browserApi} from "../base_lib/browser.ts";

function positive(value: any, fallback: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
export function ReadLimits(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const c = f.config ?? {};
  const d = DEFAULT_ERA_SERVICE_CONFIG_V1;
  f.limits = {
    maxEventBytes: positive(c.limits?.max_event_bytes, d.max_event_bytes),
    maxHostRefs: positive(c.limits?.max_host_refs_per_event, d.max_host_refs_per_event),
    maxFifoEvents: positive(c.limits?.max_fifo_events, d.max_fifo_events),
    maxFifoBytes: positive(c.limits?.max_fifo_bytes, d.max_fifo_bytes),
    watchdogMs: Number.isSafeInteger(c.barrier_watchdog_ms) && c.barrier_watchdog_ms >= 0
      ? c.barrier_watchdog_ms : d.barrier_watchdog_ms,
  };
  return emit({frame: f}, params);
}
export function AllocateSession(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.session?.stopping) throw new EraServiceHostError("ERA_HOST_STOPPED", "已经停止的实例不能重新启动。");
  if (f.session?.started) return emit({frame: f}, params);
  if (f.options?.signal?.aborted) throw f.options.signal.reason;
  f.session = {
    ...f.limits, api: f.api ?? browserApi(), log: f.log ?? console, clock: f.clock ?? clock(),
    ownerReady: deferred(), onDispose: f.onDispose, warn: f.warn,
    eventDefinitions: f.eventDefinitions ?? [], onRuntimeFailure:f.onRuntimeFailure,
    registerTechnicalProjection:f.registerTechnicalProjection,
    onActivated:f.onActivated,presentationClient:f.presentationClient,
    onStartupDecision:f.onStartupDecision,storeWorkingState:f.storeWorkingState,observeSettlement:f.observeSettlement,
    extensionId: f.extensionId ?? "era.tavern", dispatch: f.dispatch,
    inboundPort: f.config?.ports?.inbound ?? "era.service.in",
    outboundPort: f.config?.ports?.outbound ?? "era.service.out",
    stagedStartup: f.config?.staged_startup === true,
    lifecycle: new AbortController(), operational: new AbortController(),
    started: true, stopping: false, fatalTransitioning: false, fatalLatched: false,
    nextSequence: 1, acceptedCount: 0, settledCount: 0,
    queue: [], queueBytes: 0, refs: new Map(), refsBySequence: new Map(),
    receipts: new Map(), failureLedger: new Map(), processedFrames: new Map(),
    timers: new Map(), delayedAdmissions: new Map(), watchdogs: new Set(),
    activeNotifications: new Set(), tasks: [], pendingReceive: null, unsubscribe: null,
    lifecycleToken: 1, handoffs: new Map(), sessions: new Map(), functionCalls: new Map(),
    onScriptVariablesCommitted: f.onScriptVariablesCommitted,
    projectTechnicalBlocks: f.projectTechnicalBlocks, publishSnapshot: f.publishSnapshot,
    refreshSingleFloor: f.refreshSingleFloor, refreshExternalStatusbar: f.refreshExternalStatusbar,
    observeAgentRequest: f.observeAgentRequest, agentRecordView: f.agentRecordView, createFunctionFacade: f.createFunctionFacade, functionContexts: new WeakMap(),
    observeAgentSession: f.observeAgentSession,
    workingByChat: new Map(), activeSnapshot: null, internalMessageWrites: new Map(),
    onBarrierFailure: f.onBarrierFailure, verifyStatusbarSource: f.verifyStatusbarSource,
  };
  return emit({frame: f}, params);
}
export function OpenStartup(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  const s = f.session;
  s.startup ??= deferred();
  f.activationAutomatic = !s.stagedStartup;
  return emit(route(f, s.stagedStartup ? "staged" : "automatic"), params);
}
export async function WaitStartup(inputs: any, params: any): Promise<any> {
  const f = takeFrame(inputs);
  f.result = await suspendCall(f, () => f.session.startup.promise);
  return emit({frame:f}, params);
}
export function ReturnSession(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.result = f.session;
  return emit({frame: f}, params);
}
