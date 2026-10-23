import {defineNode} from "@vibeflow/plugin";

export const era_tavern_character_patch_external_statusbar_execute = defineNode({
  "display_name": "等待角色显示设置保存响应（保存外置状态栏设置）",
  "description": "本次处理“保存外置状态栏设置”。接收已经发起的角色卡显示设置写入，等待酒馆响应。后续检查成功状态，再让页面采用新的单层显示或外置状态栏设置。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待角色显示设置保存响应（保存外置状态栏设置）的请求和已有进度"}],"provides":[{"key":"era_tavern_character_patch_external_statusbar_execute_frame","type":"era.tavern.frame.character_patch_external_statusbar.execute.raw","display_name":"等待角色显示设置保存响应（保存外置状态栏设置）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_patch_external_statusbar_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待角色显示设置保存响应（保存外置状态栏设置）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_patch_external_statusbar_execute_frame":["保留“等待角色显示设置保存响应（保存外置状态栏设置）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/extensions.ts","export":"AwaitExtension"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_patch_external_statusbar.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_patch_external_statusbar_start_operation = defineNode({
  "display_name": "向角色卡保存单层显示或外置状态栏设置（保存外置状态栏设置）",
  "description": "本次处理“保存外置状态栏设置”。读取目标角色及请求的显示配置，合并本次明确改动并发起角色卡保存。保留目标角色与设置内容，供后续确认保存后更新页面。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_patch_external_statusbar.check_request","cardinality":"exactly_one","display_name":"向角色卡保存单层显示或外置状态栏设置（保存外置状态栏设置）的请求和已有进度"}],"provides":[{"key":"era_tavern_character_patch_external_statusbar_start_operation_frame","type":"era.tavern.call.frame","display_name":"向角色卡保存单层显示或外置状态栏设置（保存外置状态栏设置）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_patch_external_statusbar_start_operation_frame"}},"input_semantics":{"era.tavern.frame.character_patch_external_statusbar.check_request":["保留“向角色卡保存单层显示或外置状态栏设置（保存外置状态栏设置）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_patch_external_statusbar_start_operation_frame":["保留“向角色卡保存单层显示或外置状态栏设置（保存外置状态栏设置）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/extensions.ts","export":"StartExtension"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_patch_external_statusbar.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_patch_external_statusbar_finish_check_response = defineNode({
  "display_name": "确认角色显示设置已保存成功（保存外置状态栏设置）",
  "description": "本次处理“保存外置状态栏设置”。检查角色卡设置写入的响应，失败时报告原因。成功后才进入页面资料更新，避免界面显示的配置与真实保存结果不一致。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_patch_external_statusbar.execute.raw","cardinality":"exactly_one","display_name":"确认角色显示设置已保存成功（保存外置状态栏设置）的请求和已有进度"}],"provides":[{"key":"era_tavern_character_patch_external_statusbar_finish_check_response_frame","type":"era.tavern.frame.character_patch_external_statusbar_finish.check_response","display_name":"确认角色显示设置已保存成功（保存外置状态栏设置）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_patch_external_statusbar_finish_check_response_frame"}},"input_semantics":{"era.tavern.frame.character_patch_external_statusbar.execute.raw":["保留“确认角色显示设置已保存成功（保存外置状态栏设置）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_patch_external_statusbar_finish_check_response_frame":["保留“确认角色显示设置已保存成功（保存外置状态栏设置）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/extensions.ts","export":"CheckResponse"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_patch_external_statusbar_finish.check_response",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_patch_external_statusbar_finish_publish_mirror = defineNode({
  "display_name": "让页面采用已保存的角色显示设置（保存外置状态栏设置）",
  "description": "本次处理“保存外置状态栏设置”。角色卡保存成功后，将新配置同步到当前页面持有的角色资料，并刷新单层显示或外置状态栏。返回更新确认，让用户立即看到已保存设置生效。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_patch_external_statusbar_finish.check_response","cardinality":"exactly_one","display_name":"让页面采用已保存的角色显示设置（保存外置状态栏设置）的请求和已有进度"}],"provides":[{"key":"era_tavern_character_patch_external_statusbar_finish_publish_mirror_frame","type":"era.tavern.frame.character_patch_external_statusbar.execute","display_name":"让页面采用已保存的角色显示设置（保存外置状态栏设置）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_patch_external_statusbar_finish_publish_mirror_frame"}},"input_semantics":{"era.tavern.frame.character_patch_external_statusbar_finish.check_response":["保留“让页面采用已保存的角色显示设置（保存外置状态栏设置）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_patch_external_statusbar_finish_publish_mirror_frame":["保留“让页面采用已保存的角色显示设置（保存外置状态栏设置）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/extensions.ts","export":"PublishExtension"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_patch_external_statusbar_finish.publish_mirror",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_patch_single_floor_execute = defineNode({
  "display_name": "等待角色显示设置保存响应（保存单层显示设置）",
  "description": "本次处理“保存单层显示设置”。接收已经发起的角色卡显示设置写入，等待酒馆响应。后续检查成功状态，再让页面采用新的单层显示或外置状态栏设置。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待角色显示设置保存响应（保存单层显示设置）的请求和已有进度"}],"provides":[{"key":"era_tavern_character_patch_single_floor_execute_frame","type":"era.tavern.frame.character_patch_single_floor.execute.raw","display_name":"等待角色显示设置保存响应（保存单层显示设置）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_patch_single_floor_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待角色显示设置保存响应（保存单层显示设置）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_patch_single_floor_execute_frame":["保留“等待角色显示设置保存响应（保存单层显示设置）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/extensions.ts","export":"AwaitExtension"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_patch_single_floor.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_patch_single_floor_start_operation = defineNode({
  "display_name": "向角色卡保存单层显示或外置状态栏设置（保存单层显示设置）",
  "description": "本次处理“保存单层显示设置”。读取目标角色及请求的显示配置，合并本次明确改动并发起角色卡保存。保留目标角色与设置内容，供后续确认保存后更新页面。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_patch_single_floor.check_request","cardinality":"exactly_one","display_name":"向角色卡保存单层显示或外置状态栏设置（保存单层显示设置）的请求和已有进度"}],"provides":[{"key":"era_tavern_character_patch_single_floor_start_operation_frame","type":"era.tavern.call.frame","display_name":"向角色卡保存单层显示或外置状态栏设置（保存单层显示设置）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_patch_single_floor_start_operation_frame"}},"input_semantics":{"era.tavern.frame.character_patch_single_floor.check_request":["保留“向角色卡保存单层显示或外置状态栏设置（保存单层显示设置）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_patch_single_floor_start_operation_frame":["保留“向角色卡保存单层显示或外置状态栏设置（保存单层显示设置）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/extensions.ts","export":"StartExtension"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_patch_single_floor.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_patch_single_floor_finish_check_response = defineNode({
  "display_name": "确认角色显示设置已保存成功（保存单层显示设置）",
  "description": "本次处理“保存单层显示设置”。检查角色卡设置写入的响应，失败时报告原因。成功后才进入页面资料更新，避免界面显示的配置与真实保存结果不一致。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_patch_single_floor.execute.raw","cardinality":"exactly_one","display_name":"确认角色显示设置已保存成功（保存单层显示设置）的请求和已有进度"}],"provides":[{"key":"era_tavern_character_patch_single_floor_finish_check_response_frame","type":"era.tavern.frame.character_patch_single_floor_finish.check_response","display_name":"确认角色显示设置已保存成功（保存单层显示设置）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_patch_single_floor_finish_check_response_frame"}},"input_semantics":{"era.tavern.frame.character_patch_single_floor.execute.raw":["保留“确认角色显示设置已保存成功（保存单层显示设置）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_patch_single_floor_finish_check_response_frame":["保留“确认角色显示设置已保存成功（保存单层显示设置）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/extensions.ts","export":"CheckResponse"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_patch_single_floor_finish.check_response",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_patch_single_floor_finish_publish_mirror = defineNode({
  "display_name": "让页面采用已保存的角色显示设置（保存单层显示设置）",
  "description": "本次处理“保存单层显示设置”。角色卡保存成功后，将新配置同步到当前页面持有的角色资料，并刷新单层显示或外置状态栏。返回更新确认，让用户立即看到已保存设置生效。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_patch_single_floor_finish.check_response","cardinality":"exactly_one","display_name":"让页面采用已保存的角色显示设置（保存单层显示设置）的请求和已有进度"}],"provides":[{"key":"era_tavern_character_patch_single_floor_finish_publish_mirror_frame","type":"era.tavern.frame.character_patch_single_floor.execute","display_name":"让页面采用已保存的角色显示设置（保存单层显示设置）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_patch_single_floor_finish_publish_mirror_frame"}},"input_semantics":{"era.tavern.frame.character_patch_single_floor_finish.check_response":["保留“让页面采用已保存的角色显示设置（保存单层显示设置）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_patch_single_floor_finish_publish_mirror_frame":["保留“让页面采用已保存的角色显示设置（保存单层显示设置）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/extensions.ts","export":"PublishExtension"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_patch_single_floor_finish.publish_mirror",
  "node_type": "vibeflow.node"
});
