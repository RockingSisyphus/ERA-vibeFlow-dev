import {defineNode} from "@vibeflow/plugin";

export const era_sidecar_binding_build_applied_result = defineNode({
  "display_name": "返回状态文件绑定或修复的结果",
  "description": "接收状态文件新建、迁移或修复后的真实结论，匹配原事件，保留本次已经在内存应用的变量提交。将结果交给任务结算，使调用方知道当前可用状态。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.context","cardinality":"exactly_one","display_name":"本次历史同步需要的消息和文件资料"}],"provides":[{"key":"sidecar_binding_applied_result","type":"era.task.result","display_name":"本项任务对应原事件的处理结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.context":["包含已选状态、处理范围及可能的绑定修复结果，供恢复消息执行起点。"]},"output_semantics":{"sidecar_binding_applied_result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/shared_choice_adapters.ts","export":"BuildAppliedResultNode"}}],
  "base_libs": ["era.service.sidecar_binding","era.service.sync_contracts","era.service.sync_result_policy"],
  "capabilities": [],
  "tags": ["Sidecar 绑定"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sidecar_binding.build_applied_result",
  "node_type": "vibeflow.node"
});

export const era_sidecar_binding_build_blocked_result = defineNode({
  "display_name": "说明状态文件为何需要用户选择",
  "description": "状态文件归属冲突或损坏仍未解决时，为原请求形成包含原因的失败确认。页面据此提示用户选择，任务在选择明确前不会继续使用不确定文件。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.context","cardinality":"exactly_one","display_name":"本次历史同步需要的消息和文件资料"}],"provides":[{"key":"sidecar_binding_blocked_result","type":"era.task.result","display_name":"本项任务对应原事件的处理结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.context":["包含已选状态、处理范围及可能的绑定修复结果，供恢复消息执行起点。"]},"output_semantics":{"sidecar_binding_blocked_result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/shared_choice_adapters.ts","export":"BuildBlockedResultNode"}}],
  "base_libs": ["era.service.sidecar_binding","era.service.sync_contracts","era.service.sync_result_policy"],
  "capabilities": [],
  "tags": ["Sidecar 绑定"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sidecar_binding.build_blocked_result",
  "node_type": "vibeflow.node"
});

export const era_sidecar_binding_publish_choice_prompt = defineNode({
  "display_name": "显示状态文件冲突或损坏的处理选项",
  "description": "根据当前聊天身份、状态文件归属和版本，向页面显示需要用户决定的处理方案。已有有效选择时沿用该选择，供后续规划绑定或修复。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sidecar.binding.resolution","cardinality":"exactly_one","display_name":"本次已选定的文件绑定或修复方案"}],"provides":[],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sidecar.binding.resolution":["包含要执行的明确文件及聊天修改，或需要等待选择的原因。"]},"output_semantics":{}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/shared_choice_adapters.ts","export":"PublishChoicePromptNode"}}],
  "base_libs": ["era.service.sidecar_binding","era.service.sync_contracts","era.service.sync_result_policy"],
  "capabilities": [{"id":"era.tavern.sidecar","operations":["present_prompt"]}],
  "tags": ["Sidecar 绑定"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sidecar_binding.publish_choice_prompt",
  "node_type": "vibeflow.node"
});

export const era_sidecar_binding_resolve_choice = defineNode({
  "display_name": "决定继续使用、新建还是修复状态文件",
  "description": "接收当前文件检查结果和已有用户选择，判断可直接使用、需要新建迁移，还是必须等待归属或修复确认。读取失败时保留具体原因，交给相应处理分支。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sidecar.binding.input","cardinality":"exactly_one","display_name":"当前聊天状态文件绑定的检查资料"},{"type":"era.sidecar.binding.facts","cardinality":"exactly_one","display_name":"读到的文件归属、版本及内存状态"}],"provides":[{"key":"sidecar_binding_resolution","type":"era.sidecar.binding.resolution","display_name":"本次已选定的文件绑定或修复方案"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sidecar.binding.input":["供决定沿用、新建、迁移、修复或等待用户选择。"],"era.sidecar.binding.facts":["供判断当前聊天是否可以使用这份独立状态记录。"]},"output_semantics":{"sidecar_binding_resolution":["包含要执行的明确文件及聊天修改，或需要等待选择的原因。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/shared_choice_adapters.ts","export":"ResolveChoiceNode"}}],
  "base_libs": ["era.service.sidecar_binding","era.service.sync_contracts","era.service.sync_result_policy"],
  "tags": ["Sidecar 绑定"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sidecar_binding.resolve_choice",
  "node_type": "vibeflow.node"
});
