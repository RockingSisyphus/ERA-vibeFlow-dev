import {defineNode} from "@vibeflow/plugin";

export const era_tavern_timer_wait_await_due = defineNode({
  "display_name": "等最近期限到达或计时安排改变",
  "description": "等待当前选定期限；新增、更早、替换或取消安排会唤醒本次等待，实例停止也会结束等待。退出时清除实际计时和监听，后续重新选择或处理到期。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等最近期限到达或计时安排改变的请求和已有进度"}],"provides":[{"key":"timer_wait_await_frame","type":"era.tavern.frame.timer_wait.waited","display_name":"等最近期限到达或计时安排改变的处理进度及结果"},{"key":"timer_wait_await_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"timer_wait_await_frame","route":"timer_wait_await_route"}},"input_semantics":{"era.tavern.call.frame":["保留“等最近期限到达或计时安排改变”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"timer_wait_await_frame":["保留“等最近期限到达或计时安排改变”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"timer_wait_await_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/timers/wait.ts","export":"AwaitDue"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_wait.await_due",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_wait_dispatch_due = defineNode({
  "display_name": "把实际到期交给计时事件流程",
  "description": "当前期限确实到达后，从等待集合移除本项，将计时种类、身份及对应事件交给到期处理。后续重新核对有效性，再发业务事件或告警。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_wait.waited","cardinality":"exactly_one","display_name":"把实际到期交给计时事件流程的请求和已有进度"}],"provides":[{"key":"timer_wait_dispatch_frame","type":"era.tavern.frame.timer_wait.result","display_name":"把实际到期交给计时事件流程的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"timer_wait_dispatch_frame"}},"input_semantics":{"era.tavern.frame.timer_wait.waited":["保留“把实际到期交给计时事件流程”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"timer_wait_dispatch_frame":["保留“把实际到期交给计时事件流程”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/wait.ts","export":"DispatchDue"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_wait.dispatch_due",
  "node_type": "vibeflow.node"
});

export const era_tavern_timer_wait_cancelled = defineNode({
  "display_name": "结束已取消或需要重新选择的计时等待",
  "description": "等待因安排改变、替换或停止而结束时，返回本轮无到期结果。外层随后按最新状态选择期限或结束计时分支。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_wait.waited","cardinality":"exactly_one","display_name":"结束已取消或需要重新选择的计时等待的请求和已有进度"}],"provides":[{"key":"timer_wait_cancel_frame","type":"era.tavern.frame.timer_wait.result","display_name":"结束已取消或需要重新选择的计时等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"timer_wait_cancel_frame"}},"input_semantics":{"era.tavern.frame.timer_wait.waited":["保留“结束已取消或需要重新选择的计时等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"timer_wait_cancel_frame":["保留“结束已取消或需要重新选择的计时等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/timers/wait.ts","export":"Cancelled"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.timer_wait.cancelled",
  "node_type": "vibeflow.node"
});
