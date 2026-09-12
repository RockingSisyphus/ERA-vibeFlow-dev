# ERA 生产工作流与职责

四个 root 的 Architecture 从各自 vibeflow_project.jsonc 登记的真实 Config 生成。修改 Config、Node 或库后，通过 VibeFlow CLI 更新；Architecture 与 SVG 不作为可编辑源码。

## 生产入口

| 调用方 | 实际调用链 | 返回与职责 |
|---|---|---|
| App Service 启动器 | generated/era-service/workflow.js → era.service → Service FIFO / service_step | 异步编排、唯一提交与来源回执 |
| Service 正式同步 | task_sync → prepareEraSync → message_block_step → advanceEraSyncBlock → CRUD → Expression AOT → commit_sync | 每块保存累计状态、回退日志与临时进度；完成楼层后清理进度 |
| 只读历史计算 | planEraSync → advanceEraSyncBlock（纯计算）→ CRUD → Expression AOT | 与正式执行共用块应用语义，不写回或调用外部工具 |
| Service 封存压缩 | command_compaction → @era/vibeflow-command-compaction/engine.compactCommandLayer | 同步委托 Compaction AOT；Compaction 负责分段，Service 选择楼层、CRUD 重放确认及回填 |
| Compaction 重放 | Expression 版本化包 | 与 Service 共用 Expression 0.3.0；Compaction 0.4.3 不再内嵌另一份 Expression |
| App 宏注册 | generated/era-macro/era-macro.js | 同步扫描、快照取值与格式化；不提交状态 |

App 自身直接使用的 Expression 算法也依赖 0.3.0。纯 UI 仍归 App；宿主 Capability 只执行被工作流请求的技术操作。表达式和压缩的公共 API 签名、返回格式与同步约定保持不变。

## Agent

同一 service_step 根据内部派发标签选择设置或生成 Nodeset。公开 PlannedStep.taskRoute 不变。

设置流程负责配置、预设、连接及模型列表。生成流程负责读取事实、判定阶段、准备请求、执行阶段及形成会话转换；候选通过原 legacy_sync 汇入唯一提交。设置与生成使用独立请求和 Capability 接口。会话关联的读取事实、策略决策、写入留在同一同步片段。

## 同步模块

| 模块 | 职责 | 依赖方向 |
|---|---|---|
| sync_contracts | 阶段类型、必要连续事实、共享输入断言、JSON/错误适配 | 已有类型和领域类型；不导入其他同步模块 |
| sync_planning | 规划输入投影、消息/状态规范化、调用同步引擎与形成工作项 | contracts、原同步/MK 引擎 |
| sync_result_policy | 来源回执、诊断、连续处理更新 | contracts 与领域类型 |
| sync_commit_policy | 提交候选、来源依据、读回判断、现有契约检查 | contracts；无提交候选的可结算性检查复用 result_policy |

提交策略复用结果映射是原 validateSyncCommitEnvelope 的真实行为：校验 non-commit 候选是否能形成可移植回执。保留这一单向依赖；结果模块不反向依赖提交或规划实现，不复制结果算法。

read_sync_context 在 Node 边界接收完整批次，但只提取连续 MK 与计数。Sidecar 上下文与 SyncPlanningInput 不携带批次队列、通知、步骤列表或回执集合。原 PlannedStep 保留同步所需的派发、目标及来源事实。merge_task_result 是批次更新的所有者。

task_sync 的顺序：Sidecar 准备 → 定位历史分歧并撤销旧效果 → 逐块循环（应用一块、构造累计提交、消息与 Sidecar 保存/读回）→ 最终呈现和结算。楼层起点快照与当前累计状态分开，随机偏移跨块连续传递。完成楼层的维护迭代清理临时进度并产生封存压缩候选；尾链不重复提交业务状态。

循环无业务块数上限，内存 cursor 只缓存位置。函数调用仅根据 status="done" 跳过；无 done 的调用返回可恢复 ERA_FCALL_NOT_IMPLEMENTED 并保留此前成功块，完整函数执行属于下一轮。

## 语义维护与验收

现行名称描述当前职责、输入和产出。历史变更见 reports/workflow-architecture-analysis-20260910 各步记录及 docs/migration；展示说明不再承载迁移叙事。

静态检查、AOT 执行探针和 App 本地测试不替代真实酒馆验收。本轮使用重新构建的固定分发物，经 ERA-Test-Pack 按项目约定 8 并发执行，分别核对业务评价、动作与必需证据。实施与验收状态见 reports/era-cleanup-review-20260912；历史阶段结果保留在原报告目录。
