import {defineNode} from "@vibeflow/plugin";

export const era_tavern_agent_stop_native_generation_execute = defineNode({
  "display_name": "尝试停止当前酒馆和辅助生成",
  "description": "接收停止生成要求，尝试停止辅助模型请求及酒馆当前正文生成。分别记录是否成功；酒馆暂时不能停止时，后续会安排命令处理结束后的一次补充尝试。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_stop_native_generation.check_request","cardinality":"exactly_one","display_name":"尝试停止当前酒馆和辅助生成的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_stop_native_generation_execute_frame","type":"era.tavern.frame.agent_stop_native_generation.execute","display_name":"尝试停止当前酒馆和辅助生成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_stop_native_generation_execute_frame"}},"input_semantics":{"era.tavern.frame.agent_stop_native_generation.check_request":["保留“尝试停止当前酒馆和辅助生成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_stop_native_generation_execute_frame":["保留“尝试停止当前酒馆和辅助生成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/native-stop.ts","export":"ExecuteStop"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames"],
  "id": "era.tavern.agent_stop_native_generation.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_owned_choose_native_stop = defineNode({
  "display_name": "判断是否需要稍后再尝试停止",
  "description": "查看刚才停止酒馆生成的结果。已经停止时继续确认，暂未停止时转入稍后重试安排，使停止要求与酒馆当前处理阶段配合。",
  "flow_kind": "decision",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.frame.agent_stop_native_generation.execute","cardinality":"exactly_one","display_name":"判断是否需要稍后再尝试停止的请求和已有进度"}],"provides":[{"key":"owned_choose_native_stop_frame","type":"era.tavern.frame.agent_stop_native_generation.execute","display_name":"判断是否需要稍后再尝试停止的处理进度及结果"},{"key":"owned_choose_native_stop_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_choose_native_stop_frame","route":"owned_choose_native_stop_route"}},"input_semantics":{"era.tavern.frame.agent_stop_native_generation.execute":["保留“判断是否需要稍后再尝试停止”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_choose_native_stop_frame":["保留“判断是否需要稍后再尝试停止”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"owned_choose_native_stop_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/native-stop.ts","export":"ChooseStop"}}],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.choose_native_stop",
  "node_type": "vibeflow.node"
});

export const era_tavern_owned_clear_native_stop = defineNode({
  "display_name": "撤销旧的延后停止安排",
  "description": "移除此前登记的单次停止监听，并清空其记录。避免当前停止操作结束后，旧安排在后续生成时误触发。",
  "flow_kind": "data_store",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.frame.agent_stop_native_generation.execute","cardinality":"exactly_one","display_name":"撤销旧的延后停止安排的请求和已有进度"}],"provides":[{"key":"owned_clear_native_stop_frame","type":"era.tavern.frame.agent_stop_native_generation.execute","display_name":"撤销旧的延后停止安排的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_clear_native_stop_frame"}},"input_semantics":{"era.tavern.frame.agent_stop_native_generation.execute":["保留“撤销旧的延后停止安排”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_clear_native_stop_frame":["保留“撤销旧的延后停止安排”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/native-stop.ts","export":"ClearStop"}}],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.clear_native_stop",
  "node_type": "vibeflow.node"
});

export const era_tavern_owned_arm_native_stop = defineNode({
  "display_name": "安排命令阶段结束后再试一次停止",
  "description": "酒馆暂时不能停止生成时，登记命令处理结束后的一次停止尝试，并替换旧安排。后续只有当前实例仍有效的这次安排可以触发。",
  "flow_kind": "data_store",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.frame.agent_stop_native_generation.execute","cardinality":"exactly_one","display_name":"安排命令阶段结束后再试一次停止的请求和已有进度"}],"provides":[{"key":"owned_arm_native_stop_frame","type":"era.tavern.frame.agent_stop_native_generation.execute","display_name":"安排命令阶段结束后再试一次停止的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_arm_native_stop_frame"}},"input_semantics":{"era.tavern.frame.agent_stop_native_generation.execute":["保留“安排命令阶段结束后再试一次停止”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_arm_native_stop_frame":["保留“安排命令阶段结束后再试一次停止”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/native-stop.ts","export":"ArmStop"}}],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.arm_native_stop",
  "node_type": "vibeflow.node"
});

export const era_tavern_owned_choose_native_retry = defineNode({
  "display_name": "检查延后停止安排是否仍有效",
  "description": "命令阶段结束后，核对收到的停止安排是否仍属于当前实例，且实例没有停止。有效时执行一次停止尝试，已经过期或被替换时忽略。",
  "flow_kind": "decision",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"检查延后停止安排是否仍有效的请求和已有进度"}],"provides":[{"key":"owned_choose_native_retry_frame","type":"era.tavern.call.frame","display_name":"检查延后停止安排是否仍有效的处理进度及结果"},{"key":"owned_choose_native_retry_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_choose_native_retry_frame","route":"owned_choose_native_retry_route"}},"input_semantics":{"era.tavern.call.frame":["保留“检查延后停止安排是否仍有效”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_choose_native_retry_frame":["保留“检查延后停止安排是否仍有效”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"owned_choose_native_retry_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/native-stop.ts","export":"ChooseRetry"}}],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.choose_native_retry",
  "node_type": "vibeflow.node"
});

export const era_tavern_owned_attempt_native_retry = defineNode({
  "display_name": "执行有效的单次延后停止",
  "description": "收到仍有效的延后停止安排后，先解除该单次监听，再尝试停止酒馆正文生成。记录实际结果，防止同一安排反复触发。",
  "flow_kind": "data_store",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"执行有效的单次延后停止的请求和已有进度"}],"provides":[{"key":"owned_attempt_native_retry_frame","type":"era.tavern.frame.native_stop_retry.result","display_name":"执行有效的单次延后停止的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_attempt_native_retry_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“执行有效的单次延后停止”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_attempt_native_retry_frame":["保留“执行有效的单次延后停止”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/native-stop.ts","export":"AttemptRetry"}}],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.attempt_native_retry",
  "node_type": "vibeflow.node"
});

export const era_tavern_owned_ignore_native_retry = defineNode({
  "display_name": "结束已经过期的延后停止安排",
  "description": "收到已经被替换或实例已停止的旧安排时，直接结束本次处理。后续生成不会因此被误停。",
  "flow_kind": "process",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"结束已经过期的延后停止安排的请求和已有进度"}],"provides":[{"key":"owned_ignore_native_retry_frame","type":"era.tavern.frame.native_stop_retry.result","display_name":"结束已经过期的延后停止安排的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_ignore_native_retry_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“结束已经过期的延后停止安排”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_ignore_native_retry_frame":["保留“结束已经过期的延后停止安排”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/native-stop.ts","export":"IgnoreRetry"}}],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.ignore_native_retry",
  "node_type": "vibeflow.node"
});
