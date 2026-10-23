import {defineNode} from "@vibeflow/plugin";

export const era_sync_accept_message_operations = defineNode({
  "display_name": "把指令计算结果合入当前消息",
  "description": "接收统一操作流程算出的变量、函数、历史和问题，将它们合入当前消息进度。正文指令标记完成并继续后续内容，生成阶段调用则形成相应阶段结果，供外层接着处理。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command.operation.result","cardinality":"exactly_one","display_name":"指定范围所有操作算出的完整状态"},{"type":"era.sync.position.state","cardinality":"exactly_one","display_name":"正文当前位置、变量和待保存内容"}],"provides":[{"key":"operations_position","type":"era.sync.position.state","display_name":"正文当前位置、变量和待保存内容"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command.operation.result":["包含变量、函数、历史、问题和随机使用次数，供消息应用、预演或压缩比较。"],"era.sync.position.state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]},"output_semantics":{"operations_position":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_position_nodes.ts","export":"AcceptMessageOperationsNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_state","era.service.agent_stage_program","era.service.function_block_execution","era.service.sync_contracts","era.service.sync_divergence","era.sync.position_source"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.accept_message_operations",
  "node_type": "vibeflow.node"
});

export const era_sync_choose_message_action = defineNode({
  "display_name": "判断当前位置是指令、函数还是消息结束",
  "description": "读取当前消息及正文位置，准备该消息的历史起点，识别变量指令、作者函数、生成阶段调用或结束位置。正在运行的作者函数交给函数流程；无需处理的消息继续下一条。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.sync.block.step.state","cardinality":"exactly_one","display_name":"当前消息位置及待处理变量指令"}],"provides":[{"key":"message_position","type":"era.sync.position.state","display_name":"正文当前位置、变量和待保存内容"},{"key":"message_action","type":"era.sync.message.action.route","display_name":"当前正文应处理指令、作者调用或结束"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.block.step.state":["记录正文当前位置、变量、函数及变更历史，供本轮处理指令、作者函数或消息结束。"]},"output_semantics":{"message_position":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"],"message_action":["根据消息位置和运行进度决定本段实际动作。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_position_nodes.ts","export":"ChooseMessageActionNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_state","era.service.agent_stage_program","era.service.function_block_execution","era.service.sync_contracts","era.service.sync_divergence","era.sync.position_source"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.choose_message_action",
  "node_type": "vibeflow.node"
});

export const era_sync_finish_message = defineNode({
  "display_name": "完成本条消息并准备继续历史",
  "description": "整理当前消息引起的变量和函数变化，更新正文处理记录，为已完成的历史准备可用压缩方案。然后移到下一条消息，使整个聊天按原顺序恢复变量状态。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.position.state","cardinality":"exactly_one","display_name":"正文当前位置、变量和待保存内容"}],"provides":[{"key":"finished_position","type":"era.sync.position.state","display_name":"正文当前位置、变量和待保存内容"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.position.state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]},"output_semantics":{"finished_position":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_position_nodes.ts","export":"FinishMessageNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_state","era.service.agent_stage_program","era.service.function_block_execution","era.service.sync_contracts","era.service.sync_divergence","era.sync.position_source"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.finish_message",
  "node_type": "vibeflow.node"
});

export const era_sync_finish_message_step = defineNode({
  "display_name": "汇总这一段正文带来的变化",
  "description": "接收刚处理完的变量指令、作者函数或消息结束结果，整理本轮变量、函数、正文、历史与问题。更新当前消息进度，供历史压缩及下一轮正文处理使用。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.position.state","cardinality":"exactly_one","display_name":"正文当前位置、变量和待保存内容"}],"provides":[{"key":"expression_command_result","type":"era.expression.command.result","display_name":"消息处理后待核对的历史压缩资料"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.position.state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]},"output_semantics":{"expression_command_result":["保留当前历史状态及可能缩短的正文，供使用正式操作规则逐项比较效果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_position_nodes.ts","export":"FinishMessageStepNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_state","era.service.agent_stage_program","era.service.function_block_execution","era.service.sync_contracts","era.service.sync_divergence","era.sync.position_source"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.finish_message_step",
  "node_type": "vibeflow.node"
});

export const era_sync_install_author_frame = defineNode({
  "display_name": "记住作者函数在消息中的执行位置",
  "description": "遇到还未执行的作者自定义 JavaScript 函数时，记住它所在的消息和正文位置，并放置临时定位标记。下一轮据此启动函数，它提交的变量操作也会接在这个位置处理。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.position.state","cardinality":"exactly_one","display_name":"正文当前位置、变量和待保存内容"}],"provides":[{"key":"install_author_frame_position_state","type":"era.sync.position.state","display_name":"正文当前位置、变量和待保存内容"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.position.state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]},"output_semantics":{"install_author_frame_position_state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_position_nodes.ts","export":"InstallAuthorFrameNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_state","era.service.agent_stage_program","era.service.function_block_execution","era.service.sync_contracts","era.service.sync_divergence","era.sync.position_source"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.install_author_frame",
  "node_type": "vibeflow.node"
});

export const era_sync_prepare_message_operations = defineNode({
  "display_name": "把当前位置的指令整理为有序操作",
  "description": "接收正文中的变量指令或生成阶段函数调用，整理要执行的操作清单，附上当前变量、函数、历史起点和随机进度。交给统一操作循环逐项计算，保持消息中的执行顺序。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.position.state","cardinality":"exactly_one","display_name":"正文当前位置、变量和待保存内容"}],"provides":[{"key":"seed_command_operations_operation_state","type":"era.command.operation.state","display_name":"有序操作、当前变量和函数及随机进度"},{"key":"seed_command_operations_position_state","type":"era.sync.position.state","display_name":"正文当前位置、变量和待保存内容"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.position.state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]},"output_semantics":{"seed_command_operations_operation_state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"],"seed_command_operations_position_state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_position_nodes.ts","export":"PrepareMessageOperationsNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_state","era.service.agent_stage_program","era.service.function_block_execution","era.service.sync_contracts","era.service.sync_divergence","era.sync.position_source"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.prepare_message_operations",
  "node_type": "vibeflow.node"
});

export const era_sync_skip_message_call = defineNode({
  "display_name": "记录跳过的函数调用并继续正文",
  "description": "正文中的函数调用按规则不执行时，保留原因，标记该调用已经处理，并移到下一个正文片段。外层据此继续消息，不会反复尝试同一项。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.position.state","cardinality":"exactly_one","display_name":"正文当前位置、变量和待保存内容"}],"provides":[{"key":"skipped_position","type":"era.sync.position.state","display_name":"正文当前位置、变量和待保存内容"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.position.state":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]},"output_semantics":{"skipped_position":["供识别本段指令或调用，按消息顺序推进并保留累计变化。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_position_nodes.ts","export":"SkipMessageCallNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_state","era.service.agent_stage_program","era.service.function_block_execution","era.service.sync_contracts","era.service.sync_divergence","era.sync.position_source"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.skip_message_call",
  "node_type": "vibeflow.node"
});
