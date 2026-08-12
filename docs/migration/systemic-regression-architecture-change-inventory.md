# 系统性兼容改进架构变更清单

状态：`approved_and_implemented`

范围：只修改登记 workflow `javascript_project/service/configs/era.service.jsonc` 及其
真实导入链；Macro workflow 保持不变。实现前使用正式 `review` 更新同一份
`javascript_project/service/ARCHITECTURE.jsonc` 和 expanded SVG。

## 复用

| source | id / edge / resource | 当前职责 | 保持原因 |
|---|---|---|---|
| `configs/era.service.jsonc` | `start → initialize_state → service_loop → end` | 永久异步服务入口与有界 carry | FIFO、取消和长期 loop 不属于本次根因 |
| `configs/nodesets/batch_execute.jsonc` | `plan_batch`、`validate_coverage`、`step_loop`、`finalize_batch`、`publish_batch` | 批次覆盖、128 步循环、结算和通知发布 | 继续保持来源恰好一次及 settlement → notification 顺序 |
| `configs/nodesets/service_step.jsonc` | `select_step`、五个任务分支、`merge_task_result` | 选择步骤、执行任务、推进索引 | 保留显式任务路由和失败后继续执行 |
| `configs/nodesets/task_api.jsonc` | 十三个公开 API 二级路由 | 区分 write/query/requestWriteDone/forceSync | 公开事件集合和路由保持不变 |
| `configs/nodesets/task_sync.jsonc` | no-op / CRUD / reconcile / commit / notification 主链 | 共享同步事务 | 继续作为所有同步模式唯一事务实现 |
| `configs/era.service.jsonc` | `era.tavern.service_host` | FIFO、Port、receipt、Capability 与生命周期 | 保持同一 Host Extension ID，不增加第二套监听器 |

## 修改

| source | id / edge / hook | 当前职责 | 精确计划变化 |
|---|---|---|---|
| `configs/nodesets/service_step.jsonc` | `dispatch_task` 及其五条 route edge | 直接把 selected step 路由到任务 | 原位替换为 planned `prepare_dispatch_context` nodeset；统一完成任务分类、严格消息读取、MK、占位符、预提交和 dispatch class，再输出同一五路 route |
| `configs/nodesets/service_step.jsonc` | `select_step → merge/task_*` data bypass | 向任务和 merge 提供原批次状态 | 改为从共享准备结果向任务和 merge 提供 prepared state 与封装 `EraDispatchContextV1` 的 routed step，防止任务绕过准备链且不增加并行上下文通道 |
| `configs/nodesets/task_sync.jsonc` | `read_sync_context` | 读取宽松消息和聊天变量 | 改为只接受 canonical message DTO及共享 dispatch context，不克隆 Tavern 原始消息 |
| `configs/nodesets/task_sync.jsonc` | `plan_sync`、`build_sync_notification` | 规划同步并推进连续 MK 状态 | 增加显式 dispatch class；只有 initialize/普通 sync 推进 carry，所有 API 来源计数固定为 1且不改变 carry |
| `configs/nodesets/task_sync.jsonc` | `build_commit_request`、`commit_variables` | 消息先行、变量后置的逻辑提交 | 消费统一消息写入 DTO，所有需刷新写入显式携带 `refresh=affected`，部分/未知提交继续 fatal |
| `configs/nodesets/task_initialize.jsonc` | `plan_resources`、`commit_host_resources` | 同时规划资源和消息占位符 | 删除其消息/MK/占位符职责，只保留设置、世界书和正则资源；消息准备只来自共享 nodeset |
| `configs/nodesets/task_update_mk.jsonc` | 整个内部 pipeline | 独立读取、推导并提交 MK/占位符 | 改为消费已准备步骤内的 `EraDispatchContextV1` 并仅生成 update-mk 结算，连续计数保持不变 |
| `configs/nodesets/api_write.jsonc` | `prepare_write_context → route_write → 六个 prepare_*` | 直接从 API 请求构造 CRUD 指令 | 在六路 decision 前加入 planned `normalize_safe_object_payload`；只对公开对象 payload 执行无原型安全兼容，路径/删除请求无损透传 |
| `configs/nodesets/api_write.jsonc` | `read_target_messages`、`build_message_append`、`commit_message_append` | 读取宽松宿主消息并规划/提交文本 | 改为严格投影读取；workflow 只声明 messageId、swipe 与 activeText，Host 原位保留附件及未知字段并执行 affected 刷新 |
| `configs/nodesets/api_write.jsonc` | `build_sync_step`、`sync_written_message` | 将已确认消息追加转成普通 sync | 显式携带 `dispatchClass=api`，禁止 API write 推进连续 MK carry |
| `configs/nodesets/api_query.jsonc` | `read_query_messages`、`execute_snapshot_query` | 读取宽松消息并执行快照查询 | 改为只消费 `era-active-message-v1` 严格 DTO，不把 Date、swipes_info、附件或宿主对象送入查询引擎 |
| `configs/nodesets/api_force_sync.jsonc` | `plan_force_sync`、`execute_sync` | API forceSync 复用共享 sync | 显式携带 `dispatchClass=api`，四种模式均不推进连续 MK carry |
| `manifests/capabilities/messages.jsonc` 与 read-context schemas | `read_context` | `additionalProperties=true` 的宽松消息结果 | contracts 1.3.0 后要求 `projection=era-active-message-v1`，输出严格 `EraTavernMessageContextV2` |
| `manifests/host_extensions/service-host.jsonc` | `messages.read_context` provider | 转发 adapter 返回对象 | 只提供 canonical DTO；Date、`swipes_info`、宿主引用不跨边界 |

