import {defineNode} from "@vibeflow/plugin";

export const era_tavern_timer_fired_check_timer = defineNode({
  "display_name": "核对这次到期是否仍对应有效安排",
  "description": "读取到期记录及其种类，比较当前登记的计时身份，或检查等待告警仍存在。后续据此忽略被替换的旧到期，或处理当前有效期限。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"核对这次到期是否仍对应有效安排的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_fired_check_timer_frame","type":"era.tavern.frame.timer_fired.check_timer","display_name":"核对这次到期是否仍对应有效安排的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_fired_check_timer_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“核对这次到期是否仍对应有效安排”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_fired_check_timer_frame":["保留“核对这次到期是否仍对应有效安排”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/fired.ts","export":"CheckTimer"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_fired.check_timer",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_fired_choose_timer_kind = defineNode({
  "display_name": "区分业务到期、等待告警和旧计时",
  "description": "根据计时有效性与种类选择分支：有效业务期限准备事件，等待告警报告现状，失效记录直接忽略。避免旧安排影响当前任务。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_fired.check_timer","cardinality":"exactly_one","display_name":"区分业务到期、等待告警和旧计时的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_fired_choose_timer_kind_frame","type":"era.tavern.frame.timer_fired.check_timer","display_name":"区分业务到期、等待告警和旧计时的处理进度及结果"},{"key":"era_tavern_timer_fired_choose_timer_kind_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_fired_choose_timer_kind_frame","route":"era_tavern_timer_fired_choose_timer_kind_route"}},"input_semantics":{"era.tavern.frame.timer_fired.check_timer":["保留“区分业务到期、等待告警和旧计时”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_fired_choose_timer_kind_frame":["保留“区分业务到期、等待告警和旧计时”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_timer_fired_choose_timer_kind_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/fired.ts","export":"ChooseKind"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_fired.choose_timer_kind",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_fired_prepare_event = defineNode({
  "display_name": "将有效到期转换为主服务事件",
  "description": "移除已到期计时的登记，把收集截止或已约定的延迟事件整理成统一事件输入。交给正常接收队列，让主服务按序决定接下来处理什么。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_fired.check_timer","cardinality":"exactly_one","display_name":"将有效到期转换为主服务事件的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_fired_prepare_event_frame","type":"era.tavern.frame.timer_fired.prepare_event","display_name":"将有效到期转换为主服务事件的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_fired_prepare_event_frame"}},"input_semantics":{"era.tavern.frame.timer_fired.check_timer":["保留“将有效到期转换为主服务事件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_fired_prepare_event_frame":["保留“将有效到期转换为主服务事件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/fired.ts","export":"PrepareEvent"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_fired.prepare_event",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_fired_return_event = defineNode({
  "display_name": "返回到期事件的接收结论",
  "description": "接收统一事件入口的实际结果，未被接收时报告对应计时或延迟事件的原因。后续不会将被拒绝的到期事件误当作已经处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"返回到期事件的接收结论的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_fired_return_event_frame","type":"era.tavern.frame.timer_fired.outcome","display_name":"返回到期事件的接收结论的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_fired_return_event_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“返回到期事件的接收结论”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_fired_return_event_frame":["保留“返回到期事件的接收结论”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/fired.ts","export":"ReturnEvent"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_fired.return_event",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_fired_warn_watchdog = defineNode({
  "display_name": "报告仍未完成的生成前等待",
  "description": "告警到期时，列出指定范围内仍未确认的事件和已等待时间，并清除这次告警记录。告警只说明等待现状，生成仍遵守真实事件完成条件。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_fired.check_timer","cardinality":"exactly_one","display_name":"报告仍未完成的生成前等待的请求和已有进度"}],"provides":[{"key":"era_tavern_timer_fired_warn_watchdog_frame","type":"era.tavern.frame.timer_fired.outcome","display_name":"报告仍未完成的生成前等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_timer_fired_warn_watchdog_frame"}},"input_semantics":{"era.tavern.frame.timer_fired.check_timer":["保留“报告仍未完成的生成前等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_timer_fired_warn_watchdog_frame":["保留“报告仍未完成的生成前等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/fired.ts","export":"WarnWatchdog"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_fired.warn_watchdog",
  "node_type": "vibeflow.node"
});
