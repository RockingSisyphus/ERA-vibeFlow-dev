import {defineNode} from "@vibeflow/plugin";

export const era_tavern_diagnostics_return_diagnostics = defineNode({
  "display_name": "交回当前实例的只读诊断结果",
  "description": "接收运行状态、队列、计时和等待数量等诊断资料，或当前有效期标记，交给诊断调用方。结果用于观察和判断旧请求是否过期。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.diagnostics.read_resources","cardinality":"exactly_one","display_name":"交回当前实例的只读诊断结果的请求和已有进度"}],"provides":[{"key":"era_tavern_diagnostics_return_diagnostics_frame","type":"era.tavern.call.frame","display_name":"交回当前实例的只读诊断结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_diagnostics_return_diagnostics_frame"}},"input_semantics":{"era.tavern.frame.diagnostics.read_resources":["保留“交回当前实例的只读诊断结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_diagnostics_return_diagnostics_frame":["保留“交回当前实例的只读诊断结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.diagnostics.return_diagnostics",
  "node_type": "vibeflow.node"
});
