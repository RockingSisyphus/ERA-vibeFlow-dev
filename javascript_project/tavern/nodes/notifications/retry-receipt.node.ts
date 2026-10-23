import {defineNode} from "@vibeflow/plugin";

export const era_tavern_generation_receipt_await_receipt = defineNode({
  "display_name": "先等待重试请求本身处理完成",
  "description": "接收用户发起的生成重试，等待它在主服务队列中的处理确认。后续检查是否还包含阶段交接，使公开结果可以覆盖完整重试。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"先等待重试请求本身处理完成的请求和已有进度"}],"provides":[{"key":"generation_receipt_await_receipt_frame","type":"era.tavern.frame.generation_receipt.await_receipt","display_name":"先等待重试请求本身处理完成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"generation_receipt_await_receipt_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“先等待重试请求本身处理完成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"generation_receipt_await_receipt_frame":["保留“先等待重试请求本身处理完成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/notifications/retry-receipt.ts","export":"AwaitReceipt"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_receipt.await_receipt",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_receipt_choose = defineNode({
  "display_name": "判断重试是否还需要等生成阶段",
  "description": "查看原重试处理结果是否带有阶段完成身份。有则继续等完整阶段交接，没有则直接返回原确认，避免把一个片段完成误认为整次生成结束。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_receipt.await_receipt","cardinality":"exactly_one","display_name":"判断重试是否还需要等生成阶段的请求和已有进度"}],"provides":[{"key":"generation_receipt_choose_frame","type":"era.tavern.frame.generation_receipt.chosen","display_name":"判断重试是否还需要等生成阶段的处理进度及结果"},{"key":"generation_receipt_choose_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"generation_receipt_choose_frame","route":"generation_receipt_choose_route"}},"input_semantics":{"era.tavern.frame.generation_receipt.await_receipt":["保留“判断重试是否还需要等生成阶段”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"generation_receipt_choose_frame":["保留“判断重试是否还需要等生成阶段”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"generation_receipt_choose_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/retry-receipt.ts","export":"Choose"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_receipt.choose",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_receipt_original = defineNode({
  "display_name": "直接返回无需阶段交接的重试结果",
  "description": "原重试请求已经形成最终确认且没有后续阶段时，直接交回该结果。调用方据此得到本次实际成功、失败或取消结论。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_receipt.chosen","cardinality":"exactly_one","display_name":"直接返回无需阶段交接的重试结果的请求和已有进度"}],"provides":[{"key":"generation_receipt_original_frame","type":"era.tavern.frame.generation_receipt.original","display_name":"直接返回无需阶段交接的重试结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"generation_receipt_original_frame"}},"input_semantics":{"era.tavern.frame.generation_receipt.chosen":["保留“直接返回无需阶段交接的重试结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"generation_receipt_original_frame":["保留“直接返回无需阶段交接的重试结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/retry-receipt.ts","export":"Original"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_receipt.original",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_receipt_await_handoff = defineNode({
  "display_name": "等待重试引起的完整阶段交接",
  "description": "根据重试结果中的阶段身份，等待规划、正文或结算的后续交接结束。取得最终结果或无结果状态，供公开重试调用返回。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_receipt.chosen","cardinality":"exactly_one","display_name":"等待重试引起的完整阶段交接的请求和已有进度"}],"provides":[{"key":"generation_receipt_await_handoff_frame","type":"era.tavern.frame.generation_receipt.await_handoff","display_name":"等待重试引起的完整阶段交接的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"generation_receipt_await_handoff_frame"}},"input_semantics":{"era.tavern.frame.generation_receipt.chosen":["保留“等待重试引起的完整阶段交接”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"generation_receipt_await_handoff_frame":["保留“等待重试引起的完整阶段交接”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/notifications/retry-receipt.ts","export":"AwaitHandoff"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_receipt.await_handoff",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_receipt_choose_final = defineNode({
  "display_name": "区分重试已完成还是生成会话取消",
  "description": "检查阶段交接是否形成最终处理确认。已有结果时采用完整结论，没有时按会话取消返回，让调用方不会一直等待旧生成。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_receipt.await_handoff","cardinality":"exactly_one","display_name":"区分重试已完成还是生成会话取消的请求和已有进度"}],"provides":[{"key":"generation_receipt_choose_final_frame","type":"era.tavern.frame.generation_receipt.final_choice","display_name":"区分重试已完成还是生成会话取消的处理进度及结果"},{"key":"generation_receipt_choose_final_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"generation_receipt_choose_final_frame","route":"generation_receipt_choose_final_route"}},"input_semantics":{"era.tavern.frame.generation_receipt.await_handoff":["保留“区分重试已完成还是生成会话取消”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"generation_receipt_choose_final_frame":["保留“区分重试已完成还是生成会话取消”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"generation_receipt_choose_final_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/retry-receipt.ts","export":"ChooseFinal"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_receipt.choose_final",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_receipt_completed = defineNode({
  "display_name": "返回完整重试结果并保留原请求身份",
  "description": "接收最终生成确认，同时沿用最初重试事件的身份和序号。原发起者据此得到整次重试的真实结果，而不会混淆中间阶段事件。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_receipt.final_choice","cardinality":"exactly_one","display_name":"返回完整重试结果并保留原请求身份的请求和已有进度"}],"provides":[{"key":"generation_receipt_completed_frame","type":"era.tavern.frame.generation_receipt.completed","display_name":"返回完整重试结果并保留原请求身份的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"generation_receipt_completed_frame"}},"input_semantics":{"era.tavern.frame.generation_receipt.final_choice":["保留“返回完整重试结果并保留原请求身份”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"generation_receipt_completed_frame":["保留“返回完整重试结果并保留原请求身份”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/retry-receipt.ts","export":"Completed"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_receipt.completed",
  "node_type": "vibeflow.node"
});

export const era_tavern_generation_receipt_cancelled = defineNode({
  "display_name": "向原重试请求说明生成已取消",
  "description": "阶段交接没有形成可用最终结果时，返回生成会话已取消，并保留原重试请求身份。调用方可以结束等待并显示对应状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_receipt.final_choice","cardinality":"exactly_one","display_name":"向原重试请求说明生成已取消的请求和已有进度"}],"provides":[{"key":"generation_receipt_cancelled_frame","type":"era.tavern.frame.generation_receipt.cancelled","display_name":"向原重试请求说明生成已取消的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"generation_receipt_cancelled_frame"}},"input_semantics":{"era.tavern.frame.generation_receipt.final_choice":["保留“向原重试请求说明生成已取消”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"generation_receipt_cancelled_frame":["保留“向原重试请求说明生成已取消”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/notifications/retry-receipt.ts","export":"Cancelled"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_receipt.cancelled",
  "node_type": "vibeflow.node"
});
