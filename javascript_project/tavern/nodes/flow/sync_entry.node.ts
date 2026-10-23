import {defineNode} from "@vibeflow/plugin";

export const era_tavern_sync_entry_choose = defineNode({
  "display_name": "按请求选择即时酒馆操作",
  "description": "识别本次请求是初始化、事件接收、服务输出处理、计时、订阅、停止，还是某类酒馆读写。操作种类明确后只选择相应路径，未知请求报告原因。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"按请求选择即时酒馆操作的请求和已有进度"}],"provides":[{"key":"era_tavern_sync_entry_choose_frame","type":"era.tavern.call.frame","display_name":"按请求选择即时酒馆操作的处理进度及结果"},{"key":"era_tavern_sync_entry_choose_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"},"families":{"type":"array","items":{"type":"string"}},"actions":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sync_entry_choose_frame","route":"era_tavern_sync_entry_choose_route"},"families":["admission","agent","character","functions","identity","installation_scope","messages","regex","sidecar","startup_gate","variables","worldbook"],"actions":{"initialize":"initialize","event":"event","admit":"admit","send":"send","stop_accepting":"stop_accepting","diagnostics":"diagnostics","prepare_receive":"prepare_receive","prepare_wait_through":"prepare_wait_through","prepare_stop":"prepare_stop","function_submit":"function_submit","timer_fired":"timer_fired","receive":"prepare_receive","wait_through":"prepare_wait_through","stop":"prepare_stop","auxiliary_terminal":"auxiliary_terminal","function_release":"function_release","subscription_control":"subscription_control","native_stop_retry":"native_stop_retry"}},"input_semantics":{"era.tavern.call.frame":["保留“按请求选择即时酒馆操作”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sync_entry_choose_frame":["保留“按请求选择即时酒馆操作”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_sync_entry_choose_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"ChooseSync"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.sync_entry.choose",
  "node_type": "vibeflow.node"
});

export const era_tavern_sync_entry_return = defineNode({
  "display_name": "交回当前即时操作或异步发起的结果",
  "description": "接收本次选中操作返回的实际内容，交给同步入口出口。完整读取结果可以立即使用；异步请求的发起结果仍需由对应等待流程确认完成。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"交回当前即时操作或异步发起的结果的请求和已有进度"}],"provides":[{"key":"era_tavern_sync_entry_return_frame","type":"era.tavern.call.frame","display_name":"交回当前即时操作或异步发起的结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sync_entry_return_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“交回当前即时操作或异步发起的结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sync_entry_return_frame":["保留“交回当前即时操作或异步发起的结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.sync_entry.return",
  "node_type": "vibeflow.node"
});
