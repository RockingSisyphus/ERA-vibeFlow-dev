import {defineNode} from "@vibeflow/plugin";

export const era_mk_derive = defineNode({
  "display_name": "为目标消息生成历史关联标识",
  "description": "读取目标正文、现有内部记录和显示占位设置，为消息准备关联变量历史的身份标识。保留作者文字及其他记录，用户消息只补标识；输出待保存改动，供后续确认是否需要写入。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.mk.context","cardinality":"exactly_one","display_name":"生成消息历史身份所需的当前资料"}],"provides":[{"key":"mk_candidate","type":"era.mk.candidate","display_name":"消息历史身份及建议修改"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.mk.context":["包含目标正文、内部记录及占位设置，供推导必要修改。"]},"output_semantics":{"mk_candidate":["包含拟采用的消息标识、正文或内部记录变化，仍需判断和确认保存。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/update_mk/derive_mk_candidate.ts","export":"run"}}],
  "base_libs": ["era.service.mk_engine","era.service.types"],
  "capabilities": [],
  "tags": ["消息密钥纯计算"],
  "rulesets": ["vibeflow.process"],
  "id": "era.mk.derive",
  "node_type": "vibeflow.node"
});
