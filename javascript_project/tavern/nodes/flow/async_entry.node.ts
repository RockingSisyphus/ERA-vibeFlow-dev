import {defineNode} from "@vibeflow/plugin";

export const era_tavern_async_entry_choose = defineNode({
  "display_name": "按请求选择需要等待的操作",
  "description": "识别本次请求需要接收事件、等待生成前处理、阶段交接、实例运行，还是接续酒馆读写。将请求交给对应异步流程，未知或没有等待路径的操作返回原因。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"按请求选择需要等待的操作的请求和已有进度"}],"provides":[{"key":"era_tavern_async_entry_choose_frame","type":"era.tavern.call.frame","display_name":"按请求选择需要等待的操作的处理进度及结果"},{"key":"era_tavern_async_entry_choose_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"},"families":{"type":"array","items":{"type":"string"}},"actions":{"type":"array","items":{"type":"string"}}},"params_defaults":{"outputKeys":{"frame":"era_tavern_async_entry_choose_frame","route":"era_tavern_async_entry_choose_route"},"families":["agent","character","functions","messages","regex","sidecar","worldbook"],"actions":["receive","wait_through","subscription_publish","generation_receipt","generation_handoff","wait_startup"]},"input_semantics":{"era.tavern.call.frame":["保留“按请求选择需要等待的操作”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_async_entry_choose_frame":["保留“按请求选择需要等待的操作”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_async_entry_choose_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"ChooseAsync"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.async_entry.choose",
  "node_type": "vibeflow.node"
});

export const era_tavern_async_entry_return = defineNode({
  "display_name": "返回本次异步酒馆操作结果",
  "description": "接收事件等待、阶段交接或具体酒馆操作实际完成后的唯一结果，交给本次异步请求出口。调用方据此结束等待并继续业务。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"返回本次异步酒馆操作结果的请求和已有进度"}],"provides":[{"key":"era_tavern_async_entry_return_frame","type":"era.tavern.call.frame","display_name":"返回本次异步酒馆操作结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_async_entry_return_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“返回本次异步酒馆操作结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_async_entry_return_frame":["保留“返回本次异步酒馆操作结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.async_entry.return",
  "node_type": "vibeflow.node"
});
