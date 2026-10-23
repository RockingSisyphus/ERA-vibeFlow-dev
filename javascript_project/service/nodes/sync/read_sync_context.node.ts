import {defineNode} from "@vibeflow/plugin";

export const era_tavern_sync_read = defineNode({
  "display_name": "读取历史同步需要的消息与状态资料",
  "description": "读取当前聊天历史、处理进度、要求重算的位置及独立状态文件绑定和迁移资料。整理为历史同步的输入，读取失败时返回原因，供后续决定恢复范围。",
  "version": "1.0.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"sync_context","type":"era.sync.context","display_name":"本次历史同步需要的消息和文件资料"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"sync_context":["包含已选状态、处理范围及可能的绑定修复结果，供恢复消息执行起点。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/sync/read_sync_context.ts","export":"run"}}],
  "base_libs": ["era.service.sync_contracts"],
  "capabilities": [{"id":"era.tavern.sidecar","operations":["read_current"]}],
  "tags": ["同步宿主边界"],
  "rulesets": ["vibeflow.data_store"],
  "id": "era.tavern.sync_read",
  "node_type": "vibeflow.node"
});
