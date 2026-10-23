import {defineNode} from "@vibeflow/plugin";

export const era_tavern_timer_control_branch_keep = defineNode({
  "display_name": "沿用相同期限的已有计时",
  "description": "当前事件收集计时已经对应本次要求的同一期限时，保留现有安排并交给确认出口。避免同一到期重复登记。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_control.choose_timer","cardinality":"exactly_one","display_name":"沿用相同期限的已有计时的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_control_branch_keep_frame","type":"era.tavern.frame.timer_control.choose_timer","display_name":"沿用相同期限的已有计时的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_control_branch_keep_frame"}},"input_semantics":{"era.tavern.frame.timer_control.choose_timer":["保留“沿用相同期限的已有计时”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_control_branch_keep_frame":["保留“沿用相同期限的已有计时”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_control.branch_keep",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_control_join_return_timer = defineNode({
  "display_name": "交接按明确要求安排、取消或沿用计时的选中结果",
  "description": "在“按明确要求安排、取消或沿用计时”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_control.choose_timer","cardinality":"all","display_name":"交接按明确要求安排、取消或沿用计时的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_control_join_return_timer_frame","type":"era.tavern.frame.timer_control.choose_timer","display_name":"交接按明确要求安排、取消或沿用计时的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_control_join_return_timer_frame"}},"input_semantics":{"era.tavern.frame.timer_control.choose_timer":["保留“交接按明确要求安排、取消或沿用计时的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_control_join_return_timer_frame":["保留“交接按明确要求安排、取消或沿用计时的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_control.join_return_timer",
  "node_type": "vibeflow.node"
});
