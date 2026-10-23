import {defineNode} from "@vibeflow/plugin";

export const era_tavern_subscription_control_choose = defineNode({
  "display_name": "选择登记、移除或取消阶段订阅",
  "description": "接收作者对生成阶段通知的管理请求，判断要新增订阅、停止指定订阅，还是取消当前阶段处理。后续在本实例范围内执行对应操作。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"选择登记、移除或取消阶段订阅的请求和已有进度"}],"provides":[{"key":"subscription_control_choose_frame","type":"era.tavern.frame.subscription_control.chosen","display_name":"选择登记、移除或取消阶段订阅的处理进度及结果"},{"key":"subscription_control_choose_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_control_choose_frame","route":"subscription_control_choose_route"}},"input_semantics":{"era.tavern.call.frame":["保留“选择登记、移除或取消阶段订阅”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_control_choose_frame":["保留“选择登记、移除或取消阶段订阅”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"subscription_control_choose_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"ChooseControl"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_control.choose",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_control_register = defineNode({
  "display_name": "登记作者希望监听的生成阶段",
  "description": "接收作者回调及可选的规划、正文、结算阶段范围，检查后登记到当前实例。返回可停止订阅的操作，使阶段完成时能找到匹配作者处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.subscription_control.chosen","cardinality":"exactly_one","display_name":"登记作者希望监听的生成阶段的请求和已有进度"}],"provides":[{"key":"subscription_control_register_frame","type":"era.tavern.frame.subscription_control.register","display_name":"登记作者希望监听的生成阶段的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_control_register_frame"}},"input_semantics":{"era.tavern.frame.subscription_control.chosen":["保留“登记作者希望监听的生成阶段”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_control_register_frame":["保留“登记作者希望监听的生成阶段”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"Register"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_control.register",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_control_stop = defineNode({
  "display_name": "移除指定阶段订阅并按需取消等待",
  "description": "确认订阅属于当前实例后移除它，结束订阅有效性；请求明确要求时也取消它参与的阶段等待。后续新阶段不再调用该订阅。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.subscription_control.chosen","cardinality":"exactly_one","display_name":"移除指定阶段订阅并按需取消等待的请求和已有进度"}],"provides":[{"key":"subscription_control_stop_frame","type":"era.tavern.frame.subscription_control.stop","display_name":"移除指定阶段订阅并按需取消等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_control_stop_frame"}},"input_semantics":{"era.tavern.frame.subscription_control.chosen":["保留“移除指定阶段订阅并按需取消等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_control_stop_frame":["保留“移除指定阶段订阅并按需取消等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"Stop"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_control.stop",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_control_cancel = defineNode({
  "display_name": "取消进行中的阶段回调周期",
  "description": "取消当前实例正在处理的阶段订阅周期；请求明确要求清空时，同时移除全部订阅。用于生成停止或实例释放，避免旧周期继续推动下一阶段。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.subscription_control.chosen","cardinality":"exactly_one","display_name":"取消进行中的阶段回调周期的请求和已有进度"}],"provides":[{"key":"subscription_control_cancel_frame","type":"era.tavern.frame.subscription_control.cancel","display_name":"取消进行中的阶段回调周期的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_control_cancel_frame"}},"input_semantics":{"era.tavern.frame.subscription_control.chosen":["保留“取消进行中的阶段回调周期”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_control_cancel_frame":["保留“取消进行中的阶段回调周期”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"Cancel"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_control.cancel",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_cycle_choose = defineNode({
  "display_name": "选择本阶段下一个有效作者订阅",
  "description": "根据本周期取消状态、订阅是否仍登记及关注阶段，选择执行、跳过或结束。只处理当前仍有效且匹配规划、正文或结算阶段的订阅。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"选择本阶段下一个有效作者订阅的请求和已有进度"}],"provides":[{"key":"subscription_cycle_choose_frame","type":"era.tavern.frame.subscription_cycle.chosen","display_name":"选择本阶段下一个有效作者订阅的处理进度及结果"},{"key":"subscription_cycle_choose_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_cycle_choose_frame","route":"subscription_cycle_choose_route"}},"input_semantics":{"era.tavern.call.frame":["保留“选择本阶段下一个有效作者订阅”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_cycle_choose_frame":["保留“选择本阶段下一个有效作者订阅”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"subscription_cycle_choose_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"ChooseItem"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_cycle.choose",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_cycle_skip = defineNode({
  "display_name": "略过已移除或不匹配阶段的订阅",
  "description": "当前订阅已停止或不关注本阶段时，推进到下一项。保留本次阶段结果，供其余有效作者回调继续处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.subscription_cycle.chosen","cardinality":"exactly_one","display_name":"略过已移除或不匹配阶段的订阅的请求和已有进度"}],"provides":[{"key":"subscription_cycle_skip_frame","type":"era.tavern.subscription_cycle.result","display_name":"略过已移除或不匹配阶段的订阅的处理进度及结果"},{"key":"subscription_cycle_skip_done","type":"era.tavern.subscription_cycle.done","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_cycle_skip_frame","done":"subscription_cycle_skip_done"}},"input_semantics":{"era.tavern.frame.subscription_cycle.chosen":["保留“略过已移除或不匹配阶段的订阅”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_cycle_skip_frame":["保留“略过已移除或不匹配阶段的订阅”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"subscription_cycle_skip_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"Skip"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_cycle.skip",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_cycle_empty = defineNode({
  "display_name": "确认本阶段订阅周期已经结束",
  "description": "当前周期取消或所有回调已检查时，标记遍历结束。后续清除周期登记，并返回是否允许继续生成。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.subscription_cycle.chosen","cardinality":"exactly_one","display_name":"确认本阶段订阅周期已经结束的请求和已有进度"}],"provides":[{"key":"subscription_cycle_empty_frame","type":"era.tavern.subscription_cycle.result","display_name":"确认本阶段订阅周期已经结束的处理进度及结果"},{"key":"subscription_cycle_empty_done","type":"era.tavern.subscription_cycle.done","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_cycle_empty_frame","done":"subscription_cycle_empty_done"}},"input_semantics":{"era.tavern.frame.subscription_cycle.chosen":["保留“确认本阶段订阅周期已经结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_cycle_empty_frame":["保留“确认本阶段订阅周期已经结束”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"subscription_cycle_empty_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"Empty"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_cycle.empty",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_cycle_invoke = defineNode({
  "display_name": "按顺序执行一个作者阶段回调",
  "description": "把只读阶段结果和取消状态交给当前作者订阅，并等待其实际返回。记录回调错误，下一作者只有在本项等待结束后才进入处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.subscription_cycle.chosen","cardinality":"exactly_one","display_name":"按顺序执行一个作者阶段回调的请求和已有进度"}],"provides":[{"key":"subscription_cycle_invoke_frame","type":"era.tavern.frame.subscription_cycle.invoke","display_name":"按顺序执行一个作者阶段回调的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_cycle_invoke_frame"}},"input_semantics":{"era.tavern.frame.subscription_cycle.chosen":["保留“按顺序执行一个作者阶段回调”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_cycle_invoke_frame":["保留“按顺序执行一个作者阶段回调”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"Invoke"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_cycle.invoke",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_cycle_classify = defineNode({
  "display_name": "判断回调失败是否需要报告",
  "description": "查看当前作者订阅的执行结论，正常结束或取消时直接推进，非取消错误进入报告。后续仍按原顺序处理其他订阅。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.subscription_cycle.invoke","cardinality":"exactly_one","display_name":"判断回调失败是否需要报告的请求和已有进度"}],"provides":[{"key":"subscription_cycle_classify_frame","type":"era.tavern.frame.subscription_cycle.classified","display_name":"判断回调失败是否需要报告的处理进度及结果"},{"key":"subscription_cycle_classify_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_cycle_classify_frame","route":"subscription_cycle_classify_route"}},"input_semantics":{"era.tavern.frame.subscription_cycle.invoke":["保留“判断回调失败是否需要报告”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_cycle_classify_frame":["保留“判断回调失败是否需要报告”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"subscription_cycle_classify_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"Classify"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_cycle.classify",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_cycle_report_error = defineNode({
  "display_name": "说明阶段回调失败并继续后续处理",
  "description": "将本次作者阶段回调的实际错误写入日志并显示提示，按现有规则继续后续生成处理。用户能看到回调问题，而原错误不会被伪装成回调成功。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.subscription_cycle.classified","cardinality":"exactly_one","display_name":"说明阶段回调失败并继续后续处理的请求和已有进度"}],"provides":[{"key":"subscription_cycle_report_error_frame","type":"era.tavern.frame.subscription_cycle.report_error","display_name":"说明阶段回调失败并继续后续处理的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_cycle_report_error_frame"}},"input_semantics":{"era.tavern.frame.subscription_cycle.classified":["保留“说明阶段回调失败并继续后续处理”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_cycle_report_error_frame":["保留“说明阶段回调失败并继续后续处理”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"ReportError"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_cycle.report_error",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_cycle_advance = defineNode({
  "display_name": "结束本项回调登记并转到下一订阅",
  "description": "移除当前订阅对本周期的等待关联，推进到下一回调位置。外层循环据此继续，保持作者订阅的先后顺序。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.subscription_cycle.classified","cardinality":"all","display_name":"结束本项回调登记并转到下一订阅的请求和已有进度"},{"type":"era.tavern.frame.subscription_cycle.report_error","cardinality":"all","display_name":"结束本项回调登记并转到下一订阅的请求和已有进度"}],"provides":[{"key":"subscription_cycle_advance_frame","type":"era.tavern.subscription_cycle.result","display_name":"结束本项回调登记并转到下一订阅的处理进度及结果"},{"key":"subscription_cycle_advance_done","type":"era.tavern.subscription_cycle.done","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_cycle_advance_frame","done":"subscription_cycle_advance_done"}},"input_semantics":{"era.tavern.frame.subscription_cycle.classified":["保留“结束本项回调登记并转到下一订阅”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"],"era.tavern.frame.subscription_cycle.report_error":["保留“结束本项回调登记并转到下一订阅”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_cycle_advance_frame":["保留“结束本项回调登记并转到下一订阅”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"subscription_cycle_advance_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"Advance"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_cycle.advance",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_publish_read_cycle = defineNode({
  "display_name": "准备本阶段只读结果和回调顺序",
  "description": "确认订阅周期属于当前实例，复制并冻结本阶段完成资料，从第一个已捕获回调开始。后续作者按序读到同一份阶段结果。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"准备本阶段只读结果和回调顺序的请求和已有进度"}],"provides":[{"key":"subscription_publish_read_cycle_frame","type":"era.tavern.frame.subscription_publish.read_cycle","display_name":"准备本阶段只读结果和回调顺序的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_publish_read_cycle_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“准备本阶段只读结果和回调顺序”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_publish_read_cycle_frame":["保留“准备本阶段只读结果和回调顺序”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"ReadCycle"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_publish.read_cycle",
  "node_type": "vibeflow.node"
});

export const era_tavern_subscription_publish_release_cycle = defineNode({
  "display_name": "结束阶段订阅并返回能否继续生成",
  "description": "全部阶段回调结束或取消后，从实例移除本周期记录，返回周期是否仍有效。阶段交接流程据此提交继续或取消请求。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"结束阶段订阅并返回能否继续生成的请求和已有进度"}],"provides":[{"key":"subscription_publish_release_cycle_frame","type":"era.tavern.frame.subscription_publish.released","display_name":"结束阶段订阅并返回能否继续生成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"subscription_publish_release_cycle_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“结束阶段订阅并返回能否继续生成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"subscription_publish_release_cycle_frame":["保留“结束阶段订阅并返回能否继续生成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/subscriptions.ts","export":"ReleaseCycle"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.subscription_publish.release_cycle",
  "node_type": "vibeflow.node"
});
