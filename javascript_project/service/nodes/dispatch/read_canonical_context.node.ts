import {defineNode} from "@vibeflow/plugin";

export const era_dispatch_read_canonical_context = defineNode({
  "display_name": "读取当前任务真正需要的聊天资料",
  "description": "按任务需要，从酒馆读取当前聊天、消息正文和所选回复，连同状态文件绑定、历史记录及显示占位设置。整理成同一份任务资料，供后续确定处理范围和执行起点。",
  "version": "1.0.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.dispatch.seed","cardinality":"exactly_one","display_name":"任务资料准备的输入依据"}],"provides":[{"key":"canonical_dispatch_context","type":"era.dispatch.canonical_context","display_name":"当前任务统一读取到的聊天上下文"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.dispatch.seed":["保留任务种类、来源和要求读取的范围，供准备聊天上下文。"]},"output_semantics":{"canonical_dispatch_context":["包含目标消息、回复、文件绑定及相关设置，供确定处理范围和准备改动。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/dispatch/read_canonical_context.ts","export":"run"}}],
  "base_libs": ["era.service.dispatch_preparation","era.service.sidecar_binding"],
  "capabilities": [{"id":"era.tavern.messages","operations":["read_context"]},{"id":"era.tavern.identity","operations":["read"]},{"id":"era.tavern.variables","operations":["read"]},{"id":"era.tavern.sidecar","operations":["read_current","read_record"]}],
  "tags": ["任务派发"],
  "rulesets": ["vibeflow.data_store"],
  "id": "era.dispatch.read_canonical_context",
  "node_type": "vibeflow.node"
});
