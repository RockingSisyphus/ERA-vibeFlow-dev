import {defineNode} from "@vibeflow/plugin";

export const era_tavern_functions_next_finish_join_ready = defineNode({
  "display_name": "交接等到作者提出操作或真正结束的选中结果",
  "description": "在“等到作者提出操作或真正结束”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_next.check_active","cardinality":"all","display_name":"交接等到作者提出操作或真正结束的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_finish_join_ready_frame","type":"era.tavern.frame.functions_next.wait_request","display_name":"交接等到作者提出操作或真正结束的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_finish_join_ready_frame"}},"input_semantics":{"era.tavern.frame.functions_next.check_active":["保留“交接等到作者提出操作或真正结束的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_finish_join_ready_frame":["保留“交接等到作者提出操作或真正结束的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.functions_next_finish.join_ready",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_next_finish_ready = defineNode({
  "display_name": "交出已取得的作者请求或结束结果",
  "description": "同步检查已经取到作者操作或函数结束结论时，将这份实际结果交回消息流程。避免再次取队列而越过当前请求。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame.next_state","cardinality":"exactly_one","display_name":"交出已取得的作者请求或结束结果的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_finish_ready_frame","type":"era.tavern.frame.functions_next.check_active","display_name":"交出已取得的作者请求或结束结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_finish_ready_frame"}},"input_semantics":{"era.tavern.call.frame.next_state":["保留“交出已取得的作者请求或结束结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_finish_ready_frame":["保留“交出已取得的作者请求或结束结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.functions_next_finish.ready",
  "node_type": "vibeflow.node"
});
