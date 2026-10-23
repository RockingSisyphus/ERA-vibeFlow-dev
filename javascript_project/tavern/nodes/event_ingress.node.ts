import {defineNode} from "@vibeflow/plugin";

export const era_tavern_event_ingress_branch_barrier_prepare = defineNode({
  "display_name": "准备需要等待状态更新的生成事件",
  "description": "接收需要在生成前等待的聊天事件，更新当前生成状态，取消已不适用的旧交接和作者调用，并标记本事件要等待处理完成。后续由统一事件入口接收，再等待相关状态就绪。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.event_ingress.choose_event","cardinality":"exactly_one","display_name":"准备需要等待状态更新的生成事件的请求和已有进度"}],"provides":[{"key":"era_tavern_event_ingress_branch_barrier_prepare_frame","type":"era.tavern.call.frame","display_name":"准备需要等待状态更新的生成事件的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_event_ingress_branch_barrier_prepare_frame"}},"input_semantics":{"era.tavern.frame.event_ingress.choose_event":["保留“准备需要等待状态更新的生成事件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_event_ingress_branch_barrier_prepare_frame":["保留“准备需要等待状态更新的生成事件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/event_ingress.ts","export":"PrepareBarrier"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts"],
  "id": "era.tavern.event_ingress.branch_barrier_prepare",
  "node_type": "vibeflow.node"
});

export const era_tavern_event_ingress_branch_enqueue_prepare = defineNode({
  "display_name": "准备普通聊天变化交给主服务",
  "description": "接收普通聊天事件，更新当前聊天及生成状态，清理已过期的作者调用和阶段等待。将该事件交给统一入队流程，后续处理不阻塞当前普通回调。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.event_ingress.choose_event","cardinality":"exactly_one","display_name":"准备普通聊天变化交给主服务的请求和已有进度"}],"provides":[{"key":"era_tavern_event_ingress_branch_enqueue_prepare_frame","type":"era.tavern.call.frame","display_name":"准备普通聊天变化交给主服务的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_event_ingress_branch_enqueue_prepare_frame"}},"input_semantics":{"era.tavern.frame.event_ingress.choose_event":["保留“准备普通聊天变化交给主服务”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_event_ingress_branch_enqueue_prepare_frame":["保留“准备普通聊天变化交给主服务”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/event_ingress.ts","export":"PrepareEnqueue"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts"],
  "id": "era.tavern.event_ingress.branch_enqueue_prepare",
  "node_type": "vibeflow.node"
});

export const era_tavern_event_ingress_branch_ignore = defineNode({
  "display_name": "结束无需交给主服务的内部事件",
  "description": "事件已被识别为辅助生成、ERA 自己写消息的回声或仅用于记录生成结束时，直接结束本次回调。相关结束事实已在读取阶段更新，不再重复排入业务队列。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.event_ingress.choose_event","cardinality":"exactly_one","display_name":"结束无需交给主服务的内部事件的请求和已有进度"}],"provides":[{"key":"era_tavern_event_ingress_branch_ignore_frame","type":"era.tavern.frame.event_ingress.choose_event","display_name":"结束无需交给主服务的内部事件的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_event_ingress_branch_ignore_frame"}},"input_semantics":{"era.tavern.frame.event_ingress.choose_event":["保留“结束无需交给主服务的内部事件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_event_ingress_branch_ignore_frame":["保留“结束无需交给主服务的内部事件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/event_ingress.ts","export":"Ignore"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts"],
  "id": "era.tavern.event_ingress.branch_ignore",
  "node_type": "vibeflow.node"
});

export const era_tavern_event_ingress_choose_event = defineNode({
  "display_name": "选择忽略、普通入队或等待处理后生成",
  "description": "根据事件性质和生成时机，选择忽略内部回声、普通入队，或接收后等待相关处理完成。模拟生成检查不会误走真实生成的等待路径，后续按选定方式准备事件。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.event_ingress.read_event_facts","cardinality":"exactly_one","display_name":"选择忽略、普通入队或等待处理后生成的请求和已有进度"}],"provides":[{"key":"era_tavern_event_ingress_choose_event_frame","type":"era.tavern.frame.event_ingress.choose_event","display_name":"选择忽略、普通入队或等待处理后生成的处理进度及结果"},{"key":"era_tavern_event_ingress_choose_event_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_event_ingress_choose_event_frame","route":"era_tavern_event_ingress_choose_event_route"}},"input_semantics":{"era.tavern.frame.event_ingress.read_event_facts":["保留“选择忽略、普通入队或等待处理后生成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_event_ingress_choose_event_frame":["保留“选择忽略、普通入队或等待处理后生成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_event_ingress_choose_event_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/event_ingress.ts","export":"ChooseEvent"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts"],
  "id": "era.tavern.event_ingress.choose_event",
  "node_type": "vibeflow.node"
});

export const era_tavern_event_ingress_read_event_facts = defineNode({
  "display_name": "识别聊天事件是否由 ERA 自己触发",
  "description": "读取酒馆事件及已登记规则，区分辅助模型生成、ERA 内部消息写入和普通聊天变化。记录酒馆生成结束事实，供后续决定忽略内部事件还是交给主服务。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"识别聊天事件是否由 ERA 自己触发的请求和已有进度"}],"provides":[{"key":"era_tavern_event_ingress_read_event_facts_frame","type":"era.tavern.frame.event_ingress.read_event_facts","display_name":"识别聊天事件是否由 ERA 自己触发的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_event_ingress_read_event_facts_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“识别聊天事件是否由 ERA 自己触发”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_event_ingress_read_event_facts_frame":["保留“识别聊天事件是否由 ERA 自己触发”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/event_ingress.ts","export":"ReadFacts"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts"],
  "id": "era.tavern.event_ingress.read_event_facts",
  "node_type": "vibeflow.node"
});

export const era_tavern_event_ingress_return_event = defineNode({
  "display_name": "普通事件返回，生成事件等待相关状态",
  "description": "接收事件入队的实际结论。普通事件结束当前回调；需要生成前等待且已被接收的事件，继续等待指定序号及之前的处理和阶段交接，避免模型过早读取变量。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.event_ingress.choose_event","cardinality":"exactly_one","display_name":"普通事件返回，生成事件等待相关状态的请求和已有进度"}],"provides":[{"key":"era_tavern_event_ingress_return_event_frame","type":"era.tavern.frame.event_ingress.result","display_name":"普通事件返回，生成事件等待相关状态的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_event_ingress_return_event_frame"}},"input_semantics":{"era.tavern.frame.event_ingress.choose_event":["保留“普通事件返回，生成事件等待相关状态”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_event_ingress_return_event_frame":["保留“普通事件返回，生成事件等待相关状态”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/event_ingress.ts","export":"ReturnEvent"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts"],
  "id": "era.tavern.event_ingress.return_event",
  "node_type": "vibeflow.node"
});
