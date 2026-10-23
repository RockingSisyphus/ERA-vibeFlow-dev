import {defineNode} from "@vibeflow/plugin";

export const era_tavern_agent_write_session_begin_observation = defineNode({
  "display_name": "登记生成结束和阶段完成的等待",
  "description": "接收生成会话更新，按需建立本次酒馆生成结束及阶段交接的等待记录。新周期会结束被替换的旧周期等待，让后续请求只跟随当前有效生成。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_write_session.choose_observation","cardinality":"exactly_one","display_name":"登记生成结束和阶段完成的等待的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_write_session_begin_observation_frame","type":"era.tavern.frame.agent_write_session.begin_observation","display_name":"登记生成结束和阶段完成的等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_write_session_begin_observation_frame"}},"input_semantics":{"era.tavern.frame.agent_write_session.choose_observation":["保留“登记生成结束和阶段完成的等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_write_session_begin_observation_frame":["保留“登记生成结束和阶段完成的等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session-write.ts","export":"BeginObservation"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_write_session.begin_observation",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_write_session_check_chat = defineNode({
  "display_name": "检查生成进度要保存到哪个聊天",
  "description": "确认页面生成进度的写入请求明确指定聊天。有效后继续更新该聊天的会话记录，避免把不同聊天的阶段进度混在一起。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"检查生成进度要保存到哪个聊天的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_write_session_check_chat_frame","type":"era.tavern.frame.agent_write_session.check_chat","display_name":"检查生成进度要保存到哪个聊天的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_write_session_check_chat_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“检查生成进度要保存到哪个聊天”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_write_session_check_chat_frame":["保留“检查生成进度要保存到哪个聊天”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session-write.ts","export":"CheckChat"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_write_session.check_chat",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_write_session_choose_observation = defineNode({
  "display_name": "判断是否开始跟踪新的正文生成",
  "description": "读取本次生成进度写入要求，区分需要新建正文观察记录，还是继续使用提供的会话。后续据此登记或保留本次生成。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_write_session.check_chat","cardinality":"exactly_one","display_name":"判断是否开始跟踪新的正文生成的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_write_session_choose_observation_frame","type":"era.tavern.frame.agent_write_session.choose_observation","display_name":"判断是否开始跟踪新的正文生成的处理进度及结果"},{"key":"era_tavern_agent_write_session_choose_observation_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_write_session_choose_observation_frame","route":"era_tavern_agent_write_session_choose_observation_route"}},"input_semantics":{"era.tavern.frame.agent_write_session.check_chat":["保留“判断是否开始跟踪新的正文生成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_write_session_choose_observation_frame":["保留“判断是否开始跟踪新的正文生成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_agent_write_session_choose_observation_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session-write.ts","export":"ChooseObservation"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_write_session.choose_observation",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_write_session_publish_session = defineNode({
  "display_name": "通知页面生成进度已经更新",
  "description": "生成会话已经更新后，通知观察界面重新读取进度，并返回该聊天更新完成的确认。使用户能看到当前规划、正文或结算阶段状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_write_session.store_session","cardinality":"exactly_one","display_name":"通知页面生成进度已经更新的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_write_session_publish_session_frame","type":"era.tavern.call.frame","display_name":"通知页面生成进度已经更新的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_write_session_publish_session_frame"}},"input_semantics":{"era.tavern.frame.agent_write_session.store_session":["保留“通知页面生成进度已经更新”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_write_session_publish_session_frame":["保留“通知页面生成进度已经更新”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session-write.ts","export":"PublishSession"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_write_session.publish_session",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_write_session_select_keep = defineNode({
  "display_name": "沿用本次提供的生成进度",
  "description": "接收主服务已提供的生成会话，交给后续观察及存储。适用于不需要重新建立正文生成观察的进度更新。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_write_session.choose_observation","cardinality":"exactly_one","display_name":"沿用本次提供的生成进度的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_write_session_select_keep_frame","type":"era.tavern.frame.agent_write_session.choose_observation","display_name":"沿用本次提供的生成进度的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_write_session_select_keep_frame"}},"input_semantics":{"era.tavern.frame.agent_write_session.choose_observation":["保留“沿用本次提供的生成进度”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_write_session_select_keep_frame":["保留“沿用本次提供的生成进度”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session-write.ts","export":"SelectKeep"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_write_session.select_keep",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_write_session_select_start = defineNode({
  "display_name": "建立本次正文生成的观察记录",
  "description": "为当前正文生成登记请求身份、聊天、模型和预设，并把它附到生成会话。后续可以将正文完成情况对应到正确的这次生成。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_write_session.choose_observation","cardinality":"exactly_one","display_name":"建立本次正文生成的观察记录的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_write_session_select_start_frame","type":"era.tavern.frame.agent_write_session.choose_observation","display_name":"建立本次正文生成的观察记录的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_write_session_select_start_frame"}},"input_semantics":{"era.tavern.frame.agent_write_session.choose_observation":["保留“建立本次正文生成的观察记录”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_write_session_select_start_frame":["保留“建立本次正文生成的观察记录”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session-write.ts","export":"SelectStart"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_write_session.select_start",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_write_session_store_session = defineNode({
  "display_name": "保存本聊天在当前页面的生成进度",
  "description": "将本次会话资料复制保存到当前实例的聊天记录，正文已完成时同步更新观察结果。后续阶段读取这一进度来继续生成；它是本页运行资料，并非聊天消息的保存操作。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_write_session.begin_observation","cardinality":"exactly_one","display_name":"保存本聊天在当前页面的生成进度的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_write_session_store_session_frame","type":"era.tavern.frame.agent_write_session.store_session","display_name":"保存本聊天在当前页面的生成进度的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_write_session_store_session_frame"}},"input_semantics":{"era.tavern.frame.agent_write_session.begin_observation":["保留“保存本聊天在当前页面的生成进度”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_write_session_store_session_frame":["保留“保存本聊天在当前页面的生成进度”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session-write.ts","export":"StoreSession"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_write_session.store_session",
  "node_type": "vibeflow.node"
});
