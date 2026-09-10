/** Service orchestration for the verified pure command compactor. */
import { compactCommandLayer } from "@era/vibeflow-command-compaction/engine";
import { applyMessageCommands } from "./domain/crud_engine.ts";
import {
  commandCompactionContentHash,
  commandCompactionLineageHash,
  commandCompactionMarkersOf,
  withCommandCompactionMarkers,
} from "./domain/command_compaction_marker.ts";
import {
  type EraSealedCompactionCandidateV1,
  type EraSyncMessageUpdateV1,
  type EraSyncPlanV1,
} from "./domain/sync_engine.ts";
import { readMessageKey } from "./domain/mk_engine.ts";
import { cloneSyncJson, type SyncWorkV1 } from "./sync_contracts.ts";

interface CandidateStage {
  readonly candidate: EraSealedCompactionCandidateV1;
  readonly original: string | null;
  readonly compaction: ReturnType<typeof compactCommandLayer> | null;
  readonly replay: ReturnType<typeof applyMessageCommands> | null;
  readonly accepted: boolean;
}
export interface ServiceCompactionContext {
  readonly originalWork: SyncWorkV1;
  readonly plan: EraSyncPlanV1 | null;
  readonly messages: EraSyncPlanV1["messages"];
  readonly messageUpdates: EraSyncMessageUpdateV1[];
  readonly meta: Record<string, unknown>;
  readonly markers: Record<string, unknown>;
  readonly editLogs: Record<string, unknown>;
  readonly functionEditLogs: Record<string, unknown>;
  readonly candidates: readonly CandidateStage[];
}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  if (!record(left) || !record(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]));
}
function replaceMessageUpdate(updates: EraSyncMessageUpdateV1[], update: EraSyncMessageUpdateV1): void {
  const index = updates.findIndex((candidate) => candidate.messageId === update.messageId);
  if (index === -1) updates.push(update); else updates[index] = update;
}
function markerValue(candidate: EraSealedCompactionCandidateV1, content: string, status: "compacted" | "partial" | "unchanged"): Record<string, unknown> {
  return {
    version: 1,
    mk: candidate.mk,
    contentHash: commandCompactionContentHash(content),
    lineageHash: commandCompactionLineageHash(Array.isArray(candidate.eraMeta.SelectedMks) ? candidate.eraMeta.SelectedMks.map((value) => typeof value === "string" ? value : null) : []),
    status,
  };
}
function mapCandidates(context: ServiceCompactionContext, transform: (entry: CandidateStage) => CandidateStage): ServiceCompactionContext {
  return { ...context, candidates: context.candidates.map(transform) };
}

/** Select sealed candidates and prune markers whose message no longer exists. */
export function identifySealedLayers(work: SyncWorkV1): ServiceCompactionContext {
  if (work.disposition !== "commit" || work.plan === null || work.plan.status === "failed") {
    return { originalWork: work, plan: null, messages: [], messageUpdates: [], meta: {}, markers: {}, editLogs: {}, functionEditLogs: {}, candidates: [] };
  }
  const plan = cloneSyncJson(work.plan) as EraSyncPlanV1;
  const messages = cloneSyncJson(plan.messages) as EraSyncPlanV1["messages"];
  const meta = cloneSyncJson(plan.meta) as Record<string, unknown>;
  const markers = commandCompactionMarkersOf(meta);
  const liveMks = new Set(messages.map(readMessageKey).filter((mk): mk is string => typeof mk === "string"));
  for (const mk of Object.keys(markers)) if (!liveMks.has(mk)) delete markers[mk];
  return {
    originalWork: work,
    plan,
    messages,
    messageUpdates: cloneSyncJson(plan.messageUpdates) as EraSyncMessageUpdateV1[],
    meta,
    markers,
    editLogs: record(meta.EditLogs) ? cloneSyncJson(meta.EditLogs) as Record<string, unknown> : {},
    functionEditLogs: record(meta.FunctionEditLogs) ? cloneSyncJson(meta.FunctionEditLogs) as Record<string, unknown> : {},
    candidates: plan.sealedCompactionCandidates.map((candidate) => {
      const message = messages[candidate.messageIndex];
      const original = message !== undefined && message.messageId === candidate.messageId && message.content.kind === "text" ? message.content.text : null;
      return { candidate, original, compaction: null, replay: null, accepted: false };
    }),
  };
}

/** Delegate symbolic rewriting and scope-aware proof to the published pure root. */
export function compactEachSegment(context: ServiceCompactionContext): ServiceCompactionContext {
  return mapCandidates(context, (entry) => entry.original === null ? entry : {
    ...entry,
    compaction: compactCommandLayer({
      content: entry.original,
      initialStatData: entry.candidate.layerStartStat as Record<string, unknown>,
      initialStatFunc: entry.candidate.layerStartStatFunc,
      eraMeta: entry.candidate.eraMeta,
      randomContext: { sourceKey: entry.candidate.mk, drawOffset: 0 },
    }),
  });
}

