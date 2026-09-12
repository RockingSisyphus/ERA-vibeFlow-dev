import {
  type SyncCommitRequestV1,
  type SyncWorkV1,
  successfulPlan,
  type SyncMessageWriteV1,
  dispatchContext,
  cloneSyncJson,
  type SyncCommitEnvelopeV1,
  type SyncCommitContractFailureV1,
  isRecord,
  assertSyncStep,
  SyncContractError,
  syncFailure,
  errorMessage,
  type WriteObservation,
  variablesRecord,
} from "./sync_contracts.ts";
import {
  type EraMessageSourceBasisV1,
  cloneEraPortableJsonV1,
} from "@era/vibeflow-contracts";
import { stripEraDataBlocks, readMessageKey } from "./domain/mk_engine.ts";
import { type EraSyncPlanV1 } from "./domain/sync_engine.ts";
import { type PlannedStepV1 } from "./service_types.ts";
import { buildSyncNonCommitResult } from "./sync_result_policy.ts";

/** 已确认消息写入后的事实，供 Sidecar 写入、发布和首次呈现共同使用。 */
export function basisAfterSyncWrites(
  request: SyncCommitRequestV1,
): EraMessageSourceBasisV1 {
  const writes = new Map(
    request.messageWrites.map((write) => [write.messageId, write.content]),
  );
  return {
    identity: request.sourceBasis.identity,
    messages: request.sourceBasis.messages.map((message) => ({
      ...message,
      activeText: writes.get(message.messageId) ?? message.activeText,
    })),
  };
}

/** 把纯计划收敛为消息先行、变量后置的逻辑提交请求。 */
export function buildSyncCommitRequest(work: SyncWorkV1): SyncCommitRequestV1 {
  const emptyCommit =
    work.plan !== null &&
    work.plan.status !== "failed" &&
    work.plan.messages.length === 0;
  if (
    work.disposition !== "commit" ||
    work.plan === null ||
    (work.payload === null && !emptyCommit)
  ) {
    throw new TypeError("只有 commit 同步工作项可以构造提交请求。");
  }
  const plan = successfulPlan(work.plan);
  const writesByMessageId = new Map<number, SyncMessageWriteV1>();
  for (const update of plan.messageUpdates) {
    if (update.content.kind !== "text") {
      throw new TypeError(
        `消息 #${update.messageId} 的多模态内容不能由当前 Tavern 文本提交边界安全写入。`,
      );
    }
    writesByMessageId.set(update.messageId, {
      messageId: update.messageId,
      content: update.content.text,
    });
  }
  const prepared = dispatchContext(work.step);
  if (prepared.schemaVersion !== 3 || prepared.sourceBasis === undefined) {
    throw new TypeError("同步提交缺少计算前的消息/聊天依据。");
  }
  const floorIdentity =
    prepared.schemaVersion === 3 ? prepared.floorIdentity : null;
  const agentFloorCandidate =
    prepared.schemaVersion === 3 ? prepared.agentFloorCandidate : null;
  if (agentFloorCandidate !== null) {
    const currentContent = plan.messages.find(
      (message) => message.messageId === agentFloorCandidate.messageId,
    )?.content;
    writesByMessageId.set(agentFloorCandidate.messageId, {
      messageId: agentFloorCandidate.messageId,
      content:
        writesByMessageId.get(agentFloorCandidate.messageId)?.content ??
        (currentContent?.kind === "text"
          ? currentContent.text
          : agentFloorCandidate.content),
      extra: cloneSyncJson(agentFloorCandidate.extra),
    });
  }
  const messageWrites = [...writesByMessageId.values()].sort(
    (left, right) => left.messageId - right.messageId,
  );
  const task = work.step.kind === "execute" ? work.step.task : null;
  const received =
    task?.kind === "sync" &&
    task.primaryEvent.type === "message_received" &&
    task.reason !== "facade-commit";
  const original = prepared.sourceBasis.messages.find(
    (message) => message.messageId === floorIdentity?.messageId,
  );
  const finalWrite = messageWrites.find(
    (write) => write.messageId === floorIdentity?.messageId,
  );
  // MK 本身不改变显示；只有本次收到的最终正文/占位符发生变化才补一次呈现。
  const nativeDisplayChanged =
    received &&
    original?.role === "assistant" &&
    finalWrite !== undefined &&
    stripEraDataBlocks(original.activeText).trimEnd() !==
      stripEraDataBlocks(finalWrite.content).trimEnd();
  const initialPresentation =
    agentFloorCandidate?.requiresInitialPresentation === true ||
    nativeDisplayChanged
      ? floorIdentity
      : null;
  return {
    schemaVersion: 2,
    step: work.step,
    plan,
    payload: work.payload,
    messageWrites,
    stat: cloneSyncJson(plan.stat),
    statFunc: cloneSyncJson(plan.statFunc),
    meta: cloneSyncJson(plan.meta),
    floorIdentity,
    agentFloorCandidate,
    initialPresentation,
    ...(work.syncCursor === undefined ? {} : { syncCursor: work.syncCursor }),
    ...(work.blockStepState === undefined
      ? {}
      : { blockStepState: work.blockStepState }),
    sourceBasis: prepared.sourceBasis,
  };
}

