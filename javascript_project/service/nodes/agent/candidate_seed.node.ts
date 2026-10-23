import {defineNode} from "@vibeflow/plugin";

export const era_agent_candidate_seed = defineNode({
  "display_name": "准备本次生成尝试及失败恢复起点",
  "description": "接收即将执行的模型生成请求，记住原任务、所属批次和本次允许保留的历史。替换旧阶段时先恢复较早阶段已经完成的变量与函数；恢复失败就返回原因，避免在错误起点上继续生成。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.generation.request","cardinality":"exactly_one","display_name":"本次模型生成要求与聊天起点"},{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"candidate_state","type":"era.agent.candidate.state","display_name":"本次生成尝试的请求和恢复起点"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.generation.request":["包含当前生成阶段、模型设置、提示资料及所属聊天，供本次模型调用和文字指令处理使用。"],"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"candidate_state":["记录本次模型尝试的请求、原任务及出错后应恢复的状态，供生成、指令应用和允许的重试共同使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/candidate_seed.ts","export":"run"}}],
  "base_libs": ["era.service.agent_session_binding"],
  "capabilities": [{"id":"era.tavern.sidecar","operations":["read_working","write_working"]},{"id":"era.tavern.agent","operations":["read_session_binding","write_session"]}],
  "tags": ["Agent候选"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.candidate_seed",
  "node_type": "vibeflow.node"
});
