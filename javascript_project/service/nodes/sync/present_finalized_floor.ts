import { basisAfterSyncWrites } from "../../base_lib/sync/sync_commit_policy.ts";
import { type SyncCommitResultV1, type SyncWorkV1 } from "../../base_lib/sync/sync_contracts.ts";

interface Envelope<T> {
  readonly value: T;
}

type CommitOutcome =
  | { readonly mode: "non-commit"; readonly work: SyncWorkV1 }
  | SyncCommitResultV1;

interface Context {
  readonly capabilities: {
    readonly "era.tavern.messages": {
      refresh(input: Readonly<Record<string, unknown>>): Promise<unknown>;
    };
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 业务提交和首次显示是两个结论：Sidecar 成功后才允许为新楼层执行一次正常
 * affected render；显示失败只附加诊断，绝不回滚已经提交的聊天与状态。
 */
export async function run(
  inputs: Readonly<{ "era.tavern.commit.result": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const outcome = inputs["era.tavern.commit.result"].value as CommitOutcome;
  if ("mode" in outcome && outcome.mode === "non-commit") {
    // 逐块提交的楼层不再由尾链写入，但刷新显示仍然归尾链：工作项带呈现意图时这里执行一次
    // 「affected」刷新；不带意图（或带 null）时保持原样，不做任何宿主调用。
    const work = outcome.work as {
      readonly initialPresentation?: { readonly messageId: number } | null;
    };
    const intent = work.initialPresentation ?? null;
    if (intent === null) return { presented_sync_commit_result: outcome };
    try {
      await context.capabilities["era.tavern.messages"].refresh({
        messageId: intent.messageId,
        mode: "affected",
        purpose: "era-final-floor-initial-presentation",
      });
      return { presented_sync_commit_result: outcome };
    } catch (error) {
      return {
        presented_sync_commit_result: {
          ...outcome,
          presentationDiagnostic: {
            code: "ERA_FINAL_FLOOR_PRESENTATION_FAILED",
            message: message(error),
          },
        },
      };
    }
  }
  if (
    outcome.status !== "committed" ||
    outcome.sourceChanged === true ||
    !outcome.variablesCommitted ||
    outcome.initialPresentation == null
  ) {
    return { presented_sync_commit_result: outcome };
  }
  try {
    await context.capabilities["era.tavern.messages"].refresh({
      sourceBasis: basisAfterSyncWrites(outcome),
      messageId: outcome.initialPresentation.messageId,
      mode: "affected",
      purpose: "era-final-floor-initial-presentation",
    });
    return { presented_sync_commit_result: outcome };
  } catch (error) {
    return {
      presented_sync_commit_result: {
        ...outcome,
        presentationDiagnostic: {
          code: "ERA_FINAL_FLOOR_PRESENTATION_FAILED",
          message: message(error),
        },
      },
    };
  }
}
