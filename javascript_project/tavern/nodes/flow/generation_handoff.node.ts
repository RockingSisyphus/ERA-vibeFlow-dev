import {defineNode} from "@vibeflow/plugin";

export const era_tavern_generation_handoff_join_await_followup = defineNode({
  "display_name": "交接在阶段订阅结束后接续整次生成的选中结果",
  "description": "在“在阶段订阅结束后接续整次生成”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.choose_followup","cardinality":"all","display_name":"交接在阶段订阅结束后接续整次生成的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_join_await_followup_frame","type":"era.tavern.frame.generation_handoff.choose_followup","display_name":"交接在阶段订阅结束后接续整次生成的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_join_await_followup_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.choose_followup":["保留“交接在阶段订阅结束后接续整次生成的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_join_await_followup_frame":["保留“交接在阶段订阅结束后接续整次生成的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.join_await_followup",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_join_finish = defineNode({
  "display_name": "交接在阶段订阅结束后接续整次生成的选中结果",
  "description": "在“在阶段订阅结束后接续整次生成”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.await_followup","cardinality":"all","display_name":"交接在阶段订阅结束后接续整次生成的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_join_finish_frame","type":"era.tavern.frame.generation_handoff.await_followup","display_name":"交接在阶段订阅结束后接续整次生成的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_join_finish_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.await_followup":["保留“交接在阶段订阅结束后接续整次生成的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_join_finish_frame":["保留“交接在阶段订阅结束后接续整次生成的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.join_finish",
  "node_type": "vibeflow.node"
});
