import {defineNode} from "@vibeflow/plugin";

export const era_agent_execute_session_v2 = defineNode({
  "display_name": "执行本次规划、正文或结算生成",
  "description": "根据当前生成阶段和聊天进度，向模型请求规划或结算内容，或接续酒馆已经生成的正文。把得到的文字、变量指令和函数调用交给消息处理流程；取消、过期请求或失败会带着具体原因返回。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.generation.request","cardinality":"exactly_one","display_name":"本次模型生成要求与聊天起点"},{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"generation_outcome","type":"era.agent.generation.raw","display_name":"模型返回的待处理文字及阶段结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.generation.request":["包含当前生成阶段、模型设置、提示资料及所属聊天，供本次模型调用和文字指令处理使用。"],"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"generation_outcome":["包含模型已经返回的内容及生成结论，其中变量和函数指令仍需交给消息流程应用。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/execute_generation_session.ts","export":"run"}}],
  "base_libs": ["era.service.agent_flow_types","era.service.agent_generation_context","era.service.agent_generation_continue","era.service.agent_generation_planning","era.service.agent_generation_session","era.service.agent_generation_settlement","era.service.agent_session_binding","era.service.agent_stage_handoff","era.service.agent_stage_text","era.service.message_function_calls"],
  "capabilities": [{"id":"era.tavern.agent","operations":["await_native_completion","generate","generate_story","inject_once","read_session_binding","write_session","clear_session","create_error_message","stop_native_generation"]}],
  "tags": ["故事生成会话"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.execute_session_v2",
  "node_type": "vibeflow.node"
});
