import {defineNode} from "@vibeflow/plugin";

export const era_tavern_settlement_enqueue_notifications = defineNode({
  "display_name": "交接本批已经整理的通知资料",
  "description": "接收已完成批次结算的资料，交给后续通知准备。这里只继续传递现有内容，通知实际发起和完成处理由相应通知流程负责。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.settlement.publish_diagnostics","cardinality":"exactly_one","display_name":"交接本批已经整理的通知资料的请求和已有进度"}],"provides":[{"key":"era_tavern_settlement_enqueue_notifications_frame","type":"era.tavern.call.frame","display_name":"交接本批已经整理的通知资料的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_settlement_enqueue_notifications_frame"}},"input_semantics":{"era.tavern.frame.settlement.publish_diagnostics":["保留“交接本批已经整理的通知资料”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_settlement_enqueue_notifications_frame":["保留“交接本批已经整理的通知资料”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/settlement.ts","export":"EnqueueNotifications"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.settlement.enqueue_notifications",
  "node_type": "vibeflow.node"
});

export const era_tavern_settlement_latch_fatal = defineNode({
  "display_name": "进入严重故障状态并结束运行等待",
  "description": "本批要求停止服务时，固定严重故障状态，取消操作等待并拒绝仍挂起的事件接收。配合之前已回告的结果，让当前实例停止继续接收业务。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.settlement.settle_receipts","cardinality":"exactly_one","display_name":"进入严重故障状态并结束运行等待的请求和已有进度"}],"provides":[{"key":"era_tavern_settlement_latch_fatal_frame","type":"era.tavern.frame.settlement.latch_fatal","display_name":"进入严重故障状态并结束运行等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_settlement_latch_fatal_frame"}},"input_semantics":{"era.tavern.frame.settlement.settle_receipts":["保留“进入严重故障状态并结束运行等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_settlement_latch_fatal_frame":["保留“进入严重故障状态并结束运行等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/settlement.ts","export":"LatchFatal"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.settlement.latch_fatal",
  "node_type": "vibeflow.node"
});

export const era_tavern_settlement_mark_fatal_transition = defineNode({
  "display_name": "严重错误时先标记不再接收新事件",
  "description": "查看本批是否需要停止服务，若需要则先标记正在进入严重故障状态，再开始逐项返回事件结果。这样回告触发的新请求也能看到服务不可继续的状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"严重错误时先标记不再接收新事件的请求和已有进度"}],"provides":[{"key":"era_tavern_settlement_mark_fatal_transition_frame","type":"era.tavern.frame.settlement.mark_fatal_transition","display_name":"严重错误时先标记不再接收新事件的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_settlement_mark_fatal_transition_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“严重错误时先标记不再接收新事件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_settlement_mark_fatal_transition_frame":["保留“严重错误时先标记不再接收新事件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/settlement.ts","export":"MarkFatal"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.settlement.mark_fatal_transition",
  "node_type": "vibeflow.node"
});

export const era_tavern_settlement_publish_diagnostics = defineNode({
  "display_name": "把本批问题和提示报告到页面日志",
  "description": "读取主服务返回的各项诊断，逐条写入本实例日志。供用户或开发者看到实际处理中的提示与原因，原事件结论保持实际状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.settlement.latch_fatal","cardinality":"exactly_one","display_name":"把本批问题和提示报告到页面日志的请求和已有进度"}],"provides":[{"key":"era_tavern_settlement_publish_diagnostics_frame","type":"era.tavern.frame.settlement.publish_diagnostics","display_name":"把本批问题和提示报告到页面日志的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_settlement_publish_diagnostics_frame"}},"input_semantics":{"era.tavern.frame.settlement.latch_fatal":["保留“把本批问题和提示报告到页面日志”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_settlement_publish_diagnostics_frame":["保留“把本批问题和提示报告到页面日志”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/settlement.ts","export":"PublishDiagnostics"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.settlement.publish_diagnostics",
  "node_type": "vibeflow.node"
});

export const era_tavern_settlement_settle_receipts_item_choose_item = defineNode({
  "display_name": "选择本批下一项需要回告的事件",
  "description": "查看当前批次的事件处理确认清单，选择下一项，或在全部完成时结束遍历。每个原事件按序得到它自己的结果。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.settlement.mark_fatal_transition","cardinality":"exactly_one","display_name":"选择本批下一项需要回告的事件的请求和已有进度"}],"provides":[{"key":"era_tavern_settlement_settle_receipts_item_choose_item_frame","type":"era.tavern.frame.settlement.mark_fatal_transition","display_name":"选择本批下一项需要回告的事件的处理进度及结果"},{"key":"era_tavern_settlement_settle_receipts_item_choose_item_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_settlement_settle_receipts_item_choose_item_frame","route":"era_tavern_settlement_settle_receipts_item_choose_item_route"}},"input_semantics":{"era.tavern.frame.settlement.mark_fatal_transition":["保留“选择本批下一项需要回告的事件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_settlement_settle_receipts_item_choose_item_frame":["保留“选择本批下一项需要回告的事件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_settlement_settle_receipts_item_choose_item_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/settlement.ts","export":"ChooseReceipt"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.settlement_settle_receipts_item.choose_item",
  "node_type": "vibeflow.node"
});

export const era_tavern_settlement_settle_receipts_item_empty = defineNode({
  "display_name": "确认本轮事件结果已经逐项处理完",
  "description": "事件确认或取消清单已经遍历完时，标记本轮结束。后续进行整批诊断、通知或实例收尾。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.settlement.mark_fatal_transition","cardinality":"exactly_one","display_name":"确认本轮事件结果已经逐项处理完的请求和已有进度"}],"provides":[{"key":"era_tavern_settlement_settle_receipts_item_empty_frame","type":"era.tavern.frame.settlement.mark_fatal_transition","display_name":"确认本轮事件结果已经逐项处理完的处理进度及结果"},{"key":"era_tavern_settlement_settle_receipts_item_empty_done","type":"era.tavern.done.settlement.settle_receipts","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_settlement_settle_receipts_item_empty_frame","done":"era_tavern_settlement_settle_receipts_item_empty_done"}},"input_semantics":{"era.tavern.frame.settlement.mark_fatal_transition":["保留“确认本轮事件结果已经逐项处理完”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_settlement_settle_receipts_item_empty_frame":["保留“确认本轮事件结果已经逐项处理完”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_settlement_settle_receipts_item_empty_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/settlement.ts","export":"EmptyReceipt"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.settlement_settle_receipts_item.empty",
  "node_type": "vibeflow.node"
});

export const era_tavern_settlement_settle_receipts_item_one_item = defineNode({
  "display_name": "向一个原事件返回实际处理结果",
  "description": "取出本批下一项事件结论，完成对应等待并释放该事件持有的页面资料引用。推进位置，供外层继续回告剩余事件。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.settlement.mark_fatal_transition","cardinality":"exactly_one","display_name":"向一个原事件返回实际处理结果的请求和已有进度"}],"provides":[{"key":"era_tavern_settlement_settle_receipts_item_one_item_frame","type":"era.tavern.frame.settlement.mark_fatal_transition","display_name":"向一个原事件返回实际处理结果的处理进度及结果"},{"key":"era_tavern_settlement_settle_receipts_item_one_item_done","type":"era.tavern.done.settlement.settle_receipts","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_settlement_settle_receipts_item_one_item_frame","done":"era_tavern_settlement_settle_receipts_item_one_item_done"}},"input_semantics":{"era.tavern.frame.settlement.mark_fatal_transition":["保留“向一个原事件返回实际处理结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_settlement_settle_receipts_item_one_item_frame":["保留“向一个原事件返回实际处理结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_settlement_settle_receipts_item_one_item_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/settlement.ts","export":"SettleOne"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.settlement_settle_receipts_item.one_item",
  "node_type": "vibeflow.node"
});

export const era_tavern_stop_cancel_receipts_item_empty = defineNode({
  "display_name": "确认本轮事件结果已经逐项处理完",
  "description": "事件确认或取消清单已经遍历完时，标记本轮结束。后续进行整批诊断、通知或实例收尾。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.stop.clear_timers","cardinality":"exactly_one","display_name":"确认本轮事件结果已经逐项处理完的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_cancel_receipts_item_empty_frame","type":"era.tavern.frame.stop.clear_timers","display_name":"确认本轮事件结果已经逐项处理完的处理进度及结果"},{"key":"era_tavern_stop_cancel_receipts_item_empty_done","type":"era.tavern.done.stop.cancel_receipts","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_cancel_receipts_item_empty_frame","done":"era_tavern_stop_cancel_receipts_item_empty_done"}},"input_semantics":{"era.tavern.frame.stop.clear_timers":["保留“确认本轮事件结果已经逐项处理完”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_cancel_receipts_item_empty_frame":["保留“确认本轮事件结果已经逐项处理完”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_stop_cancel_receipts_item_empty_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/settlement.ts","export":"EmptyReceipt"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.stop_cancel_receipts_item.empty",
  "node_type": "vibeflow.node"
});
