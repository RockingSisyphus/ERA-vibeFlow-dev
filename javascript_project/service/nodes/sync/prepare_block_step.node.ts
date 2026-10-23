import {defineNode} from "@vibeflow/plugin";

export const era_sync_prepare_block_step = defineNode({
  "display_name": "恢复需要重算的消息历史起点",
  "description": "根据本次聊天变化确定重算范围，撤回相应旧变更记录，带入当前变量、函数、消息身份及随机使用记录。形成按正文顺序重新执行的起点；无需处理或无法准备时交出对应结论。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.context","cardinality":"exactly_one","display_name":"本次历史同步需要的消息和文件资料"}],"provides":[{"key":"block_step_state","type":"era.sync.block.step.state","display_name":"当前消息位置及待处理变量指令"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.context":["包含已选状态、处理范围及可能的绑定修复结果，供恢复消息执行起点。"]},"output_semantics":{"block_step_state":["记录正文当前位置、变量、函数及变更历史，供本轮处理指令、作者函数或消息结束。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/prepare_block_step.ts","export":"prepare"}}],
  "base_libs": ["era.service.sync_contracts","era.service.sync_work_preparation"],
  "capabilities": [],
  "tags": ["同步规划"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.prepare_block_step",
  "node_type": "vibeflow.node"
});
