import {defineNode} from "@vibeflow/plugin";

export const era_tavern_settlement_settle_receipts = defineNode({
  "display_name": "确认本批原事件都已逐项回告",
  "description": "接收事件结算循环结束的资料，继续进入严重故障固定、诊断和通知整理。此时原事件已经得到处理确认，后续不会再次结算同一项。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.settlement.mark_fatal_transition","cardinality":"exactly_one","display_name":"确认本批原事件都已逐项回告的请求和已有进度"}],"provides":[{"key":"era_tavern_settlement_settle_receipts_frame","type":"era.tavern.frame.settlement.settle_receipts","display_name":"确认本批原事件都已逐项回告的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_settlement_settle_receipts_frame"}},"input_semantics":{"era.tavern.frame.settlement.mark_fatal_transition":["保留“确认本批原事件都已逐项回告”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_settlement_settle_receipts_frame":["保留“确认本批原事件都已逐项回告”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.settlement.settle_receipts",
  "node_type": "vibeflow.node"
});
