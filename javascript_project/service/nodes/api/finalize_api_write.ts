import type { EraTaskResultV1 } from "@era/vibeflow-contracts";

interface Envelope<T> {
  readonly value: T;
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

  // 消息指令已经确认写入，随后状态同步失败会留下可观察的部分提交，必须停服扫描。
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
