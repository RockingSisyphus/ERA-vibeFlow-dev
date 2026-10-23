import {defineNode} from "@vibeflow/plugin";

export const era_tavern_character_write_main_greeting_check_request = defineNode({
  "display_name": "检查“保存角色主开场白”的调用是否有效",
  "description": "接收“保存角色主开场白”的请求，确认当前实例仍可运行、调用未取消，且输入确实是一份操作资料。通过后交给对应业务步骤，失败时按实际原因结束。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"检查“保存角色主开场白”的调用是否有效的请求和已有进度"}],"provides":[{"key":"era_tavern_character_write_main_greeting_check_request_frame","type":"era.tavern.frame.character_write_main_greeting.check_request","display_name":"检查“保存角色主开场白”的调用是否有效的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_write_main_greeting_check_request_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“检查“保存角色主开场白”的调用是否有效”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_write_main_greeting_check_request_frame":["保留“检查“保存角色主开场白”的调用是否有效”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/capability.ts","export":"CheckOperation"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_write_main_greeting.check_request",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_write_main_greeting_return_result = defineNode({
  "display_name": "交回“保存角色主开场白”的实际结果",
  "description": "接收“保存角色主开场白”已经执行得到的结果，复核实例和本次调用尚未取消后交回发起者。调用方据此继续业务或显示结果，取消时按实际原因结束等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_write_main_greeting.execute","cardinality":"exactly_one","display_name":"交回“保存角色主开场白”的实际结果的请求和已有进度"}],"provides":[{"key":"era_tavern_character_write_main_greeting_return_result_frame","type":"era.tavern.call.frame","display_name":"交回“保存角色主开场白”的实际结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_write_main_greeting_return_result_frame"}},"input_semantics":{"era.tavern.frame.character_write_main_greeting.execute":["保留“交回“保存角色主开场白”的实际结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_write_main_greeting_return_result_frame":["保留“交回“保存角色主开场白”的实际结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/capability.ts","export":"ReturnOperation"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_write_main_greeting.return_result",
  "node_type": "vibeflow.node"
});
