# `@era/vibeflow-contracts`

该目录是跨 app、Service AOT 和 Macro AOT 的公开 DTO、JSON Schema 与纯
codec 唯一来源。包本身不访问宿主，也不包含工作流调度逻辑。

规则：

- 只包含 JSON 可移植类型、Schema 和无 I/O 的 codec。
- 不导入 Tavern、DOM、Vue、VibeFlow node 或 Host Extension。
- runtime `schemaVersion` 不得写入 ERA 持久化变量。
- Service 与 Macro Data Schema 必须与本目录 `schemas/` 中的 canonical Schema
  结构等价；Service 的动态步骤、执行状态和收尾状态也在此固定，避免领域节点、辅助workflow
  与出站帧各自猜测字段。
- 1.2 的 `EraPlannedStepV1` 是严格 `execute | ignore` 联合：execute 必须携带
  完整 `EraDomainTaskV1` 与 `EraPlannedSourceV1[]`，ignore 必须携带原始原因；
  `TaskResult.stateUpdate` 只更新易失 Service 连续处理状态。
- 1.4 的 `EraDispatchContextV2` 把可更新的严格消息快照与不可变
  `processingMessage`/`processingMk` 分离；所有 JSON 边界共用
  `cloneEraPortableJsonV1()`。
- 两个内部 UI 初始化事件使用 `EraInitializeTaskV1.operation` 区分
  `resources` 与 `settings-update`，`app_ready` 固定为 `startup`；它们不属于公开
  13 API。
- `npm run check:schema-sync` 对 12 个 Macro descriptor 与 17 个 Service
  descriptor 执行结构等价检查，并核对传输参数、结算、通知、诊断及定时器命令
  在复合 Schema 中的嵌入结构。
- `args` 不限制参数总数；`max_host_refs_per_event` 只限制其中 `host-ref` 标签的数量，
  由原生辅助workflow的事件准入节点在接受事件前检查。
- `timer` 来源固定使用 `era.service.collection_timer`，并由 workflow 校验 token；
  迟到定时器不得关闭其他事件集。
- 所有 runtime DTO 默认拒绝未知字段；仅错误 `details` 允许保留可移植 JSON 扩展。
- 发布给各 AOT root 的依赖使用固定版本 tarball，并分别写入 npm lock。

1.11.0 将已存在的四种宏输入（present、missing、view、projection-only）、快照模式和延迟匹配字段统一到公共合同。维护 Macro Schema 后运行 `npm run sync:macro-schemas`，生成 root 的检查 descriptor 与 SDK 声明；不要分别维护三份 Schema。`check:schema-sync` 同时检查 descriptor、SDK 声明和公共入口的嵌入状态。类型由本包提供，工作流和节点不另建类型副本。该专项通过不代表完整 App 或真实酒馆业务验收。