/** Replay an eligible candidate with the real Service CRUD engine. */
export function replayWithServiceEngine(context: ServiceCompactionContext): ServiceCompactionContext {
  return mapCandidates(context, (entry) => {
    const compacted = entry.compaction;
    if (entry.original === null || compacted === null || (compacted.status !== "compacted" && compacted.status !== "partial") || compacted.diagnostics.length !== 0 || compacted.content === entry.original) return entry;
    const replay = applyMessageCommands({ content: compacted.content, messageId: entry.candidate.messageId, initialStat: entry.candidate.layerStartStat, initialStatFunc: entry.candidate.layerStartStatFunc, randomSourceKey: entry.candidate.mk, meta: entry.candidate.eraMeta, traditionalToSimplified: entry.candidate.traditionalToSimplified });
    const accepted = replay.diagnostics.length === 0 && equal(replay.finalStat, entry.candidate.layerEndStat) && equal(replay.finalStatFunc ?? {}, entry.candidate.layerEndStatFunc) && replay.nextRandomDrawOffset === compacted.nextRandomDrawOffset;
    return { ...entry, replay, accepted };
  });
}

/** Write only accepted single-scope replacements and their real replay logs. */
export function writeSingleScopeSegments(context: ServiceCompactionContext): ServiceCompactionContext {
  if (context.plan === null) return context;
  const messages = [...context.messages];
  const messageUpdates = [...context.messageUpdates];
  const editLogs = { ...context.editLogs };
  const functionEditLogs = { ...context.functionEditLogs };
  for (const entry of context.candidates) {
    if (!entry.accepted || entry.original === null || entry.compaction === null || entry.replay === null) continue;
    const candidate = entry.candidate;
    const message = messages[candidate.messageIndex];
    if (message === undefined || message.messageId !== candidate.messageId || message.content.kind !== "text") continue;
    messages[candidate.messageIndex] = { ...message, content: { kind: "text", text: entry.compaction.content } };
    replaceMessageUpdate(messageUpdates, { kind: "update-message-content", messageId: candidate.messageId, messageIndex: candidate.messageIndex, mk: candidate.mk, content: { kind: "text", text: entry.compaction.content } });
    editLogs[candidate.mk] = cloneSyncJson(entry.replay.editLog);
    functionEditLogs[candidate.mk] = cloneSyncJson(entry.replay.functionEditLog ?? []);
  }
  return { ...context, messages, messageUpdates, editLogs, functionEditLogs };
}

/** Finalize scheduling markers and return the existing Sidecar commit work item. */
export function updateCompactionMarkers(context: ServiceCompactionContext): SyncWorkV1 {
  if (context.plan === null) return context.originalWork;
  const markers = { ...context.markers };
  for (const entry of context.candidates) {
    if (entry.original === null || entry.compaction === null) continue;
    if (entry.compaction.status === "unchanged") markers[entry.candidate.mk] = markerValue(entry.candidate, entry.original, "unchanged");
    else if (entry.accepted && (entry.compaction.status === "compacted" || entry.compaction.status === "partial")) markers[entry.candidate.mk] = markerValue(entry.candidate, entry.compaction.content, entry.compaction.status);
  }
  const meta = { ...context.meta, EditLogs: context.editLogs, FunctionEditLogs: context.functionEditLogs };
  const sourcePlan = context.plan as Exclude<EraSyncPlanV1, { readonly status: "failed" }>;
  const plan: EraSyncPlanV1 = { ...sourcePlan, messages: cloneSyncJson(context.messages), messageUpdates: cloneSyncJson(context.messageUpdates), meta: withCommandCompactionMarkers(meta, markers), sealedCompactionCandidates: [] };
  return { ...context.originalWork, plan } as SyncWorkV1;
}

/** Direct composition kept for focused unit tests and non-workflow callers. */
export function applySealedCommandCompactionToWork(work: SyncWorkV1): SyncWorkV1 {
  return updateCompactionMarkers(writeSingleScopeSegments(replayWithServiceEngine(compactEachSegment(identifySealedLayers(work)))));
}

/** Compatibility for focused pure-plan tests; production workflow uses staged nodes. */
export function applySealedCommandCompaction(plan: EraSyncPlanV1): EraSyncPlanV1 {
  if (plan.status === "failed") return plan;
  const work = {
    schemaVersion: 1,
    step: {} as SyncWorkV1["step"],
    disposition: "commit",
    plan,
    payload: null,
    failure: null,
  } satisfies SyncWorkV1;
  return applySealedCommandCompactionToWork(work).plan ?? plan;
}
