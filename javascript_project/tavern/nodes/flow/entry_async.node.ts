import {defineNode} from "@vibeflow/plugin";

export const era_tavern_entry_async_begin = defineNode({
  "display_name": "接收需要等待的酒馆操作",
  "description": "接收本次需要等待完成的酒馆请求及所属实例，将原参数交给操作选择。后续分别执行事件接收、生成等待或已发起请求的结果处理。",
  "version": "0.1.0",
  "flow_kind": "terminal",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"接收需要等待的酒馆操作的请求和已有进度"}],"provides":[{"key":"era_tavern_entry_async_begin_frame","type":"era.tavern.call.frame","display_name":"接收需要等待的酒馆操作的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_entry_async_begin_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“接收需要等待的酒馆操作”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_entry_async_begin_frame":["保留“接收需要等待的酒馆操作”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.entry_async.begin",
  "node_type": "vibeflow.node"
});

export const era_tavern_entry_async_finish = defineNode({
  "display_name": "交出异步酒馆请求的最终结果",
  "description": "将所选酒馆操作在等待完成后得到的结果返回外部调用方。生成、消息保存或事件等待各自的实际结论都由其处理分支提供。",
  "version": "0.1.0",
  "flow_kind": "terminal",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"交出异步酒馆请求的最终结果的请求和已有进度"}],"provides":[{"key":"era_tavern_entry_async_finish_frame","type":"era.tavern.call.result","display_name":"本次酒馆操作返回给调用方的结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_entry_async_finish_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“交出异步酒馆请求的最终结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_entry_async_finish_frame":["当前实际操作的返回结果，供调用方继续业务或显示实际原因。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.entry_async.finish",
  "node_type": "vibeflow.node"
});