export function assertConsecutiveCandidate(plan: EraSyncPlanV1 | null): void {
  const next = plan?.nextConsecutiveState;
  if (next === null || next === undefined) return;
  if (
    !Number.isSafeInteger(next.count) ||
    next.count < 0 ||
    (next.mk !== null && (typeof next.mk !== "string" || next.mk.length === 0))
  ) {
    throw new TypeError("同步计划包含无效连续状态候选。");
  }
}

/** 在任何 Capability 写入前验证完整同步提交候选。 */
export function validateSyncCommitEnvelope(value: unknown):
  | { readonly route: "valid"; readonly envelope: SyncCommitEnvelopeV1 }
  | {
      readonly route: "failed";
      readonly failure: SyncCommitContractFailureV1;
    } {
  let step: PlannedStepV1 | null = null;
  try {
    if (
      !isRecord(value) ||
      (value.mode !== "commit" && value.mode !== "non-commit")
    ) {
      throw new TypeError("同步提交候选缺少有效 mode。");
    }
    if (value.mode === "non-commit") {
      if (!isRecord(value.work))
        throw new TypeError("无提交候选缺少同步工作项。");
      step = assertSyncStep(value.work.step);
      if (value.work.disposition === "commit") {
        throw new TypeError("commit 工作项不能封装为 non-commit。");
      }
      assertConsecutiveCandidate((value.work as unknown as SyncWorkV1).plan);
      cloneEraPortableJsonV1(
        buildSyncNonCommitResult(value.work as unknown as SyncWorkV1),
      );
      return {
        route: "valid",
        envelope: value as unknown as SyncCommitEnvelopeV1,
      };
    }
    if (!isRecord(value.request)) throw new TypeError("提交候选缺少请求。");
    const request = value.request as unknown as SyncCommitRequestV1;
    step = assertSyncStep(request.step);
    if (
      !isRecord(request.sourceBasis) ||
      !isRecord(request.sourceBasis.identity) ||
      !Array.isArray(request.sourceBasis.messages)
    ) {
      throw new TypeError("同步提交缺少原始宿主依据。");
    }
    if (request.schemaVersion !== 2 || !isRecord(request.plan)) {
      throw new TypeError("同步提交请求或同步计划无效。");
    }
    const prepared = dispatchContext(step);
    const expectedMk = prepared.processingMk ?? "";
    const emptyCommit = request.plan.messages.length === 0;
    if (emptyCommit) {
      if (
        request.payload !== null ||
        prepared.processingMessage !== null ||
        expectedMk.length > 0
      ) {
        throw new TypeError("零消息同步提交不得伪造消息身份。");
      }
    } else {
      if (!isRecord(request.payload))
        throw new TypeError("同步提交请求缺少公开 payload。");
      if (request.payload.mk !== expectedMk) {
        throw new TypeError("公开 payload MK 与不可变 processing MK 不一致。");
      }
      if (
        prepared.requirement === "latest-message-with-mk" &&
        expectedMk.length === 0
      ) {
        throw new TypeError("latest-message-with-mk 提交候选不允许空 MK。");
      }
      if (
        prepared.processingMessage === null ||
        request.payload.message_id !== prepared.processingMessage.messageId ||
        request.payload.is_user !== (prepared.processingMessage.role === "user")
      ) {
        throw new TypeError(
          "公开 payload 的消息身份与 processing message 不一致。",
        );
      }
      if (
        !Number.isSafeInteger(request.payload.consecutiveProcessingCount) ||
        request.payload.consecutiveProcessingCount < 1
      ) {
        throw new TypeError("公开 payload 缺少有效连续处理次数。");
      }
    }
    assertConsecutiveCandidate(request.plan);
    if (!Array.isArray(request.messageWrites))
      throw new TypeError("消息提交列表无效。");
    const writtenIds = new Set<number>();
    for (const write of request.messageWrites) {
      if (
        !isRecord(write) ||
        !Number.isSafeInteger(write.messageId) ||
        Number(write.messageId) < 0 ||
        typeof write.content !== "string"
      )
        throw new TypeError("消息提交项无效。");
      if (writtenIds.has(Number(write.messageId))) {
        throw new TypeError("同一消息在原子提交中出现了重复写入。");
      }
      writtenIds.add(Number(write.messageId));
      if (write.extra !== undefined) cloneEraPortableJsonV1(write.extra);
    }
    if (request.initialPresentation != null) {
      const floor = request.floorIdentity;
      const write = request.messageWrites.find(
        (item) => item.messageId === floor?.messageId,
      );
      const selected =
        Array.isArray(request.meta.SelectedMks) && floor !== null
          ? request.meta.SelectedMks[floor.messageId]
          : null;
      if (
        floor === null ||
        !deepSyncEqual(request.initialPresentation, floor) ||
        selected !== floor.mk ||
        write === undefined ||
        readMessageKey({
          messageId: write.messageId,
          role: "assistant",
          content: { kind: "text", text: write.content },
        }) !== floor.mk
      ) {
        throw new SyncContractError(
          "ERA_FLOOR_IDENTITY_MISMATCH",
          "首次呈现目标与最终提交楼层不一致。",
        );
      }
    }
    if (request.agentFloorCandidate !== null && !request.plan.execution) {
      const candidate = request.agentFloorCandidate;
      const floor = request.floorIdentity;
      const processing = prepared.processingMessage;
      const messageIndex = request.plan.messages.findIndex(
        (message) => message.messageId === candidate.messageId,
      );
      const selected = Array.isArray(request.meta.SelectedMks)
        ? request.meta.SelectedMks[messageIndex]
        : null;
      const editLogs = isRecord(request.meta.EditLogs)
        ? request.meta.EditLogs
        : {};
      const functionEditLogs = isRecord(request.meta.FunctionEditLogs)
        ? request.meta.FunctionEditLogs
        : {};
      const finalWrite = request.messageWrites.find(
        (write) => write.messageId === candidate.messageId,
      );
      const finalMk =
        finalWrite === undefined
          ? null
          : readMessageKey({
              messageId: finalWrite.messageId,
              role: "assistant",
              content: { kind: "text", text: finalWrite.content },
            });
      const mismatch =
        floor === null ||
        processing === null ||
        messageIndex < 0 ||
        candidate.messageId !== floor.messageId ||
        candidate.swipeId !== floor.swipeId ||
        candidate.mk !== floor.mk ||
        prepared.processingMk !== floor.mk ||
        processing.messageId !== floor.messageId ||
        finalMk !== floor.mk ||
        selected !== floor.mk ||
        !Object.prototype.hasOwnProperty.call(editLogs, floor.mk) ||
        !Object.prototype.hasOwnProperty.call(functionEditLogs, floor.mk);
      if (mismatch) {
        throw new SyncContractError(
          "ERA_FLOOR_IDENTITY_MISMATCH",
          "最终消息、processing floor、SelectedMks、变量日志、函数日志与状态栏绑定 MK 不一致。",
        );
      }
    }
    cloneEraPortableJsonV1(request.stat);
    cloneEraPortableJsonV1(request.statFunc);
    cloneEraPortableJsonV1(request.meta);
    cloneEraPortableJsonV1(request.payload);
    return {
      route: "valid",
      envelope: value as unknown as SyncCommitEnvelopeV1,
    };
  } catch (error) {
    if (step === null) throw error;
    return {
      route: "failed",
      failure: {
        schemaVersion: 1,
        step,
        failure: syncFailure(
          error instanceof SyncContractError
            ? error.code
            : "ERA_SYNC_COMMIT_CONTRACT_INVALID",
          errorMessage(error),
          "domain",
        ),
      },
    };
  }
}

