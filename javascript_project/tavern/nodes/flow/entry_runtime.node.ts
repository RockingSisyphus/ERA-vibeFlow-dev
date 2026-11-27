import {defineNode} from "@vibeflow/plugin";

export const era_tavern_entry_runtime_begin = defineNode({
  "display_name": "接收本次 ERA 实例运行资料",
  "description": "接收已经建立的 ERA 实例，交给五条长期职责分支共同运行。资源、主服务、作者、通知和计时都属于这一实例。",
  "version": "0.1.0",
  "flow_kind": "terminal",
  "contract": {"requires":[{"type":"era.workflow.host_resources","cardinality":"exactly_one","display_name":"所属 ERA 实例的本地资源"},{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"接收本次 ERA 实例运行资料的请求和已有进度"}],"provides":[{"key":"runtime_entry_host_resources","type":"era.workflow.host_resources","display_name":"同一实例的本地资源"},{"key":"era_tavern_entry_runtime_begin_frame","type":"era.tavern.call.frame","display_name":"接收本次 ERA 实例运行资料的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_entry_runtime_begin_frame"}},"input_semantics":{"era.workflow.host_resources":["当前运行宿主传入的本地资源对象"],"era.tavern.call.frame":["保留“接收本次 ERA 实例运行资料”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"runtime_entry_host_resources":["供后续运行职责及通信步骤使用的同一资源对象"],"era_tavern_entry_runtime_begin_frame":["保留“接收本次 ERA 实例运行资料”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"BeginRuntime"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.entry_runtime.begin",
  "node_type": "vibeflow.node"
});

export const era_tavern_entry_runtime_finish = defineNode({
  "display_name": "返回实例全部停止的确认",
  "description": "五条长期职责分支及实际资源清理已经结束后，返回本实例已停止的确认。调用方据此知道这次运行已经退出。",
  "version": "0.1.0",
  "flow_kind": "terminal",
  "contract": {"requires":[{"type":"era.tavern.runtime.result","cardinality":"exactly_one","display_name":"五条职责和资源清理完成后的停止确认"}],"provides":[{"key":"era_tavern_entry_runtime_finish_frame","type":"era.tavern.call.result","display_name":"本次酒馆操作返回给调用方的结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_entry_runtime_finish_frame"}},"input_semantics":{"era.tavern.runtime.result":["五条运行职责及资源清理结束后，向调用方确认本次实例已经停止。"]},"output_semantics":{"era_tavern_entry_runtime_finish_frame":["当前实际操作的返回结果，供调用方继续业务或显示实际原因。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"FinishRuntime"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.entry_runtime.finish",
  "node_type": "vibeflow.node"
});
