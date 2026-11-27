import type { EraMessageSourceBasisV1 } from "@era/vibeflow-contracts";
import type { SidecarRecordV1 } from "./sidecar_binding.ts";
import type { SyncWorkV1 } from "./sync/sync_contracts.ts";

export interface WorkingState {
  readonly version: number;
  readonly record: SidecarRecordV1;
  readonly work: SyncWorkV1 | null;
  readonly sourceBasis: EraMessageSourceBasisV1 | null;
  readonly dirty: boolean;
  readonly appliedMessageWrites?: readonly AppliedMessageWrite[];
  readonly nativeCandidate?: NativeCandidateWork | null;
  readonly stage?: {
    readonly messageId: number;
    readonly mk: string;
    readonly swipeId: number;
    readonly candidateRecovery?: {
      readonly working: WorkingState;
      readonly session: unknown;
    };
  } | null;
}

type SourceMessage = EraMessageSourceBasisV1["messages"][number];
type MessageContext = Pick<EraMessageSourceBasisV1, "messages">;
type ProjectedMessages<T extends MessageContext> = Omit<T, "messages"> & MessageContext;
type NativeBaseline = Pick<WorkingState, "record" | "work" | "sourceBasis" | "dirty" | "stage">;
type NativeMessageWrite = { readonly source: SourceMessage; readonly content: string };
type NativeUpdate = {
  readonly messageId: number;
  readonly content: string | { readonly kind: "text"; readonly text: string } | { readonly kind: "json" };
};

interface AppliedMessageWrite {
  readonly source: SourceMessage;
  readonly previousTexts: readonly string[];
  readonly content: string;
}

export function matchesAppliedMessage(source: SourceMessage, observed?: SourceMessage): boolean {
  return observed != null && source.messageId === observed.messageId &&
    source.role === observed.role && (source.swipeIndex ?? 0) === (observed.swipeIndex ?? 0) &&
    (observed.candidate.phase === "idle" || observed.candidate.phase === "completed") &&
    (source.candidate.generation == null || observed.candidate.generation == null ||
      source.candidate.generation === observed.candidate.generation);
}

/** 聊天文件可能仍保有同一楼层连续提交中的任何一个旧版本。 */
export function retainAppliedMessageWrite(
  working: WorkingState,
  source: SourceMessage,
  content: string,
): readonly AppliedMessageWrite[] {
  const writes = working.appliedMessageWrites ?? [];
  const previous = writes.find(write => matchesAppliedMessage(write.source, source));
  const continuous = previous &&
    (previous.content === source.activeText || previous.previousTexts.includes(source.activeText));
  const previousTexts = [...new Set([...(continuous ? previous.previousTexts : []), source.activeText])];
  return [
    ...writes.filter(write => write.source.messageId !== source.messageId),
    { source, previousTexts, content },
  ];
}

export interface NativeCandidateWork {
  readonly baseline: NativeBaseline;
  readonly messages: readonly NativeMessageWrite[];
}

/** 未保存正文只属于原聊天、候选和生成周期，取消后的相同数字索引也不能复用。 */
export function sameNativeCandidate(source: SourceMessage, actual?: SourceMessage): actual is SourceMessage {
  return !!source && !!actual && source.messageId === actual.messageId && source.role === actual.role &&
    (source.swipeIndex ?? 0) === (actual.swipeIndex ?? 0) &&
    (source.candidate?.generation === actual.candidate?.generation ||
      source.candidate?.generation != null && actual.candidate?.phase === 'preparing' &&
        actual.candidate.predecessor === source.candidate.generation) && actual.candidate?.phase !== 'cancelled';
}

/** 保存原生生成期间的正文和变量基线，仍属于原有WorkingState。 */
export function retainNativeWork(previous: WorkingState, sourceBasis: MessageContext | null, updates: readonly NativeUpdate[]): NativeCandidateWork | null {
  const retained = new Map((previous?.nativeCandidate?.messages ?? []).map(item => [item.source.messageId, item]));
  for (const update of updates) {
    const source = sourceBasis?.messages.find(message => message.messageId === update.messageId);
    const content = typeof update.content === "string" ? update.content : update.content?.kind === "text" ? update.content.text : null;
    if (!source || typeof content !== 'string') continue;
    if (retained.has(source.messageId) || !source.candidate.exists || source.candidate.phase === 'generating') {
      retained.set(source.messageId, { source, content });
    }
  }
  if (!retained.size) return null;
  return {
    baseline: previous.nativeCandidate?.baseline ?? {
      record: previous.record, work: previous.work, sourceBasis: previous.sourceBasis,
      dirty: previous.dirty, stage: previous.stage ?? null,
    },
    messages: [...retained.values()],
  };
}

