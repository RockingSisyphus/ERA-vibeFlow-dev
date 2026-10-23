import {defineNode} from "@vibeflow/plugin";

export const era_command_apply_delete_action = defineNode({
  "display_name": "删除指定变量并留下可回退记录",
  "description": "按当前指令删除目标变量或指定子字段，记录删除前的内容，供以后切换回复或回退历史恢复。需要检查的子字段按原顺序继续处理，无效目标带回具体原因。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command.operation.state","cardinality":"exactly_one","display_name":"有序操作、当前变量和函数及随机进度"}],"provides":[{"key":"apply_delete_action_operation_state","type":"era.command.operation.state","display_name":"有序操作、当前变量和函数及随机进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command.operation.state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]},"output_semantics":{"apply_delete_action_operation_state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_operation_nodes.ts","export":"ApplyDeleteActionNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_functions","era.command.operation_state","era.command.operation_traversal"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command.apply_delete_action",
  "node_type": "vibeflow.node"
});

export const era_command_apply_edit_action = defineNode({
  "display_name": "修改变量或计算它的新值",
  "description": "读取当前指令指定的变量，直接赋值或计算公式后更新本轮状态，并记录变更。公式使用执行到此处的变量、历史起点和随机进度；无效操作保留原因，供继续处理及历史回退。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command.operation.state","cardinality":"exactly_one","display_name":"有序操作、当前变量和函数及随机进度"}],"provides":[{"key":"apply_edit_action_operation_state","type":"era.command.operation.state","display_name":"有序操作、当前变量和函数及随机进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command.operation.state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]},"output_semantics":{"apply_edit_action_operation_state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_operation_nodes.ts","export":"ApplyEditActionNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_functions","era.command.operation_state","era.command.operation_traversal"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command.apply_edit_action",
  "node_type": "vibeflow.node"
});

export const era_command_apply_function_group_action = defineNode({
  "display_name": "整组检查并应用函数库修改",
  "description": "在当前自定义函数库的临时副本上，依序处理本组新增、修改、删除和属性变化。完整检查通过才整组采用并记录历史；有错误则保留原函数库和具体问题，避免只改成一半。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command.operation.state","cardinality":"exactly_one","display_name":"有序操作、当前变量和函数及随机进度"}],"provides":[{"key":"apply_function_group_action_operation_state","type":"era.command.operation.state","display_name":"有序操作、当前变量和函数及随机进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command.operation.state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]},"output_semantics":{"apply_function_group_action_operation_state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/sync/core_operation_nodes.ts","export":"ApplyFunctionGroupActionNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_functions","era.command.operation_state","era.command.operation_traversal"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command.apply_function_group_action",
  "node_type": "vibeflow.node"
});

export const era_command_apply_insert_action = defineNode({
  "display_name": "新增变量并补齐需要的模板字段",
  "description": "按指令选择新增位置，补齐模板要求的字段，加入新值并记录可回退的历史。对象内字段按既定顺序继续处理，供后续指令使用新增结果。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command.operation.state","cardinality":"exactly_one","display_name":"有序操作、当前变量和函数及随机进度"}],"provides":[{"key":"apply_insert_action_operation_state","type":"era.command.operation.state","display_name":"有序操作、当前变量和函数及随机进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command.operation.state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]},"output_semantics":{"apply_insert_action_operation_state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_operation_nodes.ts","export":"ApplyInsertActionNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_functions","era.command.operation_state","era.command.operation_traversal"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command.apply_insert_action",
  "node_type": "vibeflow.node"
});

export const era_command_apply_stage_call_action = defineNode({
  "display_name": "计算生成阶段安排的函数调用",
  "description": "接收规划或结算阶段指定的一项函数调用，使用当前变量、函数、历史起点和随机进度计算并收集结果。失败时记录原因并将阶段调用标为失败，供生成阶段决定后续处理。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command.operation.state","cardinality":"exactly_one","display_name":"有序操作、当前变量和函数及随机进度"}],"provides":[{"key":"apply_stage_call_action_operation_state","type":"era.command.operation.state","display_name":"有序操作、当前变量和函数及随机进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command.operation.state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]},"output_semantics":{"apply_stage_call_action_operation_state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_operation_nodes.ts","export":"ApplyStageCallActionNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_functions","era.command.operation_state","era.command.operation_traversal"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command.apply_stage_call_action",
  "node_type": "vibeflow.node"
});

