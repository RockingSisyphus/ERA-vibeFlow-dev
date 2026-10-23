import {defineNode} from "@vibeflow/plugin";

export const era_tavern_entry_sync_begin = defineNode({
  "display_name": "接收本次即时酒馆操作",
  "description": "接收本次酒馆操作、参数及所属实例，交给操作选择。后续执行读取、事件接收准备、写入发起或停止等实际动作。",
  "version": "0.1.0",
  "flow_kind": "terminal",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"接收本次即时酒馆操作的请求和已有进度"}],"provides":[{"key":"era_tavern_entry_sync_begin_frame","type":"era.tavern.call.frame","display_name":"接收本次即时酒馆操作的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_entry_sync_begin_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“接收本次即时酒馆操作”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_entry_sync_begin_frame":["保留“接收本次即时酒馆操作”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.entry_sync.begin",
  "node_type": "vibeflow.node"
});

export const era_tavern_entry_sync_finish = defineNode({
  "display_name": "交出即时酒馆请求的结果",
  "description": "将本次立即完成的操作结果，或已经登记的异步等待，返回外部调用方。请求发起时的确认与稍后实际完成的结果按对应流程分别处理。",
  "version": "0.1.0",
  "flow_kind": "terminal",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"交出即时酒馆请求的结果的请求和已有进度"}],"provides":[{"key":"era_tavern_entry_sync_finish_frame","type":"era.tavern.call.result","display_name":"本次酒馆操作返回给调用方的结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_entry_sync_finish_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“交出即时酒馆请求的结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_entry_sync_finish_frame":["当前实际操作的返回结果，供调用方继续业务或显示实际原因。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.entry_sync.finish",
  "node_type": "vibeflow.node"
});
