// Adapters with identical declared base libraries share this source.
import { type SidecarResolutionV1, resolveSidecar, type SidecarFactsV1, type SyncContextV1 } from "../../base_lib/sidecar_binding.ts";

// Original node: nodes/sidecar/publish_choice_prompt.ts
interface PublishChoicePrompt_Ctx {
  readonly capabilities: {
    readonly "era.tavern.sidecar": { present_prompt(input: Readonly<Record<string, unknown>>): unknown };
  };
}

export function PublishChoicePromptNode(inputs: Readonly<{ "era.sidecar.binding.resolution": { readonly value: unknown } }>, _params: Readonly<Record<string, unknown>>, context: PublishChoicePrompt_Ctx): any {
  const resolution = inputs["era.sidecar.binding.resolution"].value as SidecarResolutionV1;
  // 用户已经做出选择时，决议会进入 apply。此时只应执行受控事务，不能在
  // apply_resolution 前再次发布同一冲突弹窗，避免出现“重复冲突提示后才清除”的
  // 短暂错误状态。
  if (resolution.route !== "blocked") return {};
  const facts = resolution.facts;
  if (facts.status === "conflict" && facts.current !== null && facts.record !== null) {
    context.capabilities["era.tavern.sidecar"].present_prompt({
      prompt: {
        kind: "conflict",
        sidecarId: facts.sidecarId,
        current: facts.current,
        owner: facts.record.owner,
        revision: facts.record.revision,
      },
    });
  }
  if (facts.status === "invalid") {
    context.capabilities["era.tavern.sidecar"].present_prompt({
      prompt: {
        kind: "repair",
        sidecarId: facts.sidecarId,
        current: facts.current,
        owner: null,
        revision: null,
        reason: facts.reason,
      },
    });
  }
  return {};
}

// Original node: nodes/sidecar/resolve_choice.ts
export function ResolveChoiceNode(inputs: Readonly<{
  "era.sidecar.binding.input": { readonly value: unknown };
  "era.sidecar.binding.facts": { readonly value: unknown };
}>): any {
  const bindingInput = inputs["era.sidecar.binding.input"].value as { readonly sync: SyncContextV1 };
  const resolution = resolveSidecar(
    inputs["era.sidecar.binding.facts"].value as SidecarFactsV1,
    bindingInput.sync,
  );
  return { sidecar_binding_resolution: resolution };
}
