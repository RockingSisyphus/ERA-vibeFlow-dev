import {defineNode} from "@vibeflow/plugin";

export const era_tavern_stop_cancel_receipts = defineNode({
  "display_name": "确认停止时的未完成事件已逐项取消",
  "description": "接收取消循环结束状态，交给剩余实例清理。发起者的等待已按停止原因结束，随后再关闭相关页面提示。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.stop.clear_timers","cardinality":"exactly_one","display_name":"确认停止时的未完成事件已逐项取消的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_cancel_receipts_frame","type":"era.tavern.frame.stop.cancel_receipts","display_name":"确认停止时的未完成事件已逐项取消的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_cancel_receipts_frame"}},"input_semantics":{"era.tavern.frame.stop.clear_timers":["保留“确认停止时的未完成事件已逐项取消”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_cancel_receipts_frame":["保留“确认停止时的未完成事件已逐项取消”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.stop.cancel_receipts",
  "node_type": "vibeflow.node"
});
