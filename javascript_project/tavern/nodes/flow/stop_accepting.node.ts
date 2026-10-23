import {defineNode} from "@vibeflow/plugin";

export const era_tavern_stop_accepting_return_closed = defineNode({
  "display_name": "返回实例已关闭接收入口的确认",
  "description": "接收停止接纳及生成取消的结果，向发起者返回入口已经关闭。实际任务退出和异步资源清理仍由实例长期运行流程等待完成。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.stop_accepting.cancel_generations","cardinality":"exactly_one","display_name":"返回实例已关闭接收入口的确认的请求和已有进度"}],"provides":[{"key":"era_tavern_stop_accepting_return_closed_frame","type":"era.tavern.call.frame","display_name":"返回实例已关闭接收入口的确认的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_stop_accepting_return_closed_frame"}},"input_semantics":{"era.tavern.frame.stop_accepting.cancel_generations":["保留“返回实例已关闭接收入口的确认”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_stop_accepting_return_closed_frame":["保留“返回实例已关闭接收入口的确认”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.stop_accepting.return_closed",
  "node_type": "vibeflow.node"
});
