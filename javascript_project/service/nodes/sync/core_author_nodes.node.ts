import {defineNode} from "@vibeflow/plugin";

export const era_sync_complete_author_step = defineNode({
  "display_name": "把作者函数当前进度交回消息处理",
  "description": "接收一次函数启动、请求确认、等待或清理的结果，交出函数在正文中的位置、当前进度和待处理提交。消息流程据此应用函数要求的操作，或继续等待它结束。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.author.state","cardinality":"exactly_one","display_name":"作者调用处理后的消息位置及进度"}],"provides":[{"key":"complete_author_step_position_state","type":"era.sync.position.state","display_name":"正文当前位置、变量和待保存内容"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.author.state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"]},"output_semantics":{"complete_author_step_position_state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_author_nodes.ts","export":"CompleteAuthorStepNode"}}],
  "base_libs": ["era.sync.position_author"],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.complete_author_step",
  "node_type": "vibeflow.node"
});

export const era_sync_route_author_lifecycle = defineNode({
  "display_name": "决定启动、接续还是结束作者函数",
  "description": "检查消息内作者自定义 JavaScript 函数的运行进度。首次遇到时启动，运行中时确认已应用提交并等待下一请求，消息结束或失败时收尾；输出本轮应完成的动作。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.sync.position.state","cardinality":"exactly_one","display_name":"正文当前位置、变量和待保存内容"}, {"type":"era.workflow.resources_transferred","cardinality":"exactly_one","display_name":"本段实例资源已转交"}],"provides":[{"key":"route_author_lifecycle_position_state","type":"era.sync.author.state","display_name":"作者调用处理后的消息位置及进度"},{"key":"route_author_lifecycle_author_lifecycle_route","type":"era.sync.author.lifecycle.route","display_name":"作者函数应启动、等待还是结束"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.position.state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"], "era.workflow.resources_transferred":["宿主资源已沿本图的资源边交给后继步骤，之后才展开本节点的业务分支。"]},"output_semantics":{"route_author_lifecycle_position_state":["供消息循环继续应用作者提交的操作，等待下一事件，或完成函数收尾。"],"route_author_lifecycle_author_lifecycle_route":["根据调用和消息处理状态，选择本轮对应作者动作。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_author_nodes.ts","export":"RouteAuthorLifecycleNode"}}],
  "base_libs": ["era.sync.position_author"],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.route_author_lifecycle",
  "node_type": "vibeflow.node"
});
