import {defineNode} from "@vibeflow/plugin";

export const era_tavern_notification_start_item_choose_item = defineNode({
  "display_name": "选择下一条普通通知或阶段通知",
  "description": "读取通知组当前位置，选择发出普通事件或启动生成阶段订阅；没有剩余通知时结束本轮。所有通知按原清单发起，完成结果另行收集。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.notification_batch.begin","cardinality":"exactly_one","display_name":"选择下一条普通通知或阶段通知的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_start_item_choose_item_frame","type":"era.tavern.frame.notification_start_item.current","display_name":"选择下一条普通通知或阶段通知的处理进度及结果"},{"key":"era_tavern_notification_start_item_choose_item_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_start_item_choose_item_frame","route":"era_tavern_notification_start_item_choose_item_route"}},"input_semantics":{"era.tavern.frame.notification_batch.begin":["保留“选择下一条普通通知或阶段通知”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_start_item_choose_item_frame":["保留“选择下一条普通通知或阶段通知”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_notification_start_item_choose_item_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/start.ts","export":"ChooseItem"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification_start_item.choose_item",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_start_item_empty = defineNode({
  "display_name": "确认本组通知已全部发起",
  "description": "通知清单已遍历完成时，标记发起循环结束。实际回调可能仍在运行，后续通知完成分支会等待并汇总各项结果。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.notification_start_item.current","cardinality":"exactly_one","display_name":"确认本组通知已全部发起的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_start_item_empty_frame","type":"era.tavern.frame.notification_start_item.outcome","display_name":"确认本组通知已全部发起的处理进度及结果"},{"key":"era_tavern_notification_start_item_empty_done","type":"era.tavern.done.notification_start","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_start_item_empty_frame","done":"era_tavern_notification_start_item_empty_done"}},"input_semantics":{"era.tavern.frame.notification_start_item.current":["保留“确认本组通知已全部发起”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_start_item_empty_frame":["保留“确认本组通知已全部发起”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_notification_start_item_empty_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/start.ts","export":"Empty"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification_start_item.empty",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_start_item_start_event = defineNode({
  "display_name": "立即发出一条普通页面通知",
  "description": "将本条通知及参数发送给酒馆监听者，同时登记实际回调及完成后的记录位置，再移到下一条。后续通知分支读取成功或失败，使发起顺序和完成顺序各自明确。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.notification_start_item.current","cardinality":"exactly_one","display_name":"立即发出一条普通页面通知的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_start_item_start_event_frame","type":"era.tavern.frame.notification_start_item.outcome","display_name":"立即发出一条普通页面通知的处理进度及结果"},{"key":"era_tavern_notification_start_item_start_event_done","type":"era.tavern.done.notification_start","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_start_item_start_event_frame","done":"era_tavern_notification_start_item_start_event_done"}},"input_semantics":{"era.tavern.frame.notification_start_item.current":["保留“立即发出一条普通页面通知”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_start_item_start_event_frame":["保留“立即发出一条普通页面通知”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_notification_start_item_start_event_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/start.ts","export":"StartEvent"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification_start_item.start_event",
  "node_type": "vibeflow.node"
});

export const era_tavern_notification_start_item_start_handoff = defineNode({
  "display_name": "发起阶段订阅及后续生成交接",
  "description": "阶段完成通知仍有效时，捕获本次应执行的订阅列表，启动按序回调及生成交接等待。登记完成位置后继续发起其他通知，最终结果由通知分支统一收集。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.notification_start_item.current","cardinality":"exactly_one","display_name":"发起阶段订阅及后续生成交接的请求和已有进度"}],"provides":[{"key":"era_tavern_notification_start_item_start_handoff_frame","type":"era.tavern.frame.notification_start_item.outcome","display_name":"发起阶段订阅及后续生成交接的处理进度及结果"},{"key":"era_tavern_notification_start_item_start_handoff_done","type":"era.tavern.done.notification_start","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_notification_start_item_start_handoff_frame","done":"era_tavern_notification_start_item_start_handoff_done"}},"input_semantics":{"era.tavern.frame.notification_start_item.current":["保留“发起阶段订阅及后续生成交接”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_notification_start_item_start_handoff_frame":["保留“发起阶段订阅及后续生成交接”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_notification_start_item_start_handoff_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/start.ts","export":"StartHandoff"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.notification_start_item.start_handoff",
  "node_type": "vibeflow.node"
});
