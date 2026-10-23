import {defineNode} from "@vibeflow/plugin";

export const era_tavern_stop_cancel_receipts_item_join_end = defineNode({
  "display_name": "交接向一项未完成事件返回取消的选中结果",
  "description": "在“向一项未完成事件返回取消”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.stop.clear_timers","cardinality":"all","display_name":"交接向一项未完成事件返回取消的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_cancel_receipts_item_join_end_frame","type":"era.tavern.item.result.stop_cancel_receipts_item","display_name":"交接向一项未完成事件返回取消的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_cancel_receipts_item_join_end_frame"}},"input_semantics":{"era.tavern.frame.stop.clear_timers":["保留“交接向一项未完成事件返回取消的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_cancel_receipts_item_join_end_frame":["保留“交接向一项未完成事件返回取消的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.stop_cancel_receipts_item.join_end",
  "node_type": "vibeflow.node"
});
