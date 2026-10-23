import {defineNode} from "@vibeflow/plugin";

export const era_tavern_timer_wait_join = defineNode({
  "display_name": "返回本轮计时到期或取消的结论",
  "description": "接收本轮期限实际到达后的处理结果，或安排变化、停止带来的取消结论。将本轮完成状态交回计时循环，继续选择最新有效期限。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.timer_wait.result","cardinality":"exactly_one","display_name":"返回本轮计时到期或取消的结论的请求和已有进度"}],"provides":[{"key":"timer_wait_join_frame","type":"era.tavern.task.finished","display_name":"当前职责已真实完成或退出的确认"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"timer_wait_join_frame"}},"input_semantics":{"era.tavern.frame.timer_wait.result":["保留“返回本轮计时到期或取消的结论”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"timer_wait_join_frame":["记录当前职责一次工作或整个分支已经实际结束，供循环继续或汇合确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Finished"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.timer_wait.join",
  "node_type": "vibeflow.node"
});
