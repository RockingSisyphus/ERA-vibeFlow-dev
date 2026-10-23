import {defineNode} from "@vibeflow/plugin";

export const era_workbench_read_baseline = defineNode({
  "display_name": "读取编辑草稿要对照的当前数据",
  "description": "读取当前聊天所绑定的独立状态文件，以及可用的内存变量和函数。把这份当前数据交给草稿检查和差异比较，确保编辑建立在真实现状上。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.api.commit.inspected","cardinality":"exactly_one","display_name":"已识别内容和消息范围的提交请求"}],"provides":[{"key":"baseline","type":"era.workbench.baseline","display_name":"当前聊天用于比较草稿的真实数据"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.api.commit.inspected":["包含本次变量提交及允许处理范围，供草稿转换和执行许可检查使用。"]},"output_semantics":{"baseline":["包含文件绑定、变量和函数，供确认草稿原值是否过期及规划修改。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/api/workbench_read_baseline.ts","export":"run"}}],
  "base_libs": ["era.service.sidecar_binding","era.data_view","era.workbench.context","era.workbench.operations"],
  "capabilities": [{"id":"era.tavern.sidecar","operations":["read_current","read_record","read_working"]},{"id":"era.tavern.identity","operations":["read"]}],
  "tags": ["工作台提交"],
  "rulesets": ["vibeflow.process"],
  "id": "era.workbench.read_baseline",
  "node_type": "vibeflow.node"
});
