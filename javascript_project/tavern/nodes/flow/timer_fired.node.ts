import {defineNode} from "@vibeflow/plugin";

export const era_tavern_timer_fired_ignore_stale = defineNode({
  "display_name": "忽略已取消或被替换的旧到期",
  "description": "当前到期记录已不对应有效计时安排时，原样结束本次处理。不会因此把旧事件送入队列，也不影响新的有效计时。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_fired.check_timer","cardinality":"exactly_one","display_name":"忽略已取消或被替换的旧到期的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_fired_ignore_stale_frame","type":"era.tavern.frame.timer_fired.outcome","display_name":"忽略已取消或被替换的旧到期的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_fired_ignore_stale_frame"}},"input_semantics":{"era.tavern.frame.timer_fired.check_timer":["保留“忽略已取消或被替换的旧到期”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_fired_ignore_stale_frame":["保留“忽略已取消或被替换的旧到期”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_fired.ignore_stale",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_fired_join_result = defineNode({
  "display_name": "交接处理有效到期或报告等待过久的选中结果",
  "description": "在“处理有效到期或报告等待过久”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_fired.outcome","cardinality":"all","display_name":"交接处理有效到期或报告等待过久的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_fired_join_result_frame","type":"era.tavern.frame.timer_fired.final","display_name":"交接处理有效到期或报告等待过久的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_fired_join_result_frame"}},"input_semantics":{"era.tavern.frame.timer_fired.outcome":["保留“交接处理有效到期或报告等待过久的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_fired_join_result_frame":["保留“交接处理有效到期或报告等待过久的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_fired.join_result",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_fired_return_event_prepare = defineNode({
  "display_name": "把有效到期事件交给统一事件入口",
  "description": "接收已经整理好的收集截止或延迟事件，继续交给与普通事件相同的接收流程。事件序号、容量和处理确认规则保持一致，后续回告接收结果。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_fired.prepare_event","cardinality":"exactly_one","display_name":"把有效到期事件交给统一事件入口的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_fired_return_event_prepare_frame","type":"era.tavern.call.frame","display_name":"把有效到期事件交给统一事件入口的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_fired_return_event_prepare_frame"}},"input_semantics":{"era.tavern.frame.timer_fired.prepare_event":["保留“把有效到期事件交给统一事件入口”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_fired_return_event_prepare_frame":["保留“把有效到期事件交给统一事件入口”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_fired.return_event_prepare",
  "node_type": "vibeflow.node"
});
