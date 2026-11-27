import {defineNode} from "@vibeflow/plugin";

export const era_tavern_author_tool_invoke_tool = defineNode({
  "display_name": "执行作者注册的 JavaScript 函数",
  "description": "使用本次函数名称和参数调用酒馆注册的作者工具。实际调用结束时关闭新操作的入口，保留已接收操作的结算。调用已取消或抛错时保留失败，供消息流程处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.author_tool.read_call","cardinality":"exactly_one","display_name":"执行作者注册的 JavaScript 函数的请求和已有进度"}],"provides":[{"key":"era_tavern_author_tool_invoke_tool_frame","type":"era.tavern.frame.author_tool.invoke_tool","display_name":"执行作者注册的 JavaScript 函数的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_author_tool_invoke_tool_frame"}},"input_semantics":{"era.tavern.frame.author_tool.read_call":["保留“执行作者注册的 JavaScript 函数”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_author_tool_invoke_tool_frame":["保留“执行作者注册的 JavaScript 函数”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/functions/tool.ts","export":"InvokeTool"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.author_tool.invoke_tool",
  "node_type": "vibeflow.node"
});

export const era_tavern_author_tool_read_call = defineNode({
  "display_name": "读取已安排的作者函数和参数",
  "description": "接收作者执行队列交来的调用，确认本次运行资料存在。将作者函数名称、参数和有效性资料交给实际调用步骤。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"读取已安排的作者函数和参数的请求和已有进度"}],"provides":[{"key":"era_tavern_author_tool_read_call_frame","type":"era.tavern.frame.author_tool.read_call","display_name":"读取已安排的作者函数和参数的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_author_tool_read_call_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“读取已安排的作者函数和参数”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_author_tool_read_call_frame":["保留“读取已安排的作者函数和参数”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/tool.ts","export":"ReadCall"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.author_tool.read_call",
  "node_type": "vibeflow.node"
});

export const era_tavern_author_tool_record_terminal = defineNode({
  "display_name": "记录作者函数真正结束及错误",
  "description": "接收作者工具的实际完成结果，将失败原因写入本次调用并标记函数结束。后续等待方可以区分函数已完成与仍在运行。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.author_tool.invoke_tool","cardinality":"exactly_one","display_name":"记录作者函数真正结束及错误的请求和已有进度"}],"provides":[{"key":"era_tavern_author_tool_record_terminal_frame","type":"era.tavern.frame.author_tool.record_terminal","display_name":"记录作者函数真正结束及错误的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_author_tool_record_terminal_frame"}},"input_semantics":{"era.tavern.frame.author_tool.invoke_tool":["保留“记录作者函数真正结束及错误”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_author_tool_record_terminal_frame":["保留“记录作者函数真正结束及错误”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/tool.ts","export":"RecordTerminal"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.author_tool.record_terminal",
  "node_type": "vibeflow.node"
});

export const era_tavern_author_tool_wake_next = defineNode({
  "display_name": "通知消息流程作者函数已结束",
  "description": "作者工具结束情况已经记录后，唤醒正在等它下一步的消息流程。返回本轮作者执行完成确认，外层才会取下一个作者调用。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.author_tool.record_terminal","cardinality":"exactly_one","display_name":"通知消息流程作者函数已结束的请求和已有进度"}],"provides":[{"key":"era_tavern_author_tool_wake_next_frame","type":"era.tavern.task.finished","display_name":"当前职责已真实完成或退出的确认"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_author_tool_wake_next_frame"}},"input_semantics":{"era.tavern.frame.author_tool.record_terminal":["保留“通知消息流程作者函数已结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_author_tool_wake_next_frame":["记录当前职责一次工作或整个分支已经实际结束，供循环继续或汇合确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/tool.ts","export":"WakeNext"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.author_tool.wake_next",
  "node_type": "vibeflow.node"
});
