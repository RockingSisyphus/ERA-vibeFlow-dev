import {defineNode} from "@vibeflow/plugin";

export const era_tavern_frame_receive_await_event = defineNode({
  "display_name": "取得队列事件或等待新事件到来",
  "description": "接收已取出的事件，或等待前一步登记的新事件到达。将该事件交给主服务；取消时按实际原因结束等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"取得队列事件或等待新事件到来的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_receive_await_event_frame","type":"era.tavern.frame.frame_receive.await_event","display_name":"取得队列事件或等待新事件到来的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_receive_await_event_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“取得队列事件或等待新事件到来”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_receive_await_event_frame":["保留“取得队列事件或等待新事件到来”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/receive.ts","export":"AwaitEvent"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_receive.await_event",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_receive_check_port = defineNode({
  "display_name": "确认事件入口已启用且没有重复等待",
  "description": "检查当前实例仍可用，聊天监听已经启用，且本次使用正确事件通道。同一实例已有等待接收者时报告问题，避免两个接收者争抢同一事件。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认事件入口已启用且没有重复等待的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_receive_check_port_frame","type":"era.tavern.frame.frame_receive.check_port","display_name":"确认事件入口已启用且没有重复等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_receive_check_port_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确认事件入口已启用且没有重复等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_receive_check_port_frame":["保留“确认事件入口已启用且没有重复等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/receive.ts","export":"CheckPort"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_receive.check_port",
  "node_type": "vibeflow.node"
});

export const era_tavern_frame_receive_read_queue = defineNode({
  "display_name": "取出最早事件或登记等待",
  "description": "事件队列非空时取出最早一项，队列为空时登记一次随实例或调用取消的等待。后续接收步骤据此取得事件，保持处理顺序。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.frame_receive.check_port","cardinality":"exactly_one","display_name":"取出最早事件或登记等待的请求和已有进度"}],"provides":[{"key":"era_tavern_frame_receive_read_queue_frame","type":"era.tavern.frame.frame_receive.read_queue","display_name":"取出最早事件或登记等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_frame_receive_read_queue_frame"}},"input_semantics":{"era.tavern.frame.frame_receive.check_port":["保留“取出最早事件或登记等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_frame_receive_read_queue_frame":["保留“取出最早事件或登记等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/receive.ts","export":"ReadQueue"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.frame_receive.read_queue",
  "node_type": "vibeflow.node"
});
