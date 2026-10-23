import {defineNode} from "@vibeflow/plugin";

export const era_tavern_stop_abort_waiters = defineNode({
  "display_name": "取消事件接收和其他运行等待",
  "description": "将实例生命周期及业务操作标为取消，结束挂起的事件接收，唤醒作者、通知和计时等待。各分支据此进入停止路径，而不是继续等新任务。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.stop_accepting.cancel_generations","cardinality":"exactly_one","display_name":"取消事件接收和其他运行等待的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_abort_waiters_frame","type":"era.tavern.frame.stop.abort_waiters","display_name":"取消事件接收和其他运行等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_abort_waiters_frame"}},"input_semantics":{"era.tavern.frame.stop_accepting.cancel_generations":["保留“取消事件接收和其他运行等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_abort_waiters_frame":["保留“取消事件接收和其他运行等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/stop.ts","export":"AbortWaiters"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.stop.abort_waiters",
  "node_type": "vibeflow.node"
});

export const era_tavern_stop_clear_prompt = defineNode({
  "display_name": "关闭本实例的状态文件选择提示",
  "description": "实例停止时清除页面上的状态文件绑定或修复弹窗。清理失败会记录问题，其他停止步骤仍按流程继续。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.stop.cancel_receipts","cardinality":"exactly_one","display_name":"关闭本实例的状态文件选择提示的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_clear_prompt_frame","type":"era.tavern.frame.stop.owned_prepared","display_name":"关闭本实例的状态文件选择提示的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_clear_prompt_frame"}},"input_semantics":{"era.tavern.frame.stop.cancel_receipts":["保留“关闭本实例的状态文件选择提示”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_clear_prompt_frame":["保留“关闭本实例的状态文件选择提示”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/stop.ts","export":"ClearPrompt"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "implementation_files": ["stop.ts"],
  "id": "era.tavern.stop.clear_prompt",
  "node_type": "vibeflow.node"
});

export const era_tavern_stop_clear_timers = defineNode({
  "display_name": "撤销计时安排并列出未确认事件",
  "description": "取消事件收集、延迟事件及等待告警的计时，清空对应登记。按序列出尚未确认的事件，供后续逐项返回取消结果。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.stop.remove_listeners","cardinality":"exactly_one","display_name":"撤销计时安排并列出未确认事件的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_clear_timers_frame","type":"era.tavern.frame.stop.clear_timers","display_name":"撤销计时安排并列出未确认事件的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_clear_timers_frame"}},"input_semantics":{"era.tavern.frame.stop.remove_listeners":["保留“撤销计时安排并列出未确认事件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_clear_timers_frame":["保留“撤销计时安排并列出未确认事件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/stop.ts","export":"ClearTimers"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "implementation_files": ["stop.ts"],
  "id": "era.tavern.stop.clear_timers",
  "node_type": "vibeflow.node"
});

export const era_tavern_stop_remove_listeners = defineNode({
  "display_name": "解除当前实例安装的页面监听",
  "description": "移除本实例的聊天监听及取消监听，清空登记；解除中发生的问题写入告警。配合入口关闭，确保停止后不再由旧监听接收事件。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.stop.abort_waiters","cardinality":"exactly_one","display_name":"解除当前实例安装的页面监听的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_remove_listeners_frame","type":"era.tavern.frame.stop.remove_listeners","display_name":"解除当前实例安装的页面监听的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_remove_listeners_frame"}},"input_semantics":{"era.tavern.frame.stop.abort_waiters":["保留“解除当前实例安装的页面监听”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_remove_listeners_frame":["保留“解除当前实例安装的页面监听”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/stop.ts","export":"RemoveListeners"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "implementation_files": ["stop.ts"],
  "id": "era.tavern.stop.remove_listeners",
  "node_type": "vibeflow.node"
});

export const era_tavern_stop_accepting_cancel_generations = defineNode({
  "display_name": "取消生成、阶段交接及相关订阅",
  "description": "实例停止时取消业务等待，结束启动决定，清空本页生成进度、阶段交接及订阅，并撤销延后停止安排。让仍在等待旧生成的调用能够结束，实际运行资源继续由统一收尾等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.stop_accepting.close_ingress","cardinality":"exactly_one","display_name":"取消生成、阶段交接及相关订阅的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_accepting_cancel_generations_frame","type":"era.tavern.frame.stop_accepting.cancel_generations","display_name":"取消生成、阶段交接及相关订阅的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_accepting_cancel_generations_frame"}},"input_semantics":{"era.tavern.frame.stop_accepting.close_ingress":["保留“取消生成、阶段交接及相关订阅”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_accepting_cancel_generations_frame":["保留“取消生成、阶段交接及相关订阅”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/stop.ts","export":"CancelGenerations"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "implementation_files": ["stop.ts"],
  "id": "era.tavern.stop_accepting.cancel_generations",
  "node_type": "vibeflow.node"
});

export const era_tavern_stop_accepting_close_ingress = defineNode({
  "display_name": "立即停止接收新事件并唤醒各分支",
  "description": "把当前实例标为停止和未启动，返回入口关闭确认，并唤醒作者、通知和计时等待。后续请求会被拒绝，各长期分支开始结束处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"立即停止接收新事件并唤醒各分支的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_accepting_close_ingress_frame","type":"era.tavern.frame.stop_accepting.close_ingress","display_name":"立即停止接收新事件并唤醒各分支的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_accepting_close_ingress_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“立即停止接收新事件并唤醒各分支”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_accepting_close_ingress_frame":["保留“立即停止接收新事件并唤醒各分支”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/stop.ts","export":"CloseIngress"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.stop_accepting.close_ingress",
  "node_type": "vibeflow.node"
});

export const era_tavern_stop_cancel_receipts_item_choose_item = defineNode({
  "display_name": "选择下一项需要返回取消的事件",
  "description": "查看停止时记下的未确认事件位置。还有项目时继续取消，全部处理完则结束遍历，让每个发起者都能结束等待。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.stop.clear_timers","cardinality":"exactly_one","display_name":"选择下一项需要返回取消的事件的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_cancel_receipts_item_choose_item_frame","type":"era.tavern.frame.stop.clear_timers","display_name":"选择下一项需要返回取消的事件的处理进度及结果"},{"key":"era_tavern_stop_cancel_receipts_item_choose_item_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_cancel_receipts_item_choose_item_frame","route":"era_tavern_stop_cancel_receipts_item_choose_item_route"}},"input_semantics":{"era.tavern.frame.stop.clear_timers":["保留“选择下一项需要返回取消的事件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_cancel_receipts_item_choose_item_frame":["保留“选择下一项需要返回取消的事件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_stop_cancel_receipts_item_choose_item_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/stop.ts","export":"ChooseCancelled"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.stop_cancel_receipts_item.choose_item",
  "node_type": "vibeflow.node"
});

export const era_tavern_stop_cancel_receipts_item_one_item = defineNode({
  "display_name": "向一个未完成事件返回停止取消",
  "description": "取出尚未结束的原事件，以本实例停止原因为它完成取消确认，并释放相应资料。随后继续下一项，已经完成的事件不会重复处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.stop.clear_timers","cardinality":"exactly_one","display_name":"向一个未完成事件返回停止取消的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_cancel_receipts_item_one_item_frame","type":"era.tavern.frame.stop.clear_timers","display_name":"向一个未完成事件返回停止取消的处理进度及结果"},{"key":"era_tavern_stop_cancel_receipts_item_one_item_done","type":"era.tavern.done.stop.cancel_receipts","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_cancel_receipts_item_one_item_frame","done":"era_tavern_stop_cancel_receipts_item_one_item_done"}},"input_semantics":{"era.tavern.frame.stop.clear_timers":["保留“向一个未完成事件返回停止取消”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_cancel_receipts_item_one_item_frame":["保留“向一个未完成事件返回停止取消”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_stop_cancel_receipts_item_one_item_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/stop.ts","export":"CancelOne"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "implementation_files": ["stop.ts"],
  "id": "era.tavern.stop_cancel_receipts_item.one_item",
  "node_type": "vibeflow.node"
});