/** 失效候选恢复已有基线；后续历史同步按真实选择处理，不删除或切换宿主候选。 */
export function nativeCandidateRecovery(
  working: WorkingState | null | undefined,
  actual: MessageContext | null | undefined,
): (NativeBaseline & { readonly nativeCandidate: NativeCandidateWork | null }) | null {
  const pending = working?.nativeCandidate;
  if (!pending) return null;
  const messages = actual?.messages ?? [];
  const valid = pending.messages.filter(item => {
    const now = messages.find(message => message.messageId === item.source.messageId);
    return sameNativeCandidate(item.source, now) && now.activeText.startsWith(item.source.activeText);
  });
  return valid.length !== pending.messages.length ? { ...pending.baseline,
    dirty: pending.baseline.dirty || valid.length > 0 && working?.dirty === true,
    nativeCandidate: valid.length ? {...pending,messages:valid} : null,
  } : null;
}

/** Overlay pending text only while its original target still matches the chat. */
export function overlayWorkingMessages<T extends MessageContext>(
  raw: T,
  working: WorkingState | null | undefined,
  actual: MessageContext = raw,
  preparedUpdates: readonly { readonly messageId: number; readonly content: string }[] = [],
): ProjectedMessages<T> {
  if (!working || !Array.isArray(raw?.messages)) return raw;
  const recovered = nativeCandidateRecovery(working, actual);
  return projectWorkingMessages(raw, recovered ? { ...working, ...recovered } : working, actual, preparedUpdates);
}

/** 只投影正文。派发同时需要恢复后的记录，因此在读取工作状态时统一决定恢复结果。 */
export function projectWorkingMessages<T extends MessageContext>(
  raw: T,
  working: WorkingState | null | undefined,
  actual: MessageContext = raw,
  preparedUpdates: readonly { readonly messageId: number; readonly content: string }[] = [],
): ProjectedMessages<T> {
  if (!working || !Array.isArray(raw?.messages)) return raw;
  const prepared = new Map(preparedUpdates.map(update => [update.messageId, update.content] as const));
  const retained = new Map((working.nativeCandidate?.messages ?? []).map(item => [item.source.messageId, item]));
  const applied = new Map((working.appliedMessageWrites ?? []).map(write => [write.source.messageId, write]));
  if (!working.dirty && !retained.size) return raw;
  const writes = new Map(
    (working.work?.plan?.messageUpdates ?? []).map((update) => [
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
  const actualMessages = new Map(
    (actual?.messages ?? []).map(message => [
      message.messageId,
      message,
    ]),
  );
  const projected: SourceMessage[] = raw.messages.map((message: SourceMessage) => {
    const observed = actualMessages.get(message.messageId);
    const original = basis.get(message.messageId);
    const update = writes.get(message.messageId);
    const candidate = retained.get(message.messageId);
    // 本次派发明确准备的正文优先，即使重新结算的结果恰好与宿主原文相同。
    // 不能根据文字差异猜测谁拥有最新结果，再用旧 WorkingState 覆盖它。
    const preparedText = prepared.get(message.messageId);
    if (preparedText !== undefined) return { ...message, activeText: preparedText };
    if (candidate && sameNativeCandidate(candidate.source, observed) && observed.activeText.startsWith(candidate.source.activeText)) {
      // 记录插入在原生本次新增正文之前，保留先提交、后生成的指令顺序。
      return { ...message, activeText: candidate.content + observed.activeText.slice(candidate.source.activeText.length) };
    }
    const pending = applied.get(message.messageId);
    if (pending && observed && matchesAppliedMessage(pending.source, observed) && pending.previousTexts.includes(observed.activeText)) {
      return { ...message, activeText: pending.content };
    }
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
      : working.work?.plan?.messages.find(
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
      schemaVersion: 2,
      messageId: draft.messageId,
      role: draft.role,
      swipeIndex: working.stage!.swipeId,
      activeText: draft.content.text,
      candidate: {exists: false, generation: null, predecessor: null, phase: 'idle'},
    });
  }
  return { ...raw, messages: projected };
}

/** A subsequent task can recover a candidate interrupted by navigation. */
export function interruptedCandidateRecovery(
  working: WorkingState | null | undefined,
  actual: MessageContext | null | undefined,
): { readonly working: WorkingState; readonly session: unknown } | null {
  const recovery = working?.stage?.candidateRecovery;
  if (!recovery?.working) return null;
  const baseline = recovery.working;
  const observed = new Map((actual?.messages ?? []).map(message => [message.messageId, message]));
  const unchanged = ((baseline.sourceBasis ?? working?.sourceBasis)?.messages ?? []).every(message => {
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
