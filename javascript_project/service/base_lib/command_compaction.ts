/**
 * Service-side adapter for the verified pure command compactor.
 *
 * This module deliberately owns only orchestration: it hands a sealed layer to
 * the external compaction root, replays the returned text through the Service
 * CRUD engine, then updates the existing sync plan.  Parsing, symbolic proof
 * and command rewriting remain in @era/vibeflow-command-compaction.
 */

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
import { cloneSyncJson, type SyncWorkV1 } from "./sync_transaction.ts";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  }
  if (!record(left) || !record(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]));
}

function replaceMessageUpdate(
  updates: EraSyncMessageUpdateV1[],
  update: EraSyncMessageUpdateV1,
): void {
  const index = updates.findIndex((candidate) => candidate.messageId === update.messageId);
  if (index === -1) updates.push(update);
  else updates[index] = update;
}

function recordMarker(
  markers: Record<string, unknown>,
  candidate: EraSealedCompactionCandidateV1,
  content: string,
  status: "compacted" | "partial" | "unchanged",
): void {
  markers[candidate.mk] = {
    version: 1,
    mk: candidate.mk,
    contentHash: commandCompactionContentHash(content),
    lineageHash: commandCompactionLineageHash(
      Array.isArray(candidate.eraMeta.SelectedMks)
        ? candidate.eraMeta.SelectedMks.map((value) => typeof value === "string" ? value : null)
        : [],
    ),
    status,
  };
}

/**
 * Apply proved sealed-layer rewrites without changing the already-computed final
 * sync state. A failed proof/replay remains an optimisation miss, never a sync
 * failure.
 */
export function applySealedCommandCompaction(
  plan: EraSyncPlanV1,
): EraSyncPlanV1 {
  if (plan.status === "failed" || plan.sealedCompactionCandidates.length === 0) return plan;

  const messages = cloneSyncJson(plan.messages) as typeof plan.messages extends readonly (infer T)[] ? T[] : never;
  const messageUpdates = cloneSyncJson(plan.messageUpdates) as EraSyncMessageUpdateV1[];
  const meta = cloneSyncJson(plan.meta) as Record<string, unknown>;
  const markers = commandCompactionMarkersOf(meta);
  const editLogs = record(meta.EditLogs) ? cloneSyncJson(meta.EditLogs) as Record<string, unknown> : {};
  const functionEditLogs = record(meta.FunctionEditLogs) ? cloneSyncJson(meta.FunctionEditLogs) as Record<string, unknown> : {};

  for (const candidate of plan.sealedCompactionCandidates) {
    const message = messages[candidate.messageIndex];
    if (
      message === undefined ||
      message.messageId !== candidate.messageId ||
      message.content.kind !== "text"
    ) continue;
    const original = message.content.text;
    const compacted = compactCommandLayer({
      content: original,
      initialStatData: candidate.layerStartStat as Record<string, unknown>,
      initialStatFunc: candidate.layerStartStatFunc,
      eraMeta: candidate.eraMeta,
    });
    if (compacted.status === "unchanged") {
      recordMarker(markers, candidate, original, "unchanged");
      continue;
    }
    if (
      (compacted.status !== "compacted" && compacted.status !== "partial") ||
      compacted.diagnostics.length !== 0 ||
      compacted.content === original
    ) continue;

    const replay = applyMessageCommands({
      content: compacted.content,
      messageId: candidate.messageId,
      initialStat: candidate.layerStartStat,
      initialStatFunc: candidate.layerStartStatFunc,
      meta: candidate.eraMeta,
      traditionalToSimplified: candidate.traditionalToSimplified,
    });
    if (
      replay.diagnostics.length !== 0 ||
      !equal(replay.finalStat, candidate.layerEndStat) ||
      !equal(replay.finalStatFunc ?? {}, candidate.layerEndStatFunc)
    ) continue;

    messages[candidate.messageIndex] = {
      ...message,
      content: { kind: "text", text: compacted.content },
    } as (typeof messages)[number];
    replaceMessageUpdate(messageUpdates, {
      kind: "update-message-content",
      messageId: candidate.messageId,
      messageIndex: candidate.messageIndex,
      mk: candidate.mk,
      content: { kind: "text", text: compacted.content },
    });
    editLogs[candidate.mk] = cloneSyncJson(replay.editLog);
    functionEditLogs[candidate.mk] = cloneSyncJson(replay.functionEditLog ?? []);
    recordMarker(markers, candidate, compacted.content, compacted.status);
  }

  meta.EditLogs = editLogs;
  meta.FunctionEditLogs = functionEditLogs;
  const finalMeta = withCommandCompactionMarkers(meta, markers);
  return {
    ...plan,
    messages: cloneSyncJson(messages),
    messageUpdates: cloneSyncJson(messageUpdates),
    meta: finalMeta,
    sealedCompactionCandidates: [],
  } as EraSyncPlanV1;
}

export function applySealedCommandCompactionToWork(work: SyncWorkV1): SyncWorkV1 {
  if (work.disposition !== "commit" || work.plan === null) return work;
  return { ...work, plan: applySealedCommandCompaction(work.plan) };
}
