import {defineNode} from "@vibeflow/plugin";

export const era_sync_answer_author_sync = defineNode({
  "display_name": "回告运行中作者函数的历史同步请求",
  "description": "作者函数正在一条消息内部执行时，按现有接口规则拒绝它提出的历史同步要求，并返回具体说明，让函数继续完成当前调用。回告本身失败时记录错误，供消息流程处理。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.author.state","cardinality":"exactly_one","display_name":"作者调用处理后的消息位置及进度"}],"provides":[{"key":"answer_author_sync_author_state","type":"era.sync.author.state","display_name":"作者调用处理后的消息位置及进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.author.state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"]},"output_semantics":{"answer_author_sync_author_state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_author_nodes.ts","export":"AnswerAuthorSyncNode"}}],
  "base_libs": ["era.sync.position_author"],
  "capabilities": [{"id":"era.tavern.functions","operations":["acknowledge","release"]}],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.answer_author_sync",
  "node_type": "vibeflow.node"
});

export const era_sync_begin_author_call = defineNode({
  "display_name": "检查并启动消息中的作者函数",
  "description": "读取正文中声明的作者自定义 JavaScript 函数及参数，检查后启动这次调用。无效调用或启动失败会记下原因并交回消息处理；有效函数可以继续提出变量提交或结束请求。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.author.state","cardinality":"exactly_one","display_name":"作者调用处理后的消息位置及进度"}],"provides":[{"key":"begin_author_call_author_state","type":"era.sync.author.state","display_name":"作者调用处理后的消息位置及进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.author.state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"]},"output_semantics":{"begin_author_call_author_state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_author_nodes.ts","export":"BeginAuthorCallNode"}}],
  "base_libs": ["era.sync.position_author"],
  "capabilities": [{"id":"era.tavern.functions","operations":["begin","release"]}],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.begin_author_call",
  "node_type": "vibeflow.node"
});

export const era_sync_complete_author_step = defineNode({
  "display_name": "把作者函数当前进度交回消息处理",
  "description": "接收一次函数启动、请求确认、等待或清理的结果，交出函数在正文中的位置、当前进度和待处理提交。消息流程据此应用函数要求的操作，或继续等待它结束。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.author.state","cardinality":"exactly_one","display_name":"作者调用处理后的消息位置及进度"}],"provides":[{"key":"complete_author_step_position_state","type":"era.sync.position.state","display_name":"正文当前位置、变量和待保存内容"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.author.state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"]},"output_semantics":{"complete_author_step_position_state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_author_nodes.ts","export":"CompleteAuthorStepNode"}}],
  "base_libs": ["era.sync.position_author"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.complete_author_step",
  "node_type": "vibeflow.node"
});

export const era_sync_finish_author_call = defineNode({
  "display_name": "结束作者函数并整理正文记录",
  "description": "作者函数完成、失败或当前消息范围结束时，整理调用结果并更新正文中的调用标记，释放本次运行资料。将最终进度交回消息流程，供继续处理后面的正文。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.author.state","cardinality":"exactly_one","display_name":"作者调用处理后的消息位置及进度"},{"type":"era.sync.author.lifecycle.route","cardinality":"optional_one","display_name":"作者函数应启动、等待还是结束"},{"type":"era.sync.author.event.action","cardinality":"optional_one","display_name":"作者下一事件需要的处理方式"}],"provides":[{"key":"finish_author_call_author_state","type":"era.sync.author.state","display_name":"作者调用处理后的消息位置及进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.author.state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"],"era.sync.author.lifecycle.route":["根据调用和消息处理状态，选择本轮对应作者动作。"],"era.sync.author.event.action":["用于区分提交变量、请求同步、结束或错误，交给相应消息步骤处理。"]},"output_semantics":{"finish_author_call_author_state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_author_nodes.ts","export":"FinishAuthorCallNode"}}],
  "base_libs": ["era.sync.position_author"],
  "capabilities": [{"id":"era.tavern.functions","operations":["acknowledge","release"]}],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.finish_author_call",
  "node_type": "vibeflow.node"
});

export const era_sync_prepare_author_commit = defineNode({
  "display_name": "把作者函数提交的操作接到当前位置",
  "description": "检查运行中的作者函数要求提交的变量操作，有效内容插入它所在的消息位置，交给统一指令流程按顺序计算。可立即答复的请求直接回告，其他结果在应用完成后确认。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.author.state","cardinality":"exactly_one","display_name":"作者调用处理后的消息位置及进度"}],"provides":[{"key":"prepare_author_commit_author_state","type":"era.sync.author.state","display_name":"作者调用处理后的消息位置及进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.author.state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"]},"output_semantics":{"prepare_author_commit_author_state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_author_nodes.ts","export":"PrepareAuthorCommitNode"}}],
  "base_libs": ["era.sync.position_author"],
  "capabilities": [{"id":"era.tavern.functions","operations":["acknowledge","release"]}],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.prepare_author_commit",
  "node_type": "vibeflow.node"
});

export const era_sync_receive_author_event = defineNode({
  "display_name": "确认上次提交并等待作者函数下一步",
  "description": "把上次已经应用的变量操作结果回告正在运行的作者函数，然后等待它继续提交、要求同步或结束。收到后选择对应动作；等待或回告失败时带回具体原因。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.sync.author.state","cardinality":"exactly_one","display_name":"作者调用处理后的消息位置及进度"}],"provides":[{"key":"receive_author_event_author_state","type":"era.sync.author.state","display_name":"作者调用处理后的消息位置及进度"},{"key":"author_event","type":"era.sync.author.event.action","display_name":"作者下一事件需要的处理方式"},{"key":"author_finish","type":"era.step.done","display_name":"当前处理范围是否已经结束"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.author.state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"]},"output_semantics":{"receive_author_event_author_state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"],"author_event":["用于区分提交变量、请求同步、结束或错误，交给相应消息步骤处理。"],"author_finish":["循环据此继续下一消息、操作或任务，或进入本范围的最终结果整理。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/sync/core_author_nodes.ts","export":"ReceiveAuthorEventNode"}}],
  "base_libs": ["era.sync.position_author"],
  "capabilities": [{"id":"era.tavern.functions","operations":["acknowledge","next","release"]},{"id":"era.tavern.identity","operations":["read"]}],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.receive_author_event",
  "node_type": "vibeflow.node"
});

export const era_sync_route_author_lifecycle = defineNode({
  "display_name": "决定启动、接续还是结束作者函数",
  "description": "检查消息内作者自定义 JavaScript 函数的运行进度。首次遇到时启动，运行中时确认已应用提交并等待下一请求，消息结束或失败时收尾；输出本轮应完成的动作。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.sync.position.state","cardinality":"exactly_one","display_name":"正文当前位置、变量和待保存内容"}],"provides":[{"key":"route_author_lifecycle_position_state","type":"era.sync.author.state","display_name":"作者调用处理后的消息位置及进度"},{"key":"route_author_lifecycle_author_lifecycle_route","type":"era.sync.author.lifecycle.route","display_name":"作者函数应启动、等待还是结束"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.position.state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]},"output_semantics":{"route_author_lifecycle_position_state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"],"route_author_lifecycle_author_lifecycle_route":["根据调用和消息处理状态，选择本轮对应作者动作。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_author_nodes.ts","export":"RouteAuthorLifecycleNode"}}],
  "base_libs": ["era.sync.position_author"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.route_author_lifecycle",
  "node_type": "vibeflow.node"
});
