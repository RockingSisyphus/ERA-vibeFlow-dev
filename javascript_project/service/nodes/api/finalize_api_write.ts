import type { EraTaskResultV1 } from "@era/vibeflow-contracts";

interface Envelope<T> {
  readonly value: T;
}

function isRecoverableSidecarFailure(result: EraTaskResultV1): boolean {
  return result.status === "failed" && result.diagnostics.some((diagnostic) =>
    diagnostic.code === "ERA_SYNC_SIDECAR_COMMIT_FAILED" ||
    diagnostic.code === "ERA_SYNC_SIDECAR_COMMIT_FAILED_CANCELLED",
  );
}

export function run(
  inputs: Readonly<{ "era.task.result": Envelope<unknown> }>,
): any {
  const syncResult = inputs["era.task.result"].value as EraTaskResultV1;
  if (syncResult.status === "committed" || syncResult.status === "no-op") {
    return {
      api_write_success_result: {
        ...syncResult,
        notifications: [
          { type: "era:apiWrite", args: [] },
          ...syncResult.notifications,
        ],
      },
    };
  }

  if (isRecoverableSidecarFailure(syncResult)) {
    // 消息已经确认、但 Sidecar 文件未提交时，历史仍可由明确 repair 重放。
    // 保留原始可定位失败，不伪造 apiWrite 成功，更不能把服务升级成 fatal。
    return {
      api_write_success_result: {
        ...syncResult,
        notifications: syncResult.notifications,
      },
    };
  }

  // 只有消息提交本身未知/部分确认，才会留下不可判定的聊天拓扑并必须停服扫描。
  return {
    api_write_success_result: {
      status: "fatal",
      settlements: syncResult.settlements,
      notifications: [],
      diagnostics: [
        ...syncResult.diagnostics,
        {
          code: "ERA_API_PARTIAL_COMMIT",
          message: "API 指令已写入消息，但 ERA 状态同步未确认完成；服务已进入 fatal。",
          sequence: null,
        },
      ],
    },
  };
}
