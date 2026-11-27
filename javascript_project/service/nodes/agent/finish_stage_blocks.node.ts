import {defineNode} from "@vibeflow/plugin";

export const era_agent_form_session_transition = defineNode({
  "version": "1.0.0",
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/finish_stage_blocks.ts","export":"FormSessionTransitionNode"}}],
  "display_name": "决定生成结果还需怎样保存或同步",
  "description": "查看本次生成及其指令应用结果，判断还需同步消息历史、确认消息标识，还是已经可以直接返回。保留原任务和可处理的消息范围，供后续把生成结果完成结算。",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"},{"type":"era.agent.generation.outcome","cardinality":"exactly_one","display_name":"本次生成及指令应用后的结论"}],"provides":[{"key":"agent_transition","type":"era.agent.session.transition","display_name":"生成后需要继续的消息处理"},{"key":"agent_execution_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"era.agent.generation.outcome":["包含生成阶段实际结果、已应用指令情况及下一步安排，供阶段交接和任务结算使用。"]},"output_semantics":{"agent_transition":["记录生成阶段是否还需历史同步、消息标识确认或直接返回，供外层选择相应流程。"],"agent_execution_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_generation_session","era.service.agent_session_binding","era.service.agent_stage_handoff","era.service.mk_engine","era.service.types"],
  "tags": ["Agent 工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.form_session_transition",
  "node_type": "vibeflow.node"
});

export const era_agent_prepare_stage_handoff = defineNode({
  "display_name": "准备阶段完成通知和下一阶段资料",
  "description": "本次规划、正文或结算阶段完成后，记录它的结果及下一阶段继续所需的资料。页面据此执行作者订阅的回调，回调结束后再决定是否继续生成，避免跳过阶段间安排。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.candidate.outcome","cardinality":"exactly_one","display_name":"生成尝试结束后的完整结果"}],"provides":[{"key":"handoff_outcome","type":"era.agent.generation.outcome","display_name":"本次生成及指令应用后的结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.candidate.outcome":["记录生成及文字指令处理的最终结论，供后续整理阶段交接和原请求确认。"]},"output_semantics":{"handoff_outcome":["包含生成阶段实际结果、已应用指令情况及下一步安排，供阶段交接和任务结算使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/finish_stage_blocks.ts","export":"PrepareStageHandoffNode"}}],
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_generation_session","era.service.agent_session_binding","era.service.agent_stage_handoff","era.service.mk_engine","era.service.types"],
  "tags": ["故事生成会话"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.prepare_stage_handoff",
  "node_type": "vibeflow.node"
});