export function observationRecord(
  value: unknown,
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) return {};
  if (
    value.ok === true &&
    Object.prototype.hasOwnProperty.call(value, "value")
  ) {
    return observationRecord(value.value);
  }
  if (value.ok === false && isRecord(value.error)) {
    return value.error;
  }
  return value;
}

/**
 * 只接受明确的成功或明确的“尚未写入”。其余返回、抛错、部分提交与迟到
 * 取消一律归为 unknown，调用方必须 fatal。
 */
export function observeWrite(value: unknown): WriteObservation {
  const record = observationRecord(value);
  if (
    record.status === "committed" ||
    record.status === "completed" ||
    record.status === "updated" ||
    record.committed === true
  ) {
    return { kind: "confirmed" };
  }
  const state = record.writeState ?? record.commitState ?? record.outcome;
  if (
    state === "not-written" ||
    state === "rejected-before-write" ||
    record.status === "not-written" ||
    record.written === false
  ) {
    return {
      kind: "not-written",
      message: errorMessage(record.message ?? value),
    };
  }
  return { kind: "unknown", message: errorMessage(record.message ?? value) };
}

export function deepSyncEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepSyncEqual(value, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] && deepSyncEqual(left[key], right[key]),
      )
    );
  }
  return false;
}

/** 提交返回携带回读变量时进行严格比对；没有回读字段时仍依赖显式 committed。 */
export function verifyCommittedVariables(
  value: unknown,
  request: SyncCommitRequestV1,
): boolean {
  const record = observationRecord(value);
  let observed: Record<string, unknown> | null = null;
  try {
    for (const key of ["variables", "value", "data", "chat"]) {
      if (isRecord(record[key])) {
        observed = variablesRecord(record[key]);
        break;
      }
    }
  } catch {
    return false;
  }
  if (observed === null) return true;
  const observedStat = observed.stat_data ?? observed.stat;
  const observedMeta = observed.ERAMetaData ?? observed.meta;
  return (
    deepSyncEqual(observedStat, request.stat) &&
    deepSyncEqual(observedMeta, request.meta)
  );
}
