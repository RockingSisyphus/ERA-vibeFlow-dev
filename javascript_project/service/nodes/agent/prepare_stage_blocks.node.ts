import {defineNode} from "@vibeflow/plugin";

export const era_lifecycle_prepare_stage_blocks = defineNode({
  "display_name": "准备执行模型文字里的变量和函数指令",
  "description": "将模型本次生成的文字整理成按顺序执行的消息内容，并保存尝试失败时要恢复的起点。规划阶段使用预定的 AI 消息位置，其他阶段使用已确认的目标消息，供共享指令流程逐项处理。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.generation.raw","cardinality":"exactly_one","display_name":"模型返回的待处理文字及阶段结果"}],"provides":[{"key":"block_step_state","type":"era.sync.block.step.state","display_name":"当前消息位置及待处理变量指令"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.generation.raw":["包含模型已经返回的内容及生成结论，其中变量和函数指令仍需交给消息流程应用。"]},"output_semantics":{"block_step_state":["记录正文当前位置、变量、函数及变更历史，供本轮处理指令、作者函数或消息结束。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/prepare_stage_blocks.ts","export":"run"}}],
  "base_libs": ["era.service.message_function_calls","era.service.mk_engine","era.service.sidecar_binding","era.service.sync_contracts","era.service.sync_work_preparation"],
  "capabilities": [{"id":"era.tavern.sidecar","operations":["read_working"]}],
  "tags": ["内存生命周期"],
  "rulesets": ["vibeflow.process"],
  "id": "era.lifecycle.prepare_stage_blocks",
  "node_type": "vibeflow.node"
});
