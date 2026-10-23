import {defineNode} from "@vibeflow/plugin";

export const era_tavern_initialize_allocate_session = defineNode({
  "display_name": "建立当前 ERA 实例的运行资料",
  "description": "为本次页面实例建立事件队列、处理确认、定时记录、生成进度和资源等待；已启动实例沿用原资料，已停止实例不能重新启动。后续各条职责分支共用同一份实例资料。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.initialize.read_limits","cardinality":"exactly_one","display_name":"建立当前 ERA 实例的运行资料的请求和已有进度"}],"provides":[{"key":"era_tavern_initialize_allocate_session_frame","type":"era.tavern.frame.initialize.allocate_session","display_name":"建立当前 ERA 实例的运行资料的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_initialize_allocate_session_frame"}},"input_semantics":{"era.tavern.frame.initialize.read_limits":["保留“建立当前 ERA 实例的运行资料”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_initialize_allocate_session_frame":["保留“建立当前 ERA 实例的运行资料”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize.ts","export":"AllocateSession"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.initialize.allocate_session",
  "node_type": "vibeflow.node"
});

export const era_tavern_initialize_open_startup_wait = defineNode({
  "display_name": "决定自动启用还是等待安装位置判断",
  "description": "接收新建实例，建立启动决定的等待。自动模式继续启用，分步启动模式等待主服务判断脚本安装位置，让监听与界面按最终决定启用。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.initialize.allocate_session","cardinality":"exactly_one","display_name":"决定自动启用还是等待安装位置判断的请求和已有进度"}],"provides":[{"key":"era_tavern_initialize_open_startup_wait_frame","type":"era.tavern.frame.initialize.open_startup_wait","display_name":"决定自动启用还是等待安装位置判断的处理进度及结果"},{"key":"era_tavern_initialize_open_startup_wait_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_initialize_open_startup_wait_frame","route":"era_tavern_initialize_open_startup_wait_route"}},"input_semantics":{"era.tavern.frame.initialize.allocate_session":["保留“决定自动启用还是等待安装位置判断”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_initialize_open_startup_wait_frame":["保留“决定自动启用还是等待安装位置判断”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_initialize_open_startup_wait_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize.ts","export":"OpenStartup"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.initialize.open_startup_wait",
  "node_type": "vibeflow.node"
});

export const era_tavern_initialize_read_limits = defineNode({
  "display_name": "读取事件队列和等待提醒的设置",
  "description": "读取事件大小、队列数量、页面引用数量及等待告警期限，缺少有效设置时使用现有默认值。供本实例建立资源和接收限制。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"读取事件队列和等待提醒的设置的请求和已有进度"}],"provides":[{"key":"era_tavern_initialize_read_limits_frame","type":"era.tavern.frame.initialize.read_limits","display_name":"读取事件队列和等待提醒的设置的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_initialize_read_limits_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“读取事件队列和等待提醒的设置”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_initialize_read_limits_frame":["保留“读取事件队列和等待提醒的设置”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize.ts","export":"ReadLimits"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.initialize.read_limits",
  "node_type": "vibeflow.node"
});

export const era_tavern_initialize_return_session = defineNode({
  "display_name": "交出已经建立的当前实例",
  "description": "将本次已创建的运行资料交给调用方，作为后续酒馆操作和长期运行使用的同一实例。事件、生成和计时处理据此保持归属一致。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.initialize.open_startup_wait","cardinality":"exactly_one","display_name":"交出已经建立的当前实例的请求和已有进度"}],"provides":[{"key":"era_tavern_initialize_return_session_frame","type":"era.tavern.frame.initialize.return_session","display_name":"交出已经建立的当前实例的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_initialize_return_session_frame"}},"input_semantics":{"era.tavern.frame.initialize.open_startup_wait":["保留“交出已经建立的当前实例”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_initialize_return_session_frame":["保留“交出已经建立的当前实例”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize.ts","export":"ReturnSession"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.initialize.return_session",
  "node_type": "vibeflow.node"
});

export const era_tavern_initialize_wait_startup = defineNode({
  "display_name": "等待主服务给出启用或休眠决定",
  "description": "等待已经建立的启动判断结果，支持取消。主服务完成安装位置判断后，调用方得到本实例应启用或休眠的实际结论。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待主服务给出启用或休眠决定的请求和已有进度"}],"provides":[{"key":"era_tavern_initialize_wait_startup_frame","type":"era.tavern.frame.initialize.wait_startup","display_name":"等待主服务给出启用或休眠决定的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_initialize_wait_startup_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待主服务给出启用或休眠决定”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_initialize_wait_startup_frame":["保留“等待主服务给出启用或休眠决定”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/initialize.ts","export":"WaitStartup"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.initialize.wait_startup",
  "node_type": "vibeflow.node"
});