## 删除

| source | id / edge | 当前职责 | 删除原因及连接变化 |
|---|---|---|---|
| `configs/nodesets/service_step.jsonc` | `dispatch_task` | 只做任务分类 | 分类并入共享准备 nodeset，避免准备链与 route 分离 |
| `configs/nodesets/task_update_mk.jsonc` | `read_message_metadata` 至 `commit_mk` | update-mk 私有 MK/占位符事务 | 与 initialize/sync/API 重复；改由 service-step 共享准备链执行 |
| `configs/nodesets/task_initialize.jsonc` | 初始化资源计划中的 message placeholder action | 初始化时单独写消息 | 占位符只由共享准备链负责 |
| `base_lib/sync_transaction.ts` | 对完整 Tavern 消息执行 `cloneSyncJson` 的正规化路径 | 把宿主宽对象复制进领域消息 | strict DTO 已在 Capability 边界收敛，保留会再次引入 Date/宿主对象失败 |
| `nodes/update_mk/**` | 重复的 placeholder settings 读取、追加和提交实现 | update-mk 私有准备逻辑 | 实现批准后迁入共享 dispatch nodes/base_lib，旧文件无引用后删除 |

## 新增

| target source | 新 id / type | 职责 | 连接点 |
|---|---|---|---|
| `configs/nodesets/dispatch_prepare_context.jsonc` | `era.dispatch.prepare_context` | 统一任务分类、canonical 读取、MK/占位符计划、预提交、dispatch class 和 fatal 边界 | `service_step.select_step → prepare_dispatch_context → task_*` |
| 同上 | `classify_context`、`read_canonical_context`、`plan_message_preparation`、`preserve_prepared_context`、`commit_preparation`、`finalize_dispatch_context` | 展示共享准备链的 planned 内部职责 | 作为同一 planned nodeset body 进入 expanded SVG |
| contracts 1.3.0 | `EraTavernMessageV1`、`EraTavernMessageContextV2`、`EraDispatchContextV1`、`EraDispatchClassV1` | 严格运行时 DTO；不进入持久化变量 | Host/工作流内部 ABI |
| `configs/nodesets/api_write.jsonc` | `normalize_safe_object_payload` | `legacy-safe-object-v1` 无原型兼容正规化 | 写事务公共入口后、`route_write` 六路 decision 前 |
| Harness（架构审核后） | `era-contract-v1` Evaluator 与 suite summary | 根据当前 catalog 预期判断，不读取旧 Artifact；普通失败继续调度 | 所有 ERA path 完成后汇总 |

## 审核不变量

- 13 个公开输入事件、3 个公开输出事件不变。
- settlement、notification、Port、Host Extension ID 和生产监听器数量不变。
- 持久化 stat/meta/MK/edit log 不加入版本字段。
- Macro workflow 不变。
- 新增或修改的 `display_name`、`description` 全部使用中文。
- 本次 review 只批准架构，不等于实现批准；review 后等待用户明确确认。
