import {defineNode} from "@vibeflow/plugin";

export const era_tavern_barrier_wait_register_watchdog = defineNode({
  "display_name": "为仍未完成的生成前等待登记告警",
  "description": "生成前还有事件未确认且配置允许提醒时，登记一次等待告警期限。到期仅报告仍在等待哪些事件，不会自动放行生成或替代处理确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.barrier_wait.snapshot_receipts","cardinality":"exactly_one","display_name":"为仍未完成的生成前等待登记告警的请求和已有进度"}],"provides":[{"key":"era_tavern_barrier_wait_register_watchdog_frame","type":"era.tavern.frame.barrier_wait.register_watchdog","display_name":"为仍未完成的生成前等待登记告警的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_barrier_wait_register_watchdog_frame"}},"input_semantics":{"era.tavern.frame.barrier_wait.snapshot_receipts":["保留“为仍未完成的生成前等待登记告警”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_barrier_wait_register_watchdog_frame":["保留“为仍未完成的生成前等待登记告警”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"RegisterWatchdog"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.barrier_wait.register_watchdog",
  "node_type": "vibeflow.node"
});

export const era_tavern_collection_control_prepare_commands = defineNode({
  "display_name": "按原顺序读取主服务的计时清单",
  "description": "取出主服务本次送回的启动或取消计时要求，从第一项建立处理进度。后续每项共用同一计时控制流程执行，保持主服务指定顺序。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"按原顺序读取主服务的计时清单的请求和已有进度"}],"provides":[{"key":"era_tavern_collection_control_prepare_commands_frame","type":"era.tavern.frame.collection_control.prepare_commands","display_name":"按原顺序读取主服务的计时清单的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_collection_control_prepare_commands_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“按原顺序读取主服务的计时清单”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_collection_control_prepare_commands_frame":["保留“按原顺序读取主服务的计时清单”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"PrepareCommands"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.collection_control.prepare_commands",
  "node_type": "vibeflow.node"
});

export const era_tavern_collection_control_return_control = defineNode({
  "display_name": "返回整份计时控制已处理的确认",
  "description": "所有收集计时要求处理完后，交回本次控制完成的空确认。服务可以继续收集或执行批次，已登记时限随后按期触发。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.collection_control.apply_commands","cardinality":"exactly_one","display_name":"返回整份计时控制已处理的确认的请求和已有进度"}],"provides":[{"key":"era_tavern_collection_control_return_control_frame","type":"era.tavern.call.frame","display_name":"返回整份计时控制已处理的确认的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_collection_control_return_control_frame"}},"input_semantics":{"era.tavern.frame.collection_control.apply_commands":["保留“返回整份计时控制已处理的确认”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_collection_control_return_control_frame":["保留“返回整份计时控制已处理的确认”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"ReturnControl"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.collection_control.return_control",
  "node_type": "vibeflow.node"
});

export const era_tavern_collection_control_apply_commands_item_choose_item = defineNode({
  "display_name": "选择下一条计时要求或结束",
  "description": "查看本次计时清单是否还有未处理项目。还有时交给计时控制，没有时结束遍历，随后返回整份控制确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.collection_control.prepare_commands","cardinality":"exactly_one","display_name":"选择下一条计时要求或结束的请求和已有进度"}],"provides":[{"key":"era_tavern_collection_control_apply_commands_item_choose_item_frame","type":"era.tavern.frame.collection_control.prepare_commands","display_name":"选择下一条计时要求或结束的处理进度及结果"},{"key":"era_tavern_collection_control_apply_commands_item_choose_item_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_collection_control_apply_commands_item_choose_item_frame","route":"era_tavern_collection_control_apply_commands_item_choose_item_route"}},"input_semantics":{"era.tavern.frame.collection_control.prepare_commands":["保留“选择下一条计时要求或结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_collection_control_apply_commands_item_choose_item_frame":["保留“选择下一条计时要求或结束”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_collection_control_apply_commands_item_choose_item_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"ChooseCommand"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.collection_control_apply_commands_item.choose_item",
  "node_type": "vibeflow.node"
});

export const era_tavern_collection_control_apply_commands_item_empty = defineNode({
  "display_name": "确认计时控制清单已经处理完",
  "description": "没有剩余计时要求时，标记遍历结束。外层据此返回控制消息完成，后续到期处理由独立计时分支负责。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.collection_control.prepare_commands","cardinality":"exactly_one","display_name":"确认计时控制清单已经处理完的请求和已有进度"}],"provides":[{"key":"era_tavern_collection_control_apply_commands_item_empty_frame","type":"era.tavern.frame.collection_control.prepare_commands","display_name":"确认计时控制清单已经处理完的处理进度及结果"},{"key":"era_tavern_collection_control_apply_commands_item_empty_done","type":"era.tavern.done.collection_control.apply_commands","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_collection_control_apply_commands_item_empty_frame","done":"era_tavern_collection_control_apply_commands_item_empty_done"}},"input_semantics":{"era.tavern.frame.collection_control.prepare_commands":["保留“确认计时控制清单已经处理完”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_collection_control_apply_commands_item_empty_frame":["保留“确认计时控制清单已经处理完”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_collection_control_apply_commands_item_empty_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"EmptyCommands"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.collection_control_apply_commands_item.empty",
  "node_type": "vibeflow.node"
});

export const era_tavern_collection_control_apply_commands_item_one_item = defineNode({
  "display_name": "记录本条计时要求完成并继续",
  "description": "当前计时控制已经执行后，将进度移到下一条并继续循环。整份清单因此按主服务指定的顺序处理到结束。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"记录本条计时要求完成并继续的请求和已有进度"}],"provides":[{"key":"era_tavern_collection_control_apply_commands_item_one_item_frame","type":"era.tavern.frame.collection_control.prepare_commands","display_name":"记录本条计时要求完成并继续的处理进度及结果"},{"key":"era_tavern_collection_control_apply_commands_item_one_item_done","type":"era.tavern.done.collection_control.apply_commands","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_collection_control_apply_commands_item_one_item_frame","done":"era_tavern_collection_control_apply_commands_item_one_item_done"}},"input_semantics":{"era.tavern.call.frame":["保留“记录本条计时要求完成并继续”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_collection_control_apply_commands_item_one_item_frame":["保留“记录本条计时要求完成并继续”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_collection_control_apply_commands_item_one_item_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"AdvanceCommand"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.collection_control_apply_commands_item.one_item",
  "node_type": "vibeflow.node"
});

export const era_tavern_collection_control_apply_commands_item_one_item_prepare = defineNode({
  "display_name": "取出当前需要执行的计时要求",
  "description": "按当前进度取出主服务给定的一条启动或取消要求，交给统一计时控制。保持原先标识和期限，不重新决定业务收集窗口。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.collection_control.prepare_commands","cardinality":"exactly_one","display_name":"取出当前需要执行的计时要求的请求和已有进度"}],"provides":[{"key":"era_tavern_collection_control_apply_commands_item_one_item_prepare_frame","type":"era.tavern.call.frame","display_name":"取出当前需要执行的计时要求的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_collection_control_apply_commands_item_one_item_prepare_frame"}},"input_semantics":{"era.tavern.frame.collection_control.prepare_commands":["保留“取出当前需要执行的计时要求”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_collection_control_apply_commands_item_one_item_prepare_frame":["保留“取出当前需要执行的计时要求”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"PrepareCommand"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.collection_control_apply_commands_item.one_item_prepare",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_control_branch_cancel = defineNode({
  "display_name": "取消指定计时并通知等待者重选",
  "description": "取消原计时安排并从对应列表移除，更新安排版本、唤醒正在等待的计时分支。后续重新选最近期限，已取消项不会正常触发业务事件。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_control.choose_timer","cardinality":"exactly_one","display_name":"取消指定计时并通知等待者重选的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_control_branch_cancel_frame","type":"era.tavern.frame.timer_control.choose_timer","display_name":"取消指定计时并通知等待者重选的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_control_branch_cancel_frame"}},"input_semantics":{"era.tavern.frame.timer_control.choose_timer":["保留“取消指定计时并通知等待者重选”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_control_branch_cancel_frame":["保留“取消指定计时并通知等待者重选”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"CancelTimer"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_control.branch_cancel",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_control_branch_schedule = defineNode({
  "display_name": "登记新期限并替换旧安排",
  "description": "取消被替换的旧计时，按收集截止时间或延迟及最长等待窗口计算新期限，登记到本实例。唤醒计时分支，让它按最新最近期限等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_control.choose_timer","cardinality":"exactly_one","display_name":"登记新期限并替换旧安排的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_control_branch_schedule_frame","type":"era.tavern.frame.timer_control.choose_timer","display_name":"登记新期限并替换旧安排的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_control_branch_schedule_frame"}},"input_semantics":{"era.tavern.frame.timer_control.choose_timer":["保留“登记新期限并替换旧安排”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_control_branch_schedule_frame":["保留“登记新期限并替换旧安排”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"ScheduleTimer"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_control.branch_schedule",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_control_choose_timer = defineNode({
  "display_name": "选择取消、沿用或重新安排计时",
  "description": "检查本次要求及已存在的到期时间。取消要求进入撤销分支，相同收集期限沿用原计时，其余进入新安排，避免同一时限重复登记。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_control.read_timer","cardinality":"exactly_one","display_name":"选择取消、沿用或重新安排计时的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_control_choose_timer_frame","type":"era.tavern.frame.timer_control.choose_timer","display_name":"选择取消、沿用或重新安排计时的处理进度及结果"},{"key":"era_tavern_timer_control_choose_timer_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_control_choose_timer_frame","route":"era_tavern_timer_control_choose_timer_route"}},"input_semantics":{"era.tavern.frame.timer_control.read_timer":["保留“选择取消、沿用或重新安排计时”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_control_choose_timer_frame":["保留“选择取消、沿用或重新安排计时”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_timer_control_choose_timer_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"ChooseTimer"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_control.choose_timer",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_control_read_timer = defineNode({
  "display_name": "读取本次收集或延迟事件的计时要求",
  "description": "区分主服务指定的事件收集期限与页面提出的延迟事件，读取原有安排、标识和时限。延迟事件检查有效输入并记住首次安排时间，供后续确定取消、保留或替换。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"读取本次收集或延迟事件的计时要求的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_control_read_timer_frame","type":"era.tavern.frame.timer_control.read_timer","display_name":"读取本次收集或延迟事件的计时要求的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_control_read_timer_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“读取本次收集或延迟事件的计时要求”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_control_read_timer_frame":["保留“读取本次收集或延迟事件的计时要求”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"ReadTimer"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_control.read_timer",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_control_return_timer = defineNode({
  "display_name": "返回本次计时安排的确认",
  "description": "本次计时要求已执行后，按操作类型返回已安排、已取消或收集控制确认。调用方据此知道时间要求已登记，实际到期另由计时分支处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_control.choose_timer","cardinality":"exactly_one","display_name":"返回本次计时安排的确认的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_control_return_timer_frame","type":"era.tavern.call.frame","display_name":"返回本次计时安排的确认的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_control_return_timer_frame"}},"input_semantics":{"era.tavern.frame.timer_control.choose_timer":["保留“返回本次计时安排的确认”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_control_return_timer_frame":["保留“返回本次计时安排的确认”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/control.ts","export":"ReturnTimer"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_control.return_timer",
  "node_type": "vibeflow.node"
});
