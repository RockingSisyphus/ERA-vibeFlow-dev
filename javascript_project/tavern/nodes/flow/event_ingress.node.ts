import {defineNode} from "@vibeflow/plugin";

export const era_tavern_event_ingress_join_admission_input = defineNode({
  "display_name": "交接把酒馆事件整理成 ERA 输入的选中结果",
  "description": "在“把酒馆事件整理成 ERA 输入”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"all","display_name":"交接把酒馆事件整理成 ERA 输入的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_event_ingress_join_admission_input_frame","type":"era.tavern.call.frame","display_name":"交接把酒馆事件整理成 ERA 输入的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_event_ingress_join_admission_input_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“交接把酒馆事件整理成 ERA 输入的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_event_ingress_join_admission_input_frame":["保留“交接把酒馆事件整理成 ERA 输入的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.event_ingress.join_admission_input",
  "node_type": "vibeflow.node"
});

export const era_tavern_event_ingress_join_return_event = defineNode({
  "display_name": "交接把酒馆事件整理成 ERA 输入的选中结果",
  "description": "在“把酒馆事件整理成 ERA 输入”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.event_ingress.choose_event","cardinality":"all","display_name":"交接把酒馆事件整理成 ERA 输入的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_event_ingress_join_return_event_frame","type":"era.tavern.frame.event_ingress.choose_event","display_name":"交接把酒馆事件整理成 ERA 输入的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_event_ingress_join_return_event_frame"}},"input_semantics":{"era.tavern.frame.event_ingress.choose_event":["保留“交接把酒馆事件整理成 ERA 输入的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_event_ingress_join_return_event_frame":["保留“交接把酒馆事件整理成 ERA 输入的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.event_ingress.join_return_event",
  "node_type": "vibeflow.node"
});

export const era_tavern_event_ingress_return_admission_branch = defineNode({
  "display_name": "保留聊天事件实际接收的结论",
  "description": "接收统一事件入口的接收或拒绝结果，连同本事件是否需要生成前等待的安排，交给回调返回步骤。保持一次事件只接收一次。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"保留聊天事件实际接收的结论的请求和已有进度"}],"provides":[{"key":"era_tavern_event_ingress_return_admission_branch_frame","type":"era.tavern.frame.event_ingress.choose_event","display_name":"保留聊天事件实际接收的结论的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_event_ingress_return_admission_branch_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“保留聊天事件实际接收的结论”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_event_ingress_return_admission_branch_frame":["保留“保留聊天事件实际接收的结论”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.event_ingress.return_admission_branch",
  "node_type": "vibeflow.node"
});
