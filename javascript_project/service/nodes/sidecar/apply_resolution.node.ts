import {defineNode} from "@vibeflow/plugin";

export const era_sidecar_binding_apply_resolution = defineNode({
  "display_name": "按选定方案新建、迁移或修复状态文件",
  "description": "接收已确定的独立状态文件处理方案，先完成必要消息修改，再保存文件和聊天绑定。过程中检查聊天身份及文件版本，记录实际完成部分和失败原因，供同步或恢复判断。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sidecar.binding.input","cardinality":"exactly_one","display_name":"当前聊天状态文件绑定的检查资料"},{"type":"era.sidecar.binding.resolution","cardinality":"exactly_one","display_name":"本次已选定的文件绑定或修复方案"}],"provides":[{"key":"sidecar_applied_context","type":"era.sync.context","display_name":"本次历史同步需要的消息和文件资料"},{"key":"sidecar_binding_route","type":"era.sidecar.binding.route","display_name":"继续使用文件、执行修复或等待选择"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sidecar.binding.input":["供决定沿用、新建、迁移、修复或等待用户选择。"],"era.sidecar.binding.resolution":["包含要执行的明确文件及聊天修改，或需要等待选择的原因。"]},"output_semantics":{"sidecar_applied_context":["包含已选状态、处理范围及可能的绑定修复结果，供恢复消息执行起点。"],"sidecar_binding_route":["明确当前状态文件检查和用户选择得到的处理方向。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/sidecar/apply_resolution.ts","export":"run"}}],
  "base_libs": ["era.service.sidecar_binding","era.service.sidecar_resolution_projection","era.service.working_state"],
  "capabilities": [{"id":"era.tavern.sidecar","operations":["read_current","read_record","write_record","commit_metadata","publish_snapshot","create_id","clear_prompt","read_working","write_working"]},{"id":"era.tavern.messages","operations":["update_content"]}],
  "tags": ["Sidecar 绑定"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sidecar_binding.apply_resolution",
  "node_type": "vibeflow.node"
});
