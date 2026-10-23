import {defineNode} from "@vibeflow/plugin";

export const era_tavern_owned_return_native_retry = defineNode({
  "display_name": "返回延后停止的有效尝试或忽略结果",
  "description": "接收本实例单次停止安排的实际执行结果，或旧安排失效后的空结论，交回同步回调。停止监听已由相应分支处理。",
  "flow_kind": "process",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.frame.native_stop_retry.result","cardinality":"exactly_one","display_name":"返回延后停止的有效尝试或忽略结果的请求和已有进度"}],"provides":[{"key":"owned_return_native_retry_frame","type":"era.tavern.frame.native_stop_retry.returned","display_name":"返回延后停止的有效尝试或忽略结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_return_native_retry_frame"}},"input_semantics":{"era.tavern.frame.native_stop_retry.result":["保留“返回延后停止的有效尝试或忽略结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_return_native_retry_frame":["保留“返回延后停止的有效尝试或忽略结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.return_native_retry",
  "node_type": "vibeflow.node"
});
