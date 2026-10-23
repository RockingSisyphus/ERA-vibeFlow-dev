import {defineNode} from "@vibeflow/plugin";

export const era_tavern_diagnostics_read_resources = defineNode({
  "display_name": "读取当前实例的运行和等待数量",
  "description": "读取实例是否启动、停止或严重故障，以及队列、未确认事件、定时器、页面引用和通知数量。返回只读运行概况，供诊断使用而不改变处理状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"读取当前实例的运行和等待数量的请求和已有进度"}],"provides":[{"key":"era_tavern_diagnostics_read_resources_frame","type":"era.tavern.frame.diagnostics.read_resources","display_name":"读取当前实例的运行和等待数量的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_diagnostics_read_resources_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“读取当前实例的运行和等待数量”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_diagnostics_read_resources_frame":["保留“读取当前实例的运行和等待数量”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/diagnostics.ts","export":"ReadResources"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.diagnostics.read_resources",
  "node_type": "vibeflow.node"
});
