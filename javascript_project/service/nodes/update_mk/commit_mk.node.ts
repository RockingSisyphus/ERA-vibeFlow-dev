import {defineNode} from "@vibeflow/plugin";

export const era_tavern_mk_commit = defineNode({
  "display_name": "保存消息身份标识及对应内部记录",
  "description": "接收明确的消息标识修改，向酒馆保存相关正文和内部记录。逐项返回实际确认的写入状态，供标识任务决定成功、无变化或失败。",
  "version": "1.0.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.mk.commit.request","cardinality":"exactly_one","display_name":"需要保存的消息身份和正文改动"}],"provides":[{"key":"mk_commit_outcome","type":"era.mk.commit.result","display_name":"消息身份准备和实际保存的结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.mk.commit.request":["供向酒馆明确提交相应正文及内部历史记录。"]},"output_semantics":{"mk_commit_outcome":["保留是否变化、哪些写入已确认及失败原因，供向原事件返回处理确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/update_mk/commit_mk.ts","export":"run"}}],
  "base_libs": ["era.service.sidecar_binding","era.service.types"],
  "capabilities": [{"id":"era.tavern.messages","operations":["update_content"]},{"id":"era.tavern.sidecar","operations":["read_current","read_record","write_record","commit_metadata"]}],
  "tags": ["消息密钥宿主边界"],
  "rulesets": ["vibeflow.data_store"],
  "id": "era.tavern.mk_commit",
  "node_type": "vibeflow.node"
});
