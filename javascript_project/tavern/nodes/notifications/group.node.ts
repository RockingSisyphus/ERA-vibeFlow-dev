import {defineNode} from "@vibeflow/plugin";

export const era_tavern_notification_choose_batch_complete = defineNode({
  "display_name": "判断整组通知是否都已结束",
  "description": "检查本通知组仍有多少项没有完成。尚有未完成项时保留组状态，全部齐全时安排最终报告和释放，使整组确认只在真实完成后发出。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.notification.collected","cardinality":"exactly_one","display_name":"判断整组通知是否都已结束的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_choose_batch_complete_frame","type":"era.tavern.frame.notification.collected","display_name":"判断整组通知是否都已结束的处理进度及结果"},{"key":"era_tavern_notification_choose_batch_complete_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_choose_batch_complete_frame","route":"era_tavern_notification_choose_batch_complete_route"}},"input_semantics":{"era.tavern.frame.notification.collected":["保留“判断整组通知是否都已结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_choose_batch_complete_frame":["保留“判断整组通知是否都已结束”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_notification_choose_batch_complete_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"ChooseComplete"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.choose_batch_complete",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_choose_notification = defineNode({
  "display_name": "区分普通通知和生成阶段完成通知",
  "description": "查看本次通知种类，普通事件走通知完成等待，生成阶段完成走订阅与下一阶段交接等待。各自结果随后归入同一通知组。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.notification.read_notification","cardinality":"exactly_one","display_name":"区分普通通知和生成阶段完成通知的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_choose_notification_frame","type":"era.tavern.frame.notification.choose_notification","display_name":"区分普通通知和生成阶段完成通知的处理进度及结果"},{"key":"era_tavern_notification_choose_notification_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_choose_notification_frame","route":"era_tavern_notification_choose_notification_route"}},"input_semantics":{"era.tavern.frame.notification.read_notification":["保留“区分普通通知和生成阶段完成通知”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_choose_notification_frame":["保留“区分普通通知和生成阶段完成通知”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_notification_choose_notification_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"ChooseNotification"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.choose_notification",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_emit_notification = defineNode({
  "display_name": "交接已经取得的通知完成结果",
  "description": "接收普通通知或阶段交接已经形成的完成资料，原样传给结果登记步骤。实际通知已经在发起流程执行，此处不会再次发出相同通知。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.notification.choose_notification","cardinality":"exactly_one","display_name":"交接已经取得的通知完成结果的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_emit_notification_frame","type":"era.tavern.frame.notification.emit_notification","display_name":"交接已经取得的通知完成结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_emit_notification_frame"}},"input_semantics":{"era.tavern.frame.notification.choose_notification":["保留“交接已经取得的通知完成结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_emit_notification_frame":["保留“交接已经取得的通知完成结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"EmitNotification"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.emit_notification",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_read_notification = defineNode({
  "display_name": "接收本次已经发起的通知资料",
  "description": "取出当前通知、所属通知组及取消来源，交给通知类型判断。此处使用已经登记的通知，后续读取其完成结果并记录到正确位置。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"接收本次已经发起的通知资料的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_read_notification_frame","type":"era.tavern.frame.notification.read_notification","display_name":"接收本次已经发起的通知资料的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_read_notification_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“接收本次已经发起的通知资料”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_read_notification_frame":["保留“接收本次已经发起的通知资料”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"ReadNotification"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.read_notification",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_record_result = defineNode({
  "display_name": "记下本条通知的结果和整组剩余数量",
  "description": "将当前回调的成功或失败写到通知原来的位置，并减少整组尚未完成数量。后续据此判断整组是否齐全，同时保留原顺序供统一报告。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.notification.emit_notification","cardinality":"exactly_one","display_name":"记下本条通知的结果和整组剩余数量的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_record_result_frame","type":"era.tavern.frame.notification.collected","display_name":"记下本条通知的结果和整组剩余数量的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_record_result_frame"}},"input_semantics":{"era.tavern.frame.notification.emit_notification":["保留“记下本条通知的结果和整组剩余数量”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_record_result_frame":["保留“记下本条通知的结果和整组剩余数量”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"RecordResult"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.record_result",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_schedule_group_finish = defineNode({
  "display_name": "把已齐全的通知组交给最终收尾",
  "description": "整组通知完成后，将它加入通知收尾队列并唤醒处理分支。后续按原顺序报告失败并释放整组等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.notification.collected","cardinality":"exactly_one","display_name":"把已齐全的通知组交给最终收尾的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_schedule_group_finish_frame","type":"era.tavern.frame.notification.branch","display_name":"把已齐全的通知组交给最终收尾的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_schedule_group_finish_frame"}},"input_semantics":{"era.tavern.frame.notification.collected":["保留“把已齐全的通知组交给最终收尾”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_schedule_group_finish_frame":["保留“把已齐全的通知组交给最终收尾”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"ScheduleFinish"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.schedule_group_finish",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_select_event = defineNode({
  "display_name": "等待普通通知的监听处理结束",
  "description": "接收已经发起的普通页面通知，等待监听处理完成，并记录成功或失败。结果交给通知组汇总，较慢通知不会阻止其他通知记录自己的完成情况。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.notification.choose_notification","cardinality":"exactly_one","display_name":"等待普通通知的监听处理结束的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_select_event_frame","type":"era.tavern.frame.notification.choose_notification","display_name":"等待普通通知的监听处理结束的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_select_event_frame"}},"input_semantics":{"era.tavern.frame.notification.choose_notification":["保留“等待普通通知的监听处理结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_select_event_frame":["保留“等待普通通知的监听处理结束”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"SelectEvent"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.select_event",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_select_handoff_prepare = defineNode({
  "display_name": "等待生成阶段通知及交接结束",
  "description": "接收已发起的生成阶段通知，等待订阅处理和阶段交接结果。将实际成功或失败记录到本次通知，供整组统一报告和释放。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.notification.choose_notification","cardinality":"exactly_one","display_name":"等待生成阶段通知及交接结束的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_select_handoff_prepare_frame","type":"era.tavern.call.frame","display_name":"等待生成阶段通知及交接结束的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_select_handoff_prepare_frame"}},"input_semantics":{"era.tavern.frame.notification.choose_notification":["保留“等待生成阶段通知及交接结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_select_handoff_prepare_frame":["保留“等待生成阶段通知及交接结束”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"SelectHandoff"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification.select_handoff_prepare",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_finalize_read_group = defineNode({
  "display_name": "准备按原顺序检查通知组结果",
  "description": "接收已经全部结束的通知组，把报告位置设为第一项。后续逐条查看已固定结果，确保失败说明与原通知顺序一致。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"准备按原顺序检查通知组结果的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_finalize_read_group_frame","type":"era.tavern.frame.notification_finalize.read","display_name":"准备按原顺序检查通知组结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_finalize_read_group_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“准备按原顺序检查通知组结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_finalize_read_group_frame":["保留“准备按原顺序检查通知组结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"ReadGroup"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification_finalize.read_group",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_finalize_release_group = defineNode({
  "display_name": "释放通知组并完成整组等待",
  "description": "通知组结果已经全部报告后，清除取消关联和运行登记，完成等待这组通知的调用。返回整组已释放确认，实例收尾也能据此知道没有遗留通知等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.notification_finalize.read","cardinality":"exactly_one","display_name":"释放通知组并完成整组等待的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_finalize_release_group_frame","type":"era.tavern.task.finished","display_name":"当前职责已真实完成或退出的确认"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_finalize_release_group_frame"}},"input_semantics":{"era.tavern.frame.notification_finalize.read":["保留“释放通知组并完成整组等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_finalize_release_group_frame":["记录当前职责一次工作或整个分支已经实际结束，供循环继续或汇合确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"ReleaseGroup"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification_finalize.release_group",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_report_item_choose_item = defineNode({
  "display_name": "选择下一条已完成通知的结果",
  "description": "查看通知组报告进度，尚有结果时继续逐项报告，到达末尾时结束。报告过程只读取已经完成的结论，不重新发送通知。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.notification_finalize.read","cardinality":"exactly_one","display_name":"选择下一条已完成通知的结果的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_report_item_choose_item_frame","type":"era.tavern.frame.notification_finalize.read","display_name":"选择下一条已完成通知的结果的处理进度及结果"},{"key":"era_tavern_notification_report_item_choose_item_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_report_item_choose_item_frame","route":"era_tavern_notification_report_item_choose_item_route"}},"input_semantics":{"era.tavern.frame.notification_finalize.read":["保留“选择下一条已完成通知的结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_report_item_choose_item_frame":["保留“选择下一条已完成通知的结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_notification_report_item_choose_item_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"ChooseReport"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification_report_item.choose_item",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_report_item_empty = defineNode({
  "display_name": "确认通知组结果已全部检查",
  "description": "通知组所有结果已经按序查看时，标记报告循环结束。后续释放该组资源并完成等待。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.notification_finalize.read","cardinality":"exactly_one","display_name":"确认通知组结果已全部检查的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_report_item_empty_frame","type":"era.tavern.frame.notification_report_item.result","display_name":"确认通知组结果已全部检查的处理进度及结果"},{"key":"era_tavern_notification_report_item_empty_done","type":"era.tavern.done.notification_report","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_report_item_empty_frame","done":"era_tavern_notification_report_item_empty_done"}},"input_semantics":{"era.tavern.frame.notification_finalize.read":["保留“确认通知组结果已全部检查”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_report_item_empty_frame":["保留“确认通知组结果已全部检查”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_notification_report_item_empty_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"EmptyReport"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification_report_item.empty",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_report_item_report_one = defineNode({
  "display_name": "报告一条通知的实际失败并继续",
  "description": "按原通知顺序查看一项完成结果，失败时写出对应告警，成功则继续。说明通知问题不会改写已经完成的状态结算，随后推进报告位置。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.notification_finalize.read","cardinality":"exactly_one","display_name":"报告一条通知的实际失败并继续的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_report_item_report_one_frame","type":"era.tavern.frame.notification_report_item.result","display_name":"报告一条通知的实际失败并继续的处理进度及结果"},{"key":"era_tavern_notification_report_item_report_one_done","type":"era.tavern.done.notification_report","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_report_item_report_one_frame","done":"era_tavern_notification_report_item_report_one_done"}},"input_semantics":{"era.tavern.frame.notification_finalize.read":["保留“报告一条通知的实际失败并继续”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_report_item_report_one_frame":["保留“报告一条通知的实际失败并继续”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_notification_report_item_report_one_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/group.ts","export":"ReportOne"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification_report_item.report_one",
  "node_type": "vibeflow.node"
});
