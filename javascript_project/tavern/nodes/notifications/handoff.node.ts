import {defineNode} from "@vibeflow/plugin";

export const era_tavern_generation_handoff_admit_continue = defineNode({
  "display_name": "记住阶段继续请求是否被接收",
  "description": "接收统一事件入口的实际返回，保存本次阶段继续请求的接纳或拒绝结论。后续据此等待处理结果，或结束被拒绝的阶段交接。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"记住阶段继续请求是否被接收的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_admit_continue_frame","type":"era.tavern.frame.generation_handoff.admit_continue","display_name":"记住阶段继续请求是否被接收的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_admit_continue_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“记住阶段继续请求是否被接收”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_admit_continue_frame":["保留“记住阶段继续请求是否被接收”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"CaptureAdmission"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.admit_continue",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_admit_continue_prepare = defineNode({
  "display_name": "准备向主服务提交阶段继续或取消",
  "description": "根据订阅回调结论，形成对应当前阶段的继续请求；回调决定不继续时一并说明取消。交给统一事件接收流程，由主服务决定下一阶段业务。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.check_cancel","cardinality":"exactly_one","display_name":"准备向主服务提交阶段继续或取消的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_admit_continue_prepare_frame","type":"era.tavern.call.frame","display_name":"准备向主服务提交阶段继续或取消的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_admit_continue_prepare_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.check_cancel":["保留“准备向主服务提交阶段继续或取消”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_admit_continue_prepare_frame":["保留“准备向主服务提交阶段继续或取消”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"PrepareContinue"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.admit_continue_prepare",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_await_continue = defineNode({
  "display_name": "等待主服务处理本阶段继续请求",
  "description": "对已经接收的继续或取消请求，等待其真实处理确认。保留结果及等待失败，供后续判断生成已结束还是还有新的阶段交接。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.admit_continue","cardinality":"exactly_one","display_name":"等待主服务处理本阶段继续请求的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_await_continue_frame","type":"era.tavern.frame.generation_handoff.await_continue","display_name":"等待主服务处理本阶段继续请求的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_await_continue_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.admit_continue":["保留“等待主服务处理本阶段继续请求”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_await_continue_frame":["保留“等待主服务处理本阶段继续请求”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"AwaitContinue"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.await_continue",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_await_followup = defineNode({
  "display_name": "等待后续阶段形成最终生成结果",
  "description": "根据已经取得的后续阶段身份，等待它完成全部交接。失败时保留原因并结束本次结果，成功时把最终结论传回当前阶段，供原发起者等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.choose_followup","cardinality":"exactly_one","display_name":"等待后续阶段形成最终生成结果的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_await_followup_frame","type":"era.tavern.frame.generation_handoff.await_followup","display_name":"等待后续阶段形成最终生成结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_await_followup_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.choose_followup":["保留“等待后续阶段形成最终生成结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_await_followup_frame":["保留“等待后续阶段形成最终生成结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"AwaitFollowup"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.await_followup",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_check_cancel = defineNode({
  "display_name": "订阅结束后检查阶段是否已经取消",
  "description": "阶段回调结束后，重新核对取消状态及当前阶段记录是否仍存在。防止回调等待期间用户换消息、停止生成后，旧阶段仍被继续执行。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.publish_completion","cardinality":"exactly_one","display_name":"订阅结束后检查阶段是否已经取消的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_check_cancel_frame","type":"era.tavern.frame.generation_handoff.check_cancel","display_name":"订阅结束后检查阶段是否已经取消的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_check_cancel_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.publish_completion":["保留“订阅结束后检查阶段是否已经取消”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_check_cancel_frame":["保留“订阅结束后检查阶段是否已经取消”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"CheckCancel"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.check_cancel",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_check_pending = defineNode({
  "display_name": "读取当前生成阶段是否仍在等待交接",
  "description": "从阶段完成资料取出本次身份，检查当前实例是否仍登记了对应交接。保留检查结论，后续只推进仍有效阶段或结束已经失效的等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"读取当前生成阶段是否仍在等待交接的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_check_pending_frame","type":"era.tavern.frame.generation_handoff.check_pending","display_name":"读取当前生成阶段是否仍在等待交接的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_check_pending_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“读取当前生成阶段是否仍在等待交接”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_check_pending_frame":["保留“读取当前生成阶段是否仍在等待交接”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"CheckPending"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.check_pending",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_choose_admission = defineNode({
  "display_name": "区分阶段继续请求已接收或被拒绝",
  "description": "检查刚提交的阶段继续请求是否进入主服务队列。接收后等待对应结果，被拒绝时保留具体原因并收尾。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.admit_continue","cardinality":"exactly_one","display_name":"区分阶段继续请求已接收或被拒绝的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_choose_admission_frame","type":"era.tavern.frame.generation_handoff.admit_continue","display_name":"区分阶段继续请求已接收或被拒绝的处理进度及结果"},{"key":"era_tavern_generation_handoff_choose_admission_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_choose_admission_frame","route":"era_tavern_generation_handoff_choose_admission_route"}},"input_semantics":{"era.tavern.frame.generation_handoff.admit_continue":["保留“区分阶段继续请求已接收或被拒绝”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_choose_admission_frame":["保留“区分阶段继续请求已接收或被拒绝”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_generation_handoff_choose_admission_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"ChooseAdmission"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.choose_admission",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_choose_continue = defineNode({
  "display_name": "决定继续生成、取消或报告交接失败",
  "description": "结合阶段回调结果、取消状态和等待错误，选择提交下一步请求，或进入取消、失败收尾。后续只沿实际适用分支处理本次生成。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.check_cancel","cardinality":"exactly_one","display_name":"决定继续生成、取消或报告交接失败的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_choose_continue_frame","type":"era.tavern.frame.generation_handoff.check_cancel","display_name":"决定继续生成、取消或报告交接失败的处理进度及结果"},{"key":"era_tavern_generation_handoff_choose_continue_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_choose_continue_frame","route":"era_tavern_generation_handoff_choose_continue_route"}},"input_semantics":{"era.tavern.frame.generation_handoff.check_cancel":["保留“决定继续生成、取消或报告交接失败”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_choose_continue_frame":["保留“决定继续生成、取消或报告交接失败”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_generation_handoff_choose_continue_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"ChooseContinue"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.choose_continue",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_choose_followup = defineNode({
  "display_name": "判断生成已结束还是还要等下一阶段",
  "description": "接收阶段继续请求的结果，取消或失败时结束交接，产生新阶段完成身份时继续等待，其他情况采用当前结果。使外层等待可以覆盖整次生成。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.await_continue","cardinality":"exactly_one","display_name":"判断生成已结束还是还要等下一阶段的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_choose_followup_frame","type":"era.tavern.frame.generation_handoff.choose_followup","display_name":"判断生成已结束还是还要等下一阶段的处理进度及结果"},{"key":"era_tavern_generation_handoff_choose_followup_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_choose_followup_frame","route":"era_tavern_generation_handoff_choose_followup_route"}},"input_semantics":{"era.tavern.frame.generation_handoff.await_continue":["保留“判断生成已结束还是还要等下一阶段”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_choose_followup_frame":["保留“判断生成已结束还是还要等下一阶段”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_generation_handoff_choose_followup_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"ChooseFollowup"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.choose_followup",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_choose_pending = defineNode({
  "display_name": "选择继续交接或结束已失效阶段",
  "description": "查看本阶段交接记录是否仍存在。存在时继续等待订阅回调，不存在时返回已结束结论，避免旧生成请求重新启动下一阶段。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.check_pending","cardinality":"exactly_one","display_name":"选择继续交接或结束已失效阶段的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_choose_pending_frame","type":"era.tavern.frame.generation_handoff.check_pending","display_name":"选择继续交接或结束已失效阶段的处理进度及结果"},{"key":"era_tavern_generation_handoff_choose_pending_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_choose_pending_frame","route":"era_tavern_generation_handoff_choose_pending_route"}},"input_semantics":{"era.tavern.frame.generation_handoff.check_pending":["保留“选择继续交接或结束已失效阶段”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_choose_pending_frame":["保留“选择继续交接或结束已失效阶段”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_generation_handoff_choose_pending_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"ChoosePending"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.choose_pending",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_finish_cancelled = defineNode({
  "display_name": "结束已经取消的阶段交接",
  "description": "当前阶段在等待期间取消时，保留无后续结果的结论，交给统一收尾。使对应等待能够结束，而不会继续发起下一阶段。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.check_cancel","cardinality":"exactly_one","display_name":"结束已经取消的阶段交接的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_finish_cancelled_frame","type":"era.tavern.frame.generation_handoff.await_followup","display_name":"结束已经取消的阶段交接的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_finish_cancelled_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.check_cancel":["保留“结束已经取消的阶段交接”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_finish_cancelled_frame":["保留“结束已经取消的阶段交接”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"FinishCancelled"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.finish_cancelled",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_finish_failed = defineNode({
  "display_name": "结束阶段交接失败并保留原因",
  "description": "阶段订阅或等待已经失败时，整理为没有后续生成结果的状态。保留实际错误交给统一收尾，供通知组报告。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.check_cancel","cardinality":"exactly_one","display_name":"结束阶段交接失败并保留原因的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_finish_failed_frame","type":"era.tavern.frame.generation_handoff.await_followup","display_name":"结束阶段交接失败并保留原因的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_finish_failed_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.check_cancel":["保留“结束阶段交接失败并保留原因”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_finish_failed_frame":["保留“结束阶段交接失败并保留原因”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"FinishFailed"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.finish_failed",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_finish_handoff = defineNode({
  "display_name": "结束并移除本阶段交接等待",
  "description": "用本阶段最终生成结果完成对应等待，移除阶段登记，并形成通知成功或失败结论。原重试等待和通知组据此完整结束，不再留下旧阶段记录。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.await_followup","cardinality":"exactly_one","display_name":"结束并移除本阶段交接等待的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_finish_handoff_frame","type":"era.tavern.call.frame","display_name":"结束并移除本阶段交接等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_finish_handoff_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.await_followup":["保留“结束并移除本阶段交接等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_finish_handoff_frame":["保留“结束并移除本阶段交接等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"FinishHandoff"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.finish_handoff",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_finish_missing = defineNode({
  "display_name": "结束已经没有有效记录的旧阶段",
  "description": "本次阶段交接记录已不再存在时，返回没有后续结果的结论。随后完成统一收尾，不会重新建立已结束的阶段。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.check_pending","cardinality":"exactly_one","display_name":"结束已经没有有效记录的旧阶段的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_finish_missing_frame","type":"era.tavern.frame.generation_handoff.await_followup","display_name":"结束已经没有有效记录的旧阶段的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_finish_missing_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.check_pending":["保留“结束已经没有有效记录的旧阶段”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_finish_missing_frame":["保留“结束已经没有有效记录的旧阶段”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"FinishMissing"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.finish_missing",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_finish_rejected = defineNode({
  "display_name": "记录主服务拒绝阶段继续的原因",
  "description": "本次阶段继续请求未被主服务接收时，将拒绝说明记录为交接失败，并结束后续生成结果。统一收尾会将这次失败交回通知等待。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.admit_continue","cardinality":"exactly_one","display_name":"记录主服务拒绝阶段继续的原因的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_finish_rejected_frame","type":"era.tavern.frame.generation_handoff.await_followup","display_name":"记录主服务拒绝阶段继续的原因的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_finish_rejected_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.admit_continue":["保留“记录主服务拒绝阶段继续的原因”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_finish_rejected_frame":["保留“记录主服务拒绝阶段继续的原因”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"FinishRejected"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.finish_rejected",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_publish_completion = defineNode({
  "display_name": "等阶段订阅回调决定是否继续",
  "description": "接收已经开始的阶段订阅处理，等待它完成并取得继续或取消结论。订阅等待出错时保留原因，供下一步决定提交继续请求或结束交接。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.check_pending","cardinality":"exactly_one","display_name":"等阶段订阅回调决定是否继续的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_publish_completion_frame","type":"era.tavern.frame.generation_handoff.publish_completion","display_name":"等阶段订阅回调决定是否继续的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_publish_completion_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.check_pending":["保留“等阶段订阅回调决定是否继续”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_publish_completion_frame":["保留“等阶段订阅回调决定是否继续”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"PublishCompletion"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.publish_completion",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_select_cancel = defineNode({
  "display_name": "标记本次生成不再继续交接",
  "description": "阶段被取消或等待失败时，将后续生成结果记为空。交给统一收尾，结束当前阶段等待并保留已有错误结论。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.choose_followup","cardinality":"exactly_one","display_name":"标记本次生成不再继续交接的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_select_cancel_frame","type":"era.tavern.frame.generation_handoff.choose_followup","display_name":"标记本次生成不再继续交接的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_select_cancel_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.choose_followup":["保留“标记本次生成不再继续交接”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_select_cancel_frame":["保留“标记本次生成不再继续交接”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"SelectCancel"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.select_cancel",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_select_current = defineNode({
  "display_name": "采用当前阶段已经形成的最终结果",
  "description": "没有后续阶段需要等待时，将本次继续请求的处理确认作为最终生成结果。交给交接收尾，供外层等待得到实际结论。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.choose_followup","cardinality":"exactly_one","display_name":"采用当前阶段已经形成的最终结果的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_select_current_frame","type":"era.tavern.frame.generation_handoff.choose_followup","display_name":"采用当前阶段已经形成的最终结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_select_current_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.choose_followup":["保留“采用当前阶段已经形成的最终结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_select_current_frame":["保留“采用当前阶段已经形成的最终结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"SelectCurrent"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.select_current",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_handoff_select_next = defineNode({
  "display_name": "取出接下来需要等待的阶段身份",
  "description": "当前处理产生了下一阶段交接时，记录它的完成身份。后续只等待这次对应阶段，最终结果会继续传回原生成请求。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_handoff.choose_followup","cardinality":"exactly_one","display_name":"取出接下来需要等待的阶段身份的请求和已有进度"}],"provides":[{"key":"era_tavern_generation_handoff_select_next_frame","type":"era.tavern.frame.generation_handoff.choose_followup","display_name":"取出接下来需要等待的阶段身份的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_generation_handoff_select_next_frame"}},"input_semantics":{"era.tavern.frame.generation_handoff.choose_followup":["保留“取出接下来需要等待的阶段身份”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_generation_handoff_select_next_frame":["保留“取出接下来需要等待的阶段身份”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/handoff.ts","export":"SelectNext"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_handoff.select_next",
  "node_type": "vibeflow.node"
});
