import {
  buildSyncContractFailureResult,
  syncFailure,
  type SyncCommitContractFailureV1,
} from "../../base_lib/sync_transaction.ts";
import type { SyncContextV1 } from "../../base_lib/sidecar_binding.ts";

interface Envelope<T> { readonly value: T; }

export function run(inputs: Readonly<{ "era.sync.context": Envelope<unknown> }>): any {
  const context = inputs["era.sync.context"].value as SyncContextV1;
  const result: SyncCommitContractFailureV1 = {
    schemaVersion: 1,
    step: context.step as SyncCommitContractFailureV1["step"],
    failure: syncFailure(
      "ERA_SIDECAR_BINDING_DECISION_REQUIRED",
      "当前聊天的 SidecarId 已被另一角色卡或聊天占用；请在 ERA 弹窗中选择迁移、创建独立变量或复制变量。",
      "domain",
    ),
  };
  return { sidecar_binding_blocked_result: buildSyncContractFailureResult(result) };
}
