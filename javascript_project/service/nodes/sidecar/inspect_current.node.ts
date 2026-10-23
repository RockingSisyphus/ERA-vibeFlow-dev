import {defineNode} from "@vibeflow/plugin";

export const era_sidecar_binding_inspect_current = defineNode({
  "display_name": "确认当前聊天应使用哪份状态",
  "description": "读取聊天绑定的独立状态文件及其归属，检查可否沿用同一聊天的内存变量、函数和历史。也识别尚需恢复的生成起点，供后续选择继续、修复或请用户确认。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.context","cardinality":"exactly_one","display_name":"本次历史同步需要的消息和文件资料"}],"provides":[{"key":"sidecar_binding_input","type":"era.sidecar.binding.input","display_name":"当前聊天状态文件绑定的检查资料"},{"key":"sidecar_binding_facts","type":"era.sidecar.binding.facts","display_name":"读到的文件归属、版本及内存状态"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.context":["包含已选状态、处理范围及可能的绑定修复结果，供恢复消息执行起点。"]},"output_semantics":{"sidecar_binding_input":["供决定沿用、新建、迁移、修复或等待用户选择。"],"sidecar_binding_facts":["供判断当前聊天是否可以使用这份独立状态记录。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/sidecar/inspect_current.ts","export":"run"}}],
  "base_libs": ["era.service.agent_session_binding","era.service.sidecar_binding","era.service.working_state"],
  "capabilities": [{"id":"era.tavern.sidecar","operations":["read_current","read_record","read_working","write_working"]},{"id":"era.tavern.agent","operations":["read_session_binding","write_session","clear_session"]}],
  "tags": ["Sidecar 绑定"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sidecar_binding.inspect_current",
  "node_type": "vibeflow.node"
});