export const era_command_complete_operations = defineNode({
  "display_name": "交出本段指令计算后的完整状态",
  "description": "当前范围内的变量字段、整组函数修改或阶段调用都处理完后，交出变量、函数、历史记录、问题和随机使用进度。消息流程据此更新正文进度或生成阶段结果。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command.operation.state","cardinality":"exactly_one","display_name":"有序操作、当前变量和函数及随机进度"}],"provides":[{"key":"complete_operations_operation_state_after","type":"era.command.operation.state.next","display_name":"本项操作后的变量和下一操作进度"},{"key":"complete_operations_operation_done","type":"era.command.operation.done","display_name":"本范围的有序操作是否全部结束"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command.operation.state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]},"output_semantics":{"complete_operations_operation_state_after":["保留已经应用的变更及未处理清单，供外层操作循环继续。"],"complete_operations_operation_done":["供操作循环决定继续下一项，或交出完整变量、函数、历史及随机结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_operation_nodes.ts","export":"CompleteOperationsNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_functions","era.command.operation_state","era.command.operation_traversal"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command.complete_operations",
  "node_type": "vibeflow.node"
});

export const era_command_select_business_operation = defineNode({
  "display_name": "选择下一项要执行的变量或函数操作",
  "description": "按消息指令原有顺序和字段进度，选择新增、修改、删除变量，整组修改函数，或执行阶段函数调用。没有剩余内容时形成完整结果，使同一指令清单按顺序执行到结束。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.command.operation.state","cardinality":"exactly_one","display_name":"有序操作、当前变量和函数及随机进度"}],"provides":[{"key":"take_next_operation_operation_state","type":"era.command.operation.state","display_name":"有序操作、当前变量和函数及随机进度"},{"key":"take_next_operation_operation_route","type":"era.command.operation.route","display_name":"当前选中的变量或函数操作种类"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command.operation.state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]},"output_semantics":{"take_next_operation_operation_state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"],"take_next_operation_operation_route":["标明新增、修改、删除、整组函数检查、阶段调用、跳过或结束，供单项分支执行。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_operation_nodes.ts","export":"SelectBusinessOperationNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_functions","era.command.operation_state","era.command.operation_traversal"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command.select_business_operation",
  "node_type": "vibeflow.node"
});

export const era_command_settle_operation = defineNode({
  "display_name": "保留当前计算结果并准备下一项",
  "description": "当前操作完成或按规则跳过后，清理这项临时记录，保留更新后的变量、函数、历史和待处理内容。下一轮据此继续下个字段或操作，而不会重复执行当前项。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command.operation.state","cardinality":"exactly_one","display_name":"有序操作、当前变量和函数及随机进度"}],"provides":[{"key":"settle_operation_operation_state_after","type":"era.command.operation.state.next","display_name":"本项操作后的变量和下一操作进度"},{"key":"settle_operation_operation_done","type":"era.command.operation.done","display_name":"本范围的有序操作是否全部结束"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command.operation.state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]},"output_semantics":{"settle_operation_operation_state_after":["保留已经应用的变更及未处理清单，供外层操作循环继续。"],"settle_operation_operation_done":["供操作循环决定继续下一项，或交出完整变量、函数、历史及随机结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_operation_nodes.ts","export":"SettleOperationNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_functions","era.command.operation_state","era.command.operation_traversal"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command.settle_operation",
  "node_type": "vibeflow.node"
});

export const era_command_skip_operation = defineNode({
  "display_name": "保留状态并略过本项无效操作",
  "description": "目标不存在、受到保护或格式按规则需要跳过时，保留当前变量及进度，并留下相应原因。之后完成本项进度整理，让后面的指令仍按既定规则处理。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command.operation.state","cardinality":"exactly_one","display_name":"有序操作、当前变量和函数及随机进度"}],"provides":[{"key":"skip_operation_operation_state","type":"era.command.operation.state","display_name":"有序操作、当前变量和函数及随机进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command.operation.state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]},"output_semantics":{"skip_operation_operation_state":["作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/core_operation_nodes.ts","export":"SkipOperationNode"}}],
  "base_libs": ["era.command.operation_expressions","era.command.operation_functions","era.command.operation_state","era.command.operation_traversal"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command.skip_operation",
  "node_type": "vibeflow.node"
});
