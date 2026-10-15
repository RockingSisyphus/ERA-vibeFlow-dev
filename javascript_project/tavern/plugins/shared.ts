import {defineBaseLib, defineDataSchema} from "@vibeflow/plugin";
export const frames = defineBaseLib({
  id: "era.tavern.frames", display_name: "辅助流程内部输入与错误合同",
  description: "解包调用、严格汇合单结果及规范化错误；不选择或调度业务路径。",
  implementations: [{language: "typescript", targets: ["browser", "node"], source: {kind: "file", ref: "base_lib/frames.ts"}}],
  rulesets: ["vibeflow.data_store"],
});
export const resources = defineBaseLib({
  id: "era.tavern.resources", display_name: "Promise、时钟和取消资源原语",
  description: "创建局部等待句柄、链接取消信号和释放监听；行为顺序仍由 Node 和 Config 决定。",
  implementations: [{language: "typescript", targets: ["browser", "node"], source: {kind: "file", ref: "base_lib/resources.ts"}}],
  rulesets: ["vibeflow.data_store"],
});

export const contracts = defineBaseLib({
  id: "era.tavern.contracts", display_name: "ERA 既有传输合同",
  description: "复用官方 DTO 校验和默认限额，不复制合同。",
  implementations: [{language: "typescript", targets: ["browser", "node"], source: {kind: "file", ref: "base_lib/contracts.ts"}}],
  external_packages: ["@era/vibeflow-contracts"], rulesets: ["vibeflow.base_lib"],
});

export const receipts = defineBaseLib({
  id: "era.tavern.receipts", display_name: "单个回执资源结算",
  description: "原子结算当前明确指定的回执、释放其引用并触发回调；选择与遍历仍由 Node 和原生 Loop 执行。",
  implementations: [{language: "typescript", targets: ["browser", "node"], source: {kind: "file", ref: "base_lib/receipts.ts"}}],
  dependencies: ["era.tavern.frames"], rulesets: ["vibeflow.data_store"],
});

export const itemResultSchema0 = defineDataSchema({"type_key": "era.tavern.item.result.functions_release_reject_pending_item", "schema": {"type": "object"}});
export const itemResultSchema1 = defineDataSchema({"type_key": "era.tavern.item.result.stop_cancel_receipts_item", "schema": {"type": "object"}});
export const itemResultSchema2 = defineDataSchema({"type_key": "era.tavern.item.result.collection_control_apply_commands_item", "schema": {"type": "object"}});
export const itemResultSchema3 = defineDataSchema({"type_key": "era.tavern.item.result.messages_update_content_update_messages_item", "schema": {"type": "object"}});
export const itemResultSchema4 = defineDataSchema({"type_key": "era.tavern.item.result.settlement_settle_receipts_item", "schema": {"type": "object"}});

export const browser = defineBaseLib({
  id: "era.tavern.browser", display_name: "原始酒馆 API 与数据投影原语",
  description: "发现同一个真实酒馆宿主并转换原始数据；不持有会话、任务或调度机制。",
  implementations: [{language: "typescript", targets: ["browser", "node"], source: {kind: "file", ref: "base_lib/browser.ts"}}],
  rulesets: ["vibeflow.data_store"],
});

export const messages = defineBaseLib({
  id: "era.tavern.message_facts", display_name: "消息投影和固定保存依据",
  description: "保留原消息投影、陈旧目标比较和保存文件字段核对；不创建任务、不执行保存或调度。",
  implementations: [{language: "typescript", targets: ["browser", "node"], source: {kind: "file", ref: "base_lib/messages/persistence.ts"}}],
  implementation_files: ["../base_lib/messages/projection.ts", "../base_lib/messages/target.ts"],
  dependencies: ["era.tavern.frames", "era.tavern.browser"], rulesets: ["vibeflow.data_store"],
});

export const sidecar = defineBaseLib({
 id: "era.tavern.sidecar_facts", display_name: "Sidecar 身份、文件名与快照投影",
 description: "只验证输入记录、形成文件路径和快照；状态存储和发布由具体 Node 执行。",
 implementations: [{language: "typescript", targets: ["browser", "node"], source: {kind: "file", ref: "base_lib/sidecar/facts.ts"}}],
 dependencies: ["era.tavern.browser"], rulesets: ["vibeflow.data_store"],
});

export const agent = defineBaseLib({
 id: "era.tavern.agent_facts", display_name: "Agent 配置、预设与脱敏连接事实",
 description: "只验证输入和投影当前资料；设置读写、密钥使用和 HTTP 请求由具体 Node 执行。",
 implementations: [{language: "typescript", targets: ["browser", "node"], source: {kind: "file", ref: "base_lib/agent/facts.ts"}}],
 implementation_files: ["../base_lib/agent/profiles.ts"], dependencies: ["era.tavern.browser"], rulesets: ["vibeflow.data_store"],
});
