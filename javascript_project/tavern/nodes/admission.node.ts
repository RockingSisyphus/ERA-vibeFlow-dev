import {defineNode} from "@vibeflow/plugin";

export const era_tavern_admission_branch_accepted = defineNode({
  "display_name": "登记事件序号和处理结果等待",
  "description": "给被接收的事件登记正式序号，保存所需页面引用，并建立处理结果的等待记录。发起者得到接收确认后，可以等待本事件结束或此前相关事件全部完成。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.admission.choose_admission","cardinality":"exactly_one","display_name":"登记事件序号和处理结果等待的请求和已有进度"}],"provides":[{"key":"era_tavern_admission_branch_accepted_frame","type":"era.tavern.frame.admission.choose_admission","display_name":"登记事件序号和处理结果等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_admission_branch_accepted_frame"}},"input_semantics":{"era.tavern.frame.admission.choose_admission":["保留“登记事件序号和处理结果等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_admission_branch_accepted_frame":["保留“登记事件序号和处理结果等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/admission.ts","export":"Accept"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.admission.branch_accepted",
  "node_type": "vibeflow.node"
});

export const era_tavern_admission_branch_rejected = defineNode({
  "display_name": "返回本次事件未被接收的原因",
  "description": "接收格式、服务状态或容量检查产生的拒绝结论，作为本次请求结果返回。被拒事件不进入待处理队列，调用方可据此说明未执行原因。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.admission.choose_admission","cardinality":"exactly_one","display_name":"返回本次事件未被接收的原因的请求和已有进度"}],"provides":[{"key":"era_tavern_admission_branch_rejected_frame","type":"era.tavern.frame.admission.choose_admission","display_name":"返回本次事件未被接收的原因的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_admission_branch_rejected_frame"}},"input_semantics":{"era.tavern.frame.admission.choose_admission":["保留“返回本次事件未被接收的原因”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_admission_branch_rejected_frame":["保留“返回本次事件未被接收的原因”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/admission.ts","export":"Rejected"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.admission.branch_rejected",
  "node_type": "vibeflow.node"
});

export const era_tavern_admission_check_capacity = defineNode({
  "display_name": "检查单事件大小和等待队列容量",
  "description": "读取已整理事件的大小，检查是否超过单事件上限，以及等待队列是否还能容纳。超限时带回拒绝原因，有空间时继续接收，避免无限积累未处理请求。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.admission.encode_event","cardinality":"exactly_one","display_name":"检查单事件大小和等待队列容量的请求和已有进度"}],"provides":[{"key":"era_tavern_admission_check_capacity_frame","type":"era.tavern.frame.admission.check_capacity","display_name":"检查单事件大小和等待队列容量的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_admission_check_capacity_frame"}},"input_semantics":{"era.tavern.frame.admission.encode_event":["保留“检查单事件大小和等待队列容量”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_admission_check_capacity_frame":["保留“检查单事件大小和等待队列容量”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/admission.ts","export":"CheckCapacity"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.admission.check_capacity",
  "node_type": "vibeflow.node"
});

export const era_tavern_admission_check_event = defineNode({
  "display_name": "检查事件内容及服务是否仍可接收",
  "description": "接收来自聊天、界面、脚本或计时器的事件，检查来源和基本资料，并确认服务没有停止或进入严重故障。发现问题时记下拒绝原因，供后续返回给发起者。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"检查事件内容及服务是否仍可接收的请求和已有进度"}],"provides":[{"key":"era_tavern_admission_check_event_frame","type":"era.tavern.frame.admission.check_event","display_name":"检查事件内容及服务是否仍可接收的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_admission_check_event_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“检查事件内容及服务是否仍可接收”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_admission_check_event_frame":["保留“检查事件内容及服务是否仍可接收”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/admission.ts","export":"CheckEvent"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.admission.check_event",
  "node_type": "vibeflow.node"
});

export const era_tavern_admission_choose_admission = defineNode({
  "display_name": "决定接收事件还是返回拒绝原因",
  "description": "查看本次事件的格式、服务状态和容量检查结论。有效事件进入登记分支，有问题的事件直接返回相应原因，使入队与拒绝清楚分开。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.admission.check_capacity","cardinality":"exactly_one","display_name":"决定接收事件还是返回拒绝原因的请求和已有进度"}],"provides":[{"key":"era_tavern_admission_choose_admission_frame","type":"era.tavern.frame.admission.choose_admission","display_name":"决定接收事件还是返回拒绝原因的处理进度及结果"},{"key":"era_tavern_admission_choose_admission_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_admission_choose_admission_frame","route":"era_tavern_admission_choose_admission_route"}},"input_semantics":{"era.tavern.frame.admission.check_capacity":["保留“决定接收事件还是返回拒绝原因”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_admission_choose_admission_frame":["保留“决定接收事件还是返回拒绝原因”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_admission_choose_admission_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/admission.ts","export":"ChooseAdmission"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.admission.choose_admission",
  "node_type": "vibeflow.node"
});

export const era_tavern_admission_deliver_result = defineNode({
  "display_name": "把事件交给服务或加入等待队列",
  "description": "本次事件已被接收后，如果服务正在等待事件就立即交付，否则按先来先后放入队列。保留结果观察，让发起者最终能够收到相应处理确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.admission.choose_admission","cardinality":"exactly_one","display_name":"把事件交给服务或加入等待队列的请求和已有进度"}],"provides":[{"key":"era_tavern_admission_deliver_result_frame","type":"era.tavern.call.frame","display_name":"把事件交给服务或加入等待队列的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_admission_deliver_result_frame"}},"input_semantics":{"era.tavern.frame.admission.choose_admission":["保留“把事件交给服务或加入等待队列”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_admission_deliver_result_frame":["保留“把事件交给服务或加入等待队列”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/admission.ts","export":"Deliver"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.admission.deliver_result",
  "node_type": "vibeflow.node"
});

export const era_tavern_admission_encode_event = defineNode({
  "display_name": "为事件准备可传递资料和身份",
  "description": "将事件参数整理为主服务可读取的资料，给不能直接传递的页面对象保留本实例引用，并计算事件大小。格式或引用数量有问题时记录拒绝原因，供容量检查及入队判断使用。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.admission.check_event","cardinality":"exactly_one","display_name":"为事件准备可传递资料和身份的请求和已有进度"}],"provides":[{"key":"era_tavern_admission_encode_event_frame","type":"era.tavern.frame.admission.encode_event","display_name":"为事件准备可传递资料和身份的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_admission_encode_event_frame"}},"input_semantics":{"era.tavern.frame.admission.check_event":["保留“为事件准备可传递资料和身份”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_admission_encode_event_frame":["保留“为事件准备可传递资料和身份”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/admission.ts","export":"EncodeEvent"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.admission.encode_event",
  "node_type": "vibeflow.node"
});
