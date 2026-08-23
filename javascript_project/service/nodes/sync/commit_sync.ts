import {
  cloneSyncJson,
  errorMessage,
  isCancellation,
  observeWrite,
  syncFailure,
  type SyncCommitRequestV1,
  type SyncCommitResultV1,
  type SyncFailureV1,
  type SyncWorkV1,
} from "../../base_lib/sync_transaction.ts";
import { inspectSidecar, recordFor, type SidecarRecordV1, type SidecarStateV2 } from "../../base_lib/sidecar_binding.ts";

interface Envelope<T> {
  readonly value: T;
}

type CommitEnvelope =
  | { readonly mode: "non-commit"; readonly work: SyncWorkV1 }
  | { readonly mode: "commit"; readonly request: SyncCommitRequestV1 };

type Context = any;

function result(
  request: SyncCommitRequestV1,
  status: "committed" | "failed" | "fatal",
  confirmedMessageWrites: number,
  variablesCommitted: boolean,
  failure: SyncFailureV1 | null,
): SyncCommitResultV1 {
  return {
    ...request,
    status,
    confirmedMessageWrites,
    variablesCommitted,
    failure,
  };
}

function failureFor(error: unknown, code: string): SyncFailureV1 {
  const cancelled = isCancellation(error);
  return syncFailure(
    cancelled ? `${code}_CANCELLED` : code,
    errorMessage(error),
    cancelled ? "cancelled" : "tavern",
  );
}

/**
 * 消息已经确认写入后，Sidecar 文件失败并不是“消息拓扑未知”：指令仍在聊天
 * 历史中，可以由用户明确的修复操作安全重放。这里仅把 workflow 已知的
 * 修复状态交给宿主显示；宿主不参与任何绑定或恢复决策。
 */
async function presentRecoverableSidecarFailure(context: Context): Promise<void> {
  try {
    const current = await context.capabilities["era.tavern.sidecar"].read_current({});
    const meta = current !== null && typeof current === "object"
      ? (current as Record<string, unknown>).meta
      : null;
    const sidecarId = meta !== null && typeof meta === "object"
      ? (meta as Record<string, unknown>).SidecarId
      : null;
    if (typeof sidecarId !== "string") return;
    const stored = await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId });
    const facts = inspectSidecar(current, stored);
    if (facts.current === null) return;
    context.capabilities["era.tavern.sidecar"].present_prompt({
      prompt: {
        kind: "repair",
        sidecarId,
        current: facts.current,
        owner: facts.record?.owner ?? null,
        revision: facts.record?.revision ?? null,
        reason: "sidecar-state-commit-failed",
      },
    });
  } catch {
    // 原始文件失败仍须如实结算；弹窗显示失败不得把一个可重放状态升级为未知提交。
  }
}

export async function run(
  inputs: Readonly<{ "era.tavern.commit.request": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const envelope = inputs["era.tavern.commit.request"].value as CommitEnvelope;
  if (envelope.mode === "non-commit") {
    return {
      sync_commit_result: envelope as unknown as Readonly<Record<string, unknown>>,
    };
  }

  const request = envelope.request;
  let confirmedMessageWrites = 0;
  for (const write of request.messageWrites) {
    let response: unknown;
    try {
      response = await context.capabilities["era.tavern.messages"].update_content({
        messageId: write.messageId,
        content: write.content,
        purpose: "era-sync",
      });
    } catch (error) {
      return {
        sync_commit_result: result(
          request,
          confirmedMessageWrites === 0 ? "failed" : "fatal",
          confirmedMessageWrites,
          false,
          failureFor(error, "ERA_SYNC_MESSAGE_COMMIT_FAILED"),
        ) as unknown as Readonly<Record<string, unknown>>,
      };
    }
    const observation = observeWrite(response);
    if (observation.kind !== "confirmed") {
      const isSafeFailure =
        observation.kind === "not-written" && confirmedMessageWrites === 0;
      return {
        sync_commit_result: result(
          request,
          isSafeFailure ? "failed" : "fatal",
          confirmedMessageWrites,
          false,
          syncFailure(
            isSafeFailure
              ? "ERA_SYNC_MESSAGE_NOT_WRITTEN"
              : "ERA_SYNC_MESSAGE_COMMIT_UNKNOWN",
            observation.message,
            "tavern",
          ),
        ) as unknown as Readonly<Record<string, unknown>>,
      };
    }
    confirmedMessageWrites += 1;
  }

  let stateResponse: unknown;
  try {
    const current = await context.capabilities["era.tavern.sidecar"].read_current({});
    const meta = current !== null && typeof current === "object" ? (current as Record<string, unknown>).meta : null;
    const id = meta !== null && typeof meta === "object" ? (meta as Record<string, unknown>).SidecarId : null;
    if (typeof id !== "string") throw new TypeError("ERA 当前聊天没有已加载的 SidecarId。");
    const stored = await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: id });
    const facts = inspectSidecar(current, stored);
    if (facts.current === null || facts.record === null || facts.status !== "matched") throw new TypeError("ERA Sidecar 状态在提交前已变化。");
    const eraMeta = cloneSyncJson(request.meta) as Record<string, unknown>;
    delete eraMeta.SidecarId;
    const state: SidecarStateV2 = {
      statData: cloneSyncJson(request.stat),
      eraMeta,
      statFunc: cloneSyncJson(request.statFunc) as Record<string, unknown>,
    };
    const record = recordFor(id, facts.current, state, facts.record);
    stateResponse = await context.capabilities["era.tavern.sidecar"].write_record({ sidecarId: id, record });
    const observation = observeWrite(stateResponse);
    if (observation.kind !== "confirmed") throw new TypeError(observation.message);
    const verify = await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: id });
    const checked = inspectSidecar(current, verify);
    if (checked.record === null || checked.record.revision !== record.revision) throw new TypeError("ERA Sidecar 提交回读不一致。");
    // 指针已经存在；重复机械提交不会写入任何 ERA 聊天状态，只在文件回读成功后
    // 刷新当前页面宏快照。
    await context.capabilities["era.tavern.sidecar"].commit_metadata({ sidecarId: id, snapshot: record });
  } catch (error) {
    await presentRecoverableSidecarFailure(context);
    return {
      sync_commit_result: result(
        request,
        // Sidecar 写入发生在所有消息写入均已确认之后。状态文件不是聊天历史
        // 的替代提交物，失败时保留已确认指令并要求显式 repair，而非停服。
        "failed",
        confirmedMessageWrites,
        false,
        failureFor(error, "ERA_SYNC_SIDECAR_COMMIT_FAILED"),
      ) as unknown as Readonly<Record<string, unknown>>,
    };
  }
  return {
    sync_commit_result: result(
      request,
      "committed",
      confirmedMessageWrites,
      true,
      null,
    ) as unknown as Readonly<Record<string, unknown>>,
  };
}
