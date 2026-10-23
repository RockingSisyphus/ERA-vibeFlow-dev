import {defineNode} from "@vibeflow/plugin";

export const era_tavern_functions_release_reject_pending = defineNode({
  "display_name": "交接作者未决请求已处理完的状态",
  "description": "接收逐项结束作者未确认操作的循环结果，交给参数解绑和最终释放。确保结束等待的工作先完成，再撤销本次运行关联。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_release.close_call","cardinality":"exactly_one","display_name":"交接作者未决请求已处理完的状态的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_release_reject_pending_frame","type":"era.tavern.frame.functions_release.reject_pending","display_name":"交接作者未决请求已处理完的状态的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_release_reject_pending_frame"}},"input_semantics":{"era.tavern.frame.functions_release.close_call":["保留“交接作者未决请求已处理完的状态”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_release_reject_pending_frame":["保留“交接作者未决请求已处理完的状态”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.functions_release.reject_pending",
  "node_type": "vibeflow.node"
});
