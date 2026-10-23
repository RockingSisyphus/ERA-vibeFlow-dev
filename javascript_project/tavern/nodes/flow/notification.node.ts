import {defineNode} from "@vibeflow/plugin";

export const era_tavern_notification_join_batch_result = defineNode({
  "display_name": "结束本条通知完成情况的处理",
  "description": "本条通知结果已经登记，并已保留未完成组或安排完整组收尾后，返回本轮处理结束。通知职责分支可以接着读取下一条完成记录。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.notification.branch","cardinality":"all","display_name":"结束本条通知完成情况的处理的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_join_batch_result_frame","type":"era.tavern.task.finished","display_name":"当前职责已真实完成或退出的确认"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_join_batch_result_frame"}},"input_semantics":{"era.tavern.frame.notification.branch":["保留“结束本条通知完成情况的处理”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_join_batch_result_frame":["记录当前职责一次工作或整个分支已经实际结束，供循环继续或汇合确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Finished"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.join_batch_result",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_join_emit_notification = defineNode({
  "display_name": "交接收集一条已发起通知的完成结果的选中结果",
  "description": "在“收集一条已发起通知的完成结果”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.notification.choose_notification","cardinality":"all","display_name":"交接收集一条已发起通知的完成结果的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_join_emit_notification_frame","type":"era.tavern.frame.notification.choose_notification","display_name":"交接收集一条已发起通知的完成结果的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_join_emit_notification_frame"}},"input_semantics":{"era.tavern.frame.notification.choose_notification":["保留“交接收集一条已发起通知的完成结果的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_join_emit_notification_frame":["保留“交接收集一条已发起通知的完成结果的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.join_emit_notification",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_keep_group = defineNode({
  "display_name": "保留尚有未完成项的通知组",
  "description": "本条通知结果已经记下，但同组其他回调尚未全部结束时，保留通知组等待。整组齐全后才统一报告失败和释放。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.notification.collected","cardinality":"exactly_one","display_name":"保留尚有未完成项的通知组的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_keep_group_frame","type":"era.tavern.frame.notification.branch","display_name":"保留尚有未完成项的通知组的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_keep_group_frame"}},"input_semantics":{"era.tavern.frame.notification.collected":["保留“保留尚有未完成项的通知组”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_keep_group_frame":["保留“保留尚有未完成项的通知组”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.keep_group",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_select_handoff = defineNode({
  "display_name": "交接阶段通知实际完成的结果",
  "description": "接收生成阶段订阅及后续交接流程的实际结论，传给通知结果登记。整组通知会据此记录成功或失败，阶段业务不在这里再执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"交接阶段通知实际完成的结果的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_select_handoff_frame","type":"era.tavern.frame.notification.choose_notification","display_name":"交接阶段通知实际完成的结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_select_handoff_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“交接阶段通知实际完成的结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_select_handoff_frame":["保留“交接阶段通知实际完成的结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.select_handoff",
  "node_type": "vibeflow.node"
});
