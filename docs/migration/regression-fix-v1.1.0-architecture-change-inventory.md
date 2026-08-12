# v1.1.0 三项回退修正架构变更清单

状态：`implemented_validation_pending_final_integrated_p2`

范围：只修改登记 Service workflow `javascript_project/service/configs/era.service.jsonc`
的真实导入链及内部 Data Schema。Macro workflow、公开事件 ABI 和持久化 Schema
保持不变。本轮先生成 planned 审核图，人工明确批准后才实现 TypeScript。

## 复用

| 对象 | 保留职责 | 原因 |
|---|---|---|
| `era.tavern.service_host` 与 `era.tavern.messages` | 单一监听器、FIFO、receipt、严格消息投影及取消 | 三项回退不来自 Host 生命周期或公开 Capability ABI |
| `era.dispatch.prepare_context` | 任务分类、MK/占位符确保和预提交 | 继续作为任务开始时处理身份的唯一来源 |
| `era.task.sync` | no-op、CRUD、协调、变量提交和通知主链 | 所有来源继续复用同一同步事务 |
| `era.api.write` 六路公开写 API | 指令构造、消息追加和通知次序 | API 集合及 `apiWrite → writeDone` 顺序不变 |
| `era.api.query` 五路公开查询 | 当前变量及 MK/MID 单点、区间查询 | 公开查询 payload 与事件类型不变 |

## 修改

| 对象 | 当前问题 | planned 变化 |
|---|---|---|
| `api_write.build_sync_step` | 复用写入前 `dispatchContext.messages` | 改为只消费已校验的提交后严格消息上下文，同时保留任务开始时的 processing message/MK |
| `task_sync.plan_sync` | 重新解析最新消息 MK，形成第二权威 | 改为使用不可变 processing MK；历史消息只负责各自 MK 与重算 |
| `task_sync` 提交链 | TaskResult/状态合同仅在提交后由外层验证 | 在任何同步 Capability 写入前增加显式合同校验分支 |
| `api_write.normalize_safe_object_payload` | 安全 codec 只覆盖公开对象 API | 继续作为公开严格入口，并与消息 CRUD、通知和查询共用统一 portable codec 语义 |
| `api_query.execute_snapshot_query` | 私有 `portable()` 通过未知键赋值，可触发 `__proto__` setter | 改为统一无原型 portable codec |

## 删除

| 对象 | 删除内容 | 原因 |
|---|---|---|
| `build_api_sync_step` | 写入前 dispatch message snapshot 透传 | 已确认消息提交后必须读回真实严格快照 |
| `sync_transaction` | 当前任务 MK 二次解析及空字符串内部 sentinel | processing MK 只能来自共享准备结果，内部缺失统一为 `null` |
| `execute_snapshot_query` | 节点私有 `portable()` | 防止形成第二套 JSON 边界和不安全未知键赋值 |
| CRUD/通知复制函数 | 分散的可移植对象克隆实现 | 统一 codec 后不再维护互相偏离的兼容规则 |

## 新增

| planned 调用 | 中文职责 | 连接位置 |
|---|---|---|
| `read_committed_messages` | 读取已提交消息快照 | `route_message_append(sync)` 之后 |
| `prepare_post_commit_context` | 校验并准备提交后同步上下文 | 读回严格消息后，分支为 ready/fatal |
| `build_post_commit_context_failure` | 构造提交后上下文失败 | fatal 分支进入统一 API finalizer |
| `validate_commit_candidate` | 校验同步提交候选 | `build_commit_request` 与 `commit_variables` 之间 |
| `build_sync_contract_failure` | 构造提交合同失败 | 校验失败时在写变量前结束同步任务 |
| contracts 1.4.0 | `EraDispatchContextV2` 与统一 portable JSON codec | Service 内部 ABI；不写入聊天变量 |

## 审核不变量

- 13 个公开输入事件、`era:writeDone`、`era:apiWrite`、`era:queryResult` 不变。
- stat/meta/MK/EditLogs 不增加运行时版本字段，Macro ABI 不变。
- 提交后读回失败、目标缺失/重复或文本不一致必须形成可结算 fatal，不能悬挂 receipt。
- `latest-message-with-mk` 的 processing MK 必须为非空字符串；内部不再使用 `""` 表示缺失。
- 自有 `__proto__` 子字段安全提升到同层，显式同层字段优先；`constructor` 和
  `prototype` 作为普通数据键；禁止修改 `Object.prototype`。
- 所有新增或修改的 `display_name`、`description` 使用中文；机器 ID/类型键保持英文。
- planned 节点统一使用 `planned_behavior: "blocking"`，不使用 stub；review 后停止等待人工批准。

## 正式审核证据

- `review` 顶层结果：`PASS`，结构验证 `PASS`，审核制品已发布。
- 源 Config planned 调用：9；登记 Architecture planned 对象：9。
- 展开 SVG planned 实例：18。数量高于 9 是因为 API 写入 Nodeset 被多条公开 API
  路由复用；18 个实例全部带 VibeFlow 原生 `plannedNode` 类，并使用黄色填充
  `#fef08a`、黄色描边 `#ca8a04` 和 `6 3` 虚线。
- 9 个预期中文名称在源 Config、Architecture 和 SVG 中均存在，缺失数为 0。
- Service/Macro 业务 JSONC 与登记 Architecture 的可读字段合计 2404/2404 含中文。
- `architecture --check` 与 `validate` 均通过；未运行 build，因为 planned 审核态不是
  可发布实现。
- Architecture SHA-256：
  `4651d12d5c271d8f8deef200e6862007c565f07612245a55440366359f11bd07`。
- expanded SVG SHA-256：
  `e0128de695199cf677a338eed0fab6b34e3e91ebdf205f2bbdaca7abdb06a89c`。
- 审核图：`reports/era-service-v1.1.0-regression-fix.expanded.svg`。
- 用户已明确批准本审核图；9 个调用均原位切换为 implemented。
- 实现化 Architecture SHA-256：`69e756ddacda5cd027ddeb77758d75b836cfcc456f5db1d858e891ae88862e60`。
- 实现化 expanded SVG SHA-256：`b030d9e3a67311be471916d8a8d4139e49d082779e9da0e8f8a4ba057221f84b`；文件为
  `reports/era-service-v1.1.0-regression-fix-implemented.expanded.svg`。
- contracts 1.4.0、统一 portable codec、提交后读回、processing MK 唯一权威和提交前
  合同校验已经实现；三条真实 Tavern 定点均 evaluation passed、Audit 零问题。
