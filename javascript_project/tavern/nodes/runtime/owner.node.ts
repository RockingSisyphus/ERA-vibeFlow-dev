import {defineNode} from "@vibeflow/plugin";

export const era_tavern_owned_hold_resources=defineNode({"display_name": "管理页面资源直到全部实际清理结束", "description": "持有本实例的监听、界面释放和实际异步操作，资源可用时通知其他分支。停止、页面卸载或故障时关闭入口、解除监听并等待尚在进行的操作及清理；全部完成后结束本资源分支。", "flow_kind": "data_store", "rulesets": ["vibeflow.data_store"], "contract": {"requires": [{"type":"era.workflow.host_resources","cardinality":"exactly_one","display_name":"所属 ERA 实例的本地资源"}, {"type": "era.tavern.call.frame", "cardinality": "exactly_one", "display_name": "管理页面资源直到全部实际清理结束的请求和已有进度"}], "provides": [{"key": "owned_hold_resources_frame", "type": "era.tavern.task.finished", "display_name": "当前职责已真实完成或退出的确认"}], "params_schema": {"outputKeys": {"type": "object"}}, "params_defaults": {"outputKeys": {"frame": "owned_hold_resources_frame"}}, "input_semantics": {"era.workflow.host_resources":["由运行宿主在本地注入的当前 ERA 实例资源，跨流程消息不包含此对象"],"era.tavern.call.frame": ["保留“管理页面资源直到全部实际清理结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]}, "output_semantics": {"owned_hold_resources_frame": ["记录当前职责一次工作或整个分支已经实际结束，供循环继续或汇合确认。"]}}, "implementations": [{"language": "typescript", "targets": ["browser", "node"], "completion": "suspend", "source": {"kind": "file", "ref": "nodes/runtime/owner.ts", "export": "HoldResources"}}], "base_libs": ["era.tavern.browser", "era.tavern.frames", "era.tavern.resources"], "id": "era.tavern.owned.hold_resources", "node_type": "vibeflow.node"});
export const era_tavern_owned_wait_owner = defineNode({
  "display_name": "等待本实例页面资源准备就绪",
  "description": "等待资源管理分支完成运行资源登记，取消时结束等待。后续主服务只在同一实例资源可用后启动，避免尚未就绪就调用页面能力。",
  "flow_kind": "data_store",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待本实例页面资源准备就绪的请求和已有进度"}],"provides":[{"key":"owned_wait_owner_frame","type":"era.tavern.call.frame","display_name":"等待本实例页面资源准备就绪的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_wait_owner_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待本实例页面资源准备就绪”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_wait_owner_frame":["保留“等待本实例页面资源准备就绪”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/runtime/owner.ts","export":"WaitOwner"}}],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.wait_owner",
  "node_type": "vibeflow.node"
});

export const era_tavern_owned_claim_stop = defineNode({
  "display_name": "区分首次停止与已有停止请求",
  "description": "检查本实例是否已经开始清理。首次请求进入收尾，重复请求沿用已开始的停止过程，避免多次释放同一批资源。",
  "flow_kind": "decision",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"区分首次停止与已有停止请求的请求和已有进度"}],"provides":[{"key":"owned_claim_stop_frame","type":"era.tavern.call.frame","display_name":"区分首次停止与已有停止请求的处理进度及结果"},{"key":"owned_claim_stop_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_claim_stop_frame","route":"owned_claim_stop_route"}},"input_semantics":{"era.tavern.call.frame":["保留“区分首次停止与已有停止请求”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_claim_stop_frame":["保留“区分首次停止与已有停止请求”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"owned_claim_stop_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/runtime/owner.ts","export":"ClaimClose"}}],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.claim_stop",
  "node_type": "vibeflow.node"
});

export const era_tavern_owned_reuse_stop = defineNode({
  "display_name": "确认已有停止过程继续负责清理",
  "description": "本实例已经开始停止时，返回入口已关闭的确认。实际资源仍由原停止过程清理，最终等待由长期运行的退出汇合负责。",
  "flow_kind": "process",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认已有停止过程继续负责清理的请求和已有进度"}],"provides":[{"key":"owned_reuse_stop_frame","type":"era.tavern.frame.stop.owned_prepared","display_name":"确认已有停止过程继续负责清理的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_reuse_stop_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确认已有停止过程继续负责清理”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_reuse_stop_frame":["保留“确认已有停止过程继续负责清理”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/runtime/owner.ts","export":"ReuseClose"}}],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.reuse_stop",
  "node_type": "vibeflow.node"
});

export const era_tavern_owned_bind_script_session = defineNode({
  "display_name": "把当前实例交给主服务的酒馆操作入口",
  "description": "将本次已准备的实例关联到主服务使用的酒馆操作入口。后续消息、变量和生成请求都使用这份实例资料，保证事件队列和资源归属一致。",
  "flow_kind": "data_store",
  "rulesets": ["vibeflow.data_store"],
  "contract": {"requires":[{"type":"era.tavern.frame.initialize.return_session","cardinality":"exactly_one","display_name":"把当前实例交给主服务的酒馆操作入口的请求和已有进度"}],"provides":[{"key":"owned_bind_script_session_frame","type":"era.tavern.call.frame","display_name":"把当前实例交给主服务的酒馆操作入口的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"owned_bind_script_session_frame"}},"input_semantics":{"era.tavern.frame.initialize.return_session":["保留“把当前实例交给主服务的酒馆操作入口”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"owned_bind_script_session_frame":["保留“把当前实例交给主服务的酒馆操作入口”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/runtime/owner.ts","export":"BindSession"}}],
  "base_libs": ["era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.owned.bind_script_session",
  "node_type": "vibeflow.node"
});

