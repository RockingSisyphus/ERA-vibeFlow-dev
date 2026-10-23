import {defineNode} from "@vibeflow/plugin";

export const era_tavern_frame_send_activate_notification_batch = defineNode({
  "display_name": "登记已发起通知组供后台收尾",
  "description": "将本批通知组登记到当前实例，记录需要等待整组完成的状态。后续通知分支处理完成事实和统一释放，使主服务可以继续接收事件。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.notification_batch.begin","cardinality":"exactly_one","display_name":"登记已发起通知组供后台收尾的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_activate_notification_batch_frame","type":"era.tavern.frame.frame_send.final_result","display_name":"登记已发起通知组供后台收尾的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_activate_notification_batch_frame"}},"input_semantics":{"era.tavern.frame.notification_batch.begin":["保留“登记已发起通知组供后台收尾”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_activate_notification_batch_frame":["保留“登记已发起通知组供后台收尾”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/frame_send.ts","export":"ActivateNotifications"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.activate_notification_batch",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_send_apply_frame = defineNode({
  "display_name": "确认本次服务输出处理已完成",
  "description": "接收已走完计时控制、批次结算或重复确认分支的资料，整理为空返回结果。后续登记这份输出已处理，避免把分支处理误当作再次执行请求。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.frame_send.choose_frame","cardinality":"exactly_one","display_name":"确认本次服务输出处理已完成的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_apply_frame_frame","type":"era.tavern.frame.frame_send.apply_frame","display_name":"确认本次服务输出处理已完成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_apply_frame_frame"}},"input_semantics":{"era.tavern.frame.frame_send.choose_frame":["保留“确认本次服务输出处理已完成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_apply_frame_frame":["保留“确认本次服务输出处理已完成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/frame_send.ts","export":"ApplyFrame"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.apply_frame",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_send_branch_batch_prepare = defineNode({
  "display_name": "核对整批事件确认并整理通知参数",
  "description": "检查主服务给出的事件确认是否恰好覆盖指定范围，没有重复、遗漏或对应冲突。还原页面通知所需参数，并按序整理确认清单，供逐项回告发起者。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.frame_send.choose_frame","cardinality":"exactly_one","display_name":"核对整批事件确认并整理通知参数的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_branch_batch_prepare_frame","type":"era.tavern.call.frame","display_name":"核对整批事件确认并整理通知参数的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_branch_batch_prepare_frame"}},"input_semantics":{"era.tavern.frame.frame_send.choose_frame":["保留“核对整批事件确认并整理通知参数”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_branch_batch_prepare_frame":["保留“核对整批事件确认并整理通知参数”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/frame_send.ts","export":"PrepareBatch"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.branch_batch_prepare",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_send_check_frame = defineNode({
  "display_name": "检查主服务返回消息并识别重复",
  "description": "接收主服务送回页面的结果，检查通道和消息身份，并与已处理记录比较。同一身份但内容不同会报告冲突，已处理的相同内容标为重复，供后续避免再次确认或通知。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"检查主服务返回消息并识别重复的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_check_frame_frame","type":"era.tavern.frame.frame_send.check_frame","display_name":"检查主服务返回消息并识别重复的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_check_frame_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“检查主服务返回消息并识别重复”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_check_frame_frame":["保留“检查主服务返回消息并识别重复”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/frame_send.ts","export":"CheckFrame"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.check_frame",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_send_choose_frame = defineNode({
  "display_name": "选择批次结算、计时控制或重复确认",
  "description": "查看主服务返回消息的类型，区分任务批次结果、事件收集的计时安排，以及已处理过的重复消息。让后续只执行本次实际需要的对应处理。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.frame_send.check_frame","cardinality":"exactly_one","display_name":"选择批次结算、计时控制或重复确认的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_choose_frame_frame","type":"era.tavern.frame.frame_send.choose_frame","display_name":"选择批次结算、计时控制或重复确认的处理进度及结果"},{"key":"era_tavern_frame_send_choose_frame_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_choose_frame_frame","route":"era_tavern_frame_send_choose_frame_route"}},"input_semantics":{"era.tavern.frame.frame_send.check_frame":["保留“选择批次结算、计时控制或重复确认”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_choose_frame_frame":["保留“选择批次结算、计时控制或重复确认”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_frame_send_choose_frame_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/frame_send.ts","export":"ChooseFrame"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.choose_frame",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_send_prepare_notification_batch = defineNode({
  "display_name": "为本批后续通知建立进度记录",
  "description": "接收有效批次结果，整理需要发送的通知列表、各项完成位置及取消来源。重复消息或实例正在停止时不再建立通知组，后续按顺序发起有效通知。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.final.frame_send","cardinality":"exactly_one","display_name":"为本批后续通知建立进度记录的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_prepare_notification_batch_frame","type":"era.tavern.frame.notification_batch.begin","display_name":"为本批后续通知建立进度记录的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_prepare_notification_batch_frame"}},"input_semantics":{"era.tavern.frame.final.frame_send":["保留“为本批后续通知建立进度记录”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_prepare_notification_batch_frame":["保留“为本批后续通知建立进度记录”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/frame_send.ts","export":"PrepareNotifications"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.prepare_notification_batch",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_send_remember_frame = defineNode({
  "display_name": "记住这份服务输出已经处理",
  "description": "在当前实例中登记本次服务输出的身份和内容。后续相同输出可以识别为重复，防止重复返回事件结果或发出通知。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.frame_send.apply_frame","cardinality":"exactly_one","display_name":"记住这份服务输出已经处理的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_send_remember_frame_frame","type":"era.tavern.frame.final.frame_send","display_name":"记住这份服务输出已经处理的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_send_remember_frame_frame"}},"input_semantics":{"era.tavern.frame.frame_send.apply_frame":["保留“记住这份服务输出已经处理”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_send_remember_frame_frame":["保留“记住这份服务输出已经处理”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/frame_send.ts","export":"RememberFrame"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_send.remember_frame",
  "node_type": "vibeflow.node"
});
