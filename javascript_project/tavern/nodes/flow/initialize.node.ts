import {defineNode} from "@vibeflow/plugin";

export const era_tavern_initialize_end = defineNode({
  "display_name": "标记酒馆子流程结束",
  "description": "标明当前酒馆子流程的终点。实际结果由已执行的处理步骤提供，长期资源的退出仍由所属实例的运行流程确认。",
  "version": "0.1.0",
  "flow_kind": "terminal",
  "contract": {"requires":[],"provides":[],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{}},"input_semantics":{},"output_semantics":{}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Terminal"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.initialize.end",
  "node_type": "vibeflow.node"
});

export const era_tavern_initialize_start = defineNode({
  "display_name": "标记酒馆子流程开始",
  "description": "标明当前酒馆子流程的起点，帮助阅读执行顺序。具体实例创建、事件处理或资源操作由图中的对应步骤完成。",
  "version": "0.1.0",
  "flow_kind": "terminal",
  "contract": {"requires":[],"provides":[],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{}},"input_semantics":{},"output_semantics":{}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Terminal"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.initialize.start",
  "node_type": "vibeflow.node"
});

export const era_tavern_initialize_prepare_auto_activate = defineNode({
  "display_name": "把已建立实例交给自动启用流程",
  "description": "自动启动模式下，继续传递本次已建立的实例资料，交给同一启用流程登记监听和界面。后续操作继续使用同一事件及资源记录。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.initialize.open_startup_wait","cardinality":"exactly_one","display_name":"把已建立实例交给自动启用流程的请求和已有进度"}],"provides":[{"key":"era_tavern_initialize_prepare_auto_activate_frame","type":"era.tavern.call.frame","display_name":"把已建立实例交给自动启用流程的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_initialize_prepare_auto_activate_frame"}},"input_semantics":{"era.tavern.frame.initialize.open_startup_wait":["保留“把已建立实例交给自动启用流程”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_initialize_prepare_auto_activate_frame":["保留“把已建立实例交给自动启用流程”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.initialize.prepare_auto_activate",
  "node_type": "vibeflow.node"
});
