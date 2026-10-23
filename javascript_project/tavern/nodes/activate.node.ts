import {defineNode} from "@vibeflow/plugin";

export const era_tavern_activate_branch_allow = defineNode({
  "display_name": "安装本实例的聊天和按钮监听",
  "description": "接收允许启用的实例，为聊天变化、生成事件和 ERA 按钮安装监听，并连接内部内容的显示处理。已安装时沿用同一组监听；登记失败会撤销本次已装部分，供后续安全启动。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.activate.choose_scope","cardinality":"exactly_one","display_name":"安装本实例的聊天和按钮监听的请求和已有进度"}],"provides":[{"key":"era_tavern_activate_branch_allow_frame","type":"era.tavern.frame.activate.choose_scope","display_name":"安装本实例的聊天和按钮监听的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_activate_branch_allow_frame"}},"input_semantics":{"era.tavern.frame.activate.choose_scope":["保留“安装本实例的聊天和按钮监听”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_activate_branch_allow_frame":["保留“安装本实例的聊天和按钮监听”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/activate.ts","export":"Allow"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.activate.branch_allow",
  "node_type": "vibeflow.node"
});

export const era_tavern_activate_branch_dormant = defineNode({
  "display_name": "确认本实例保持休眠",
  "description": "接收不应启用的实例，返回未激活的确认。当前实例保持不监听聊天，随后完成启动决定的等待与提示。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.activate.choose_scope","cardinality":"exactly_one","display_name":"确认本实例保持休眠的请求和已有进度"}],"provides":[{"key":"era_tavern_activate_branch_dormant_frame","type":"era.tavern.frame.activate.choose_scope","display_name":"确认本实例保持休眠的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_activate_branch_dormant_frame"}},"input_semantics":{"era.tavern.frame.activate.choose_scope":["保留“确认本实例保持休眠”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_activate_branch_dormant_frame":["保留“确认本实例保持休眠”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/activate.ts","export":"Dormant"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.activate.branch_dormant",
  "node_type": "vibeflow.node"
});

export const era_tavern_activate_check_instance = defineNode({
  "display_name": "确认当前实例可以启用监听",
  "description": "检查本次 ERA 实例是否已经启动、是否正在停止。只有可用实例才继续登记聊天事件，避免已关闭的实例重新开始接收请求。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认当前实例可以启用监听的请求和已有进度"}],"provides":[{"key":"era_tavern_activate_check_instance_frame","type":"era.tavern.frame.activate.check_instance","display_name":"确认当前实例可以启用监听的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_activate_check_instance_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确认当前实例可以启用监听”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_activate_check_instance_frame":["保留“确认当前实例可以启用监听”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/activate.ts","export":"CheckInstance"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.activate.check_instance",
  "node_type": "vibeflow.node"
});

export const era_tavern_activate_choose_scope = defineNode({
  "display_name": "选择启用监听或保持休眠",
  "description": "读取主服务对脚本安装位置作出的决定，选择启用或休眠分支。后续据此安装监听，或仅确认该实例保持未启用状态。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.activate.check_instance","cardinality":"exactly_one","display_name":"选择启用监听或保持休眠的请求和已有进度"}],"provides":[{"key":"era_tavern_activate_choose_scope_frame","type":"era.tavern.frame.activate.choose_scope","display_name":"选择启用监听或保持休眠的处理进度及结果"},{"key":"era_tavern_activate_choose_scope_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_activate_choose_scope_frame","route":"era_tavern_activate_choose_scope_route"}},"input_semantics":{"era.tavern.frame.activate.check_instance":["保留“选择启用监听或保持休眠”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_activate_choose_scope_frame":["保留“选择启用监听或保持休眠”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_activate_choose_scope_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/activate.ts","export":"ChooseScope"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.activate.choose_scope",
  "node_type": "vibeflow.node"
});

export const era_tavern_activate_settle_startup = defineNode({
  "display_name": "公布启动决定并按需挂载界面",
  "description": "接收启用或休眠结果，结束等待中的启动决定；启用且尚未呈现时挂载该实例界面。使启动调用方和页面都能知道当前实例已经进入哪种状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.activate.choose_scope","cardinality":"exactly_one","display_name":"公布启动决定并按需挂载界面的请求和已有进度"}],"provides":[{"key":"era_tavern_activate_settle_startup_frame","type":"era.tavern.call.frame","display_name":"公布启动决定并按需挂载界面的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_activate_settle_startup_frame"}},"input_semantics":{"era.tavern.frame.activate.choose_scope":["保留“公布启动决定并按需挂载界面”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_activate_settle_startup_frame":["保留“公布启动决定并按需挂载界面”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/activate.ts","export":"SettleStartup"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.activate.settle_startup",
  "node_type": "vibeflow.node"
});
