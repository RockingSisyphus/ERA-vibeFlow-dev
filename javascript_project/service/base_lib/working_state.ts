import type { SidecarRecordV1 } from "./sidecar_binding.ts";
import type { SyncWorkV1 } from "./sync/sync_contracts.ts";

export interface WorkingState {
  readonly version: number;
  readonly record: SidecarRecordV1;
  readonly work: SyncWorkV1 | null;
  readonly sourceBasis: {
    readonly identity: unknown;
    readonly messages: readonly any[];
  } | null;
  readonly dirty: boolean;
  readonly stage?: {
    readonly messageId: number;
    readonly mk: string;
    readonly swipeId: number;
  } | null;
}

/** Overlay pending text only while its original target still matches the chat. */
export function overlayWorkingMessages(
  raw: any,
  working: WorkingState | null,
  actual: any = raw,
): any {
  if (!working?.dirty || !working.work?.plan || !Array.isArray(raw?.messages))
    return raw;
  const writes = new Map(
    working.work.plan.messageUpdates.map((update) => [
      update.messageId,
      update,
    ]),
  );
  const basis = new Map(
    working.sourceBasis?.messages.map((message) => [
      message.messageId,
      message,
    ]) ?? [],
  );
  const actualMessages = new Map<number, any>(
    (actual?.messages ?? []).map((message: any) => [
      message.messageId,
      message,
    ]),
  );
  const projected = raw.messages.map((message: any) => {
    const observed = actualMessages.get(message.messageId);
    const original = basis.get(message.messageId);
    const update = writes.get(message.messageId);
    if (
      !original ||
      !observed ||
      !update ||
      update.content.kind !== "text" ||
      original.activeText !== observed.activeText ||
      (original.swipeIndex ?? 0) !== (observed.swipeIndex ?? 0) ||
      original.role !== observed.role
    )
      return message;
    return { ...message, activeText: update.content.text };
  });
  const draftId = working.stage?.messageId;
  const draft =
    draftId === undefined
      ? null
      : working.work.plan.messages.find(
          (message) => message.messageId === draftId,
        );
  if (
    draft &&
    draft.content.kind === "text" &&
    !actualMessages.has(draft.messageId) &&
    !basis.has(draft.messageId) &&
    [...basis].every(([id, before]) => {
      const now = actualMessages.get(id);
      return (
        now &&
        now.activeText === before.activeText &&
        (now.swipeIndex ?? 0) === (before.swipeIndex ?? 0)
      );
    })
  ) {
    projected.push({
      schemaVersion: 1,
      messageId: draft.messageId,
      role: draft.role,
      swipeIndex: working.stage!.swipeId,
      activeText: draft.content.text,
    });
  }
  return { ...raw, messages: projected };
}

/** A subsequent task can recover a candidate interrupted by navigation. */
export function interruptedCandidateRecovery(working: any, actual: any): any | null {
  const recovery = working?.stage?.candidateRecovery;
  if (!recovery?.working) return null;
  const baseline = recovery.working;
  const observed = new Map<number, any>((actual?.messages ?? []).map((message: any) => [message.messageId, message]));
  const unchanged = ((baseline.sourceBasis ?? working.sourceBasis)?.messages ?? []).every((message: any) => {
    const now = observed.get(message.messageId);
    return now && now.activeText === message.activeText && now.role === message.role &&
      (now.swipeIndex ?? 0) === (message.swipeIndex ?? 0);
  });
  return {
    working: { ...baseline,
      // Preserve the baseline state/logs for replay, but never write stale text.
      ...(!unchanged ? { work: null, sourceBasis: null, stage: null } : {}),
    },
    session: unchanged ? recovery.session ?? null : null,
  };
}
