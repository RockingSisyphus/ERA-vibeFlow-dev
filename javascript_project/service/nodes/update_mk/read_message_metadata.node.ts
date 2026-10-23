import {defineNode} from "@vibeflow/plugin";

export const era_tavern_mk_read = defineNode({
  "display_name": "读取生成消息标识所需的资料",
  "description": "读取目标消息的正文、内部记录和状态栏占位设置。供消息标识推导判断哪些内容已有、哪些需要补齐，并保留读取问题供任务返回。",
  "version": "1.0.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"}],"provides":[{"key":"mk_context","type":"era.mk.context","display_name":"生成消息历史身份所需的当前资料"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"]},"output_semantics":{"mk_context":["包含目标正文、内部记录及占位设置，供推导必要修改。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/update_mk/read_message_metadata.ts","export":"run"}}],
  "base_libs": ["era.service.mk_read_normalization","era.service.sidecar_binding","era.service.types"],
  "capabilities": [{"id":"era.tavern.messages","operations":["read_context"]},{"id":"era.tavern.variables","operations":["read"]},{"id":"era.tavern.sidecar","operations":["read_current","read_record"]}],
  "tags": ["消息密钥宿主边界"],
  "rulesets": ["vibeflow.data_store"],
  "id": "era.tavern.mk_read",
  "node_type": "vibeflow.node"
});
