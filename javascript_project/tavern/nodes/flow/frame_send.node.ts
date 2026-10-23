import {defineNode} from "@vibeflow/plugin";

export const era_tavern_frame_send_branch_batch = defineNode({
  "display_name": "交接本批事件结算后的资料",
  "description": "接收逐项回告和诊断处理完成的批次结果，继续送到本次服务输出的统一后续步骤。通知准备和去重登记据此沿同一批资料完成。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"交接本批事件结算后的资料的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_branch_batch_frame","type":"era.tavern.frame.frame_send.choose_frame","display_name":"交接本批事件结算后的资料的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_branch_batch_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“交接本批事件结算后的资料”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_branch_batch_frame":["保留“交接本批事件结算后的资料”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.branch_batch",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_send_branch_control = defineNode({
  "display_name": "交接计时清单处理后的确认",
  "description": "接收本次收集计时清单已经处理完的资料，继续进入服务输出的统一后续步骤。计时安排不在这里重新执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"交接计时清单处理后的确认的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_branch_control_frame","type":"era.tavern.frame.frame_send.choose_frame","display_name":"交接计时清单处理后的确认的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_branch_control_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“交接计时清单处理后的确认”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_branch_control_frame":["保留“交接计时清单处理后的确认”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.branch_control",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_send_branch_control_prepare = defineNode({
  "display_name": "交出主服务已经给定的计时安排",
  "description": "本次服务输出属于事件收集计时控制时，将其中明确给出的启动或取消清单交给计时处理。业务收集期限已经由主服务决定。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.frame_send.choose_frame","cardinality":"exactly_one","display_name":"交出主服务已经给定的计时安排的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_branch_control_prepare_frame","type":"era.tavern.call.frame","display_name":"交出主服务已经给定的计时安排的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_branch_control_prepare_frame"}},"input_semantics":{"era.tavern.frame.frame_send.choose_frame":["保留“交出主服务已经给定的计时安排”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_branch_control_prepare_frame":["保留“交出主服务已经给定的计时安排”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.branch_control_prepare",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_send_branch_duplicate = defineNode({
  "display_name": "确认重复输出而不再次执行",
  "description": "本次服务输出与已处理记录完全相同时，沿用原确认并继续返回。计时、原事件结算和后置通知不再执行第二次。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.frame_send.choose_frame","cardinality":"exactly_one","display_name":"确认重复输出而不再次执行的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_branch_duplicate_frame","type":"era.tavern.frame.frame_send.choose_frame","display_name":"确认重复输出而不再次执行的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_branch_duplicate_frame"}},"input_semantics":{"era.tavern.frame.frame_send.choose_frame":["保留“确认重复输出而不再次执行”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_branch_duplicate_frame":["保留“确认重复输出而不再次执行”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.branch_duplicate",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_send_join_apply_frame = defineNode({
  "display_name": "交接执行主服务回传的确认、计时和通知的选中结果",
  "description": "在“执行主服务回传的确认、计时和通知”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.frame_send.choose_frame","cardinality":"all","display_name":"交接执行主服务回传的确认、计时和通知的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_join_apply_frame_frame","type":"era.tavern.frame.frame_send.choose_frame","display_name":"交接执行主服务回传的确认、计时和通知的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_join_apply_frame_frame"}},"input_semantics":{"era.tavern.frame.frame_send.choose_frame":["保留“交接执行主服务回传的确认、计时和通知的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_join_apply_frame_frame":["保留“交接执行主服务回传的确认、计时和通知的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.join_apply_frame",
  "node_type": "vibeflow.node"
});
