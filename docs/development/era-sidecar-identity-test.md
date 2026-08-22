# ERA Sidecar 唯一变量存储设计

## 当前边界

ERA 保留聊天消息中的 `<Variable*>` 指令，把它们作为能够重放的历史事实；但聊天变量不再保存 ERA 的实际状态。每个 ERA 聊天只保存一个稳定指针：

```json
{
  "ERAMetaData": {
    "SidecarId": "era_chat_<uuid>"
  }
}
```

`stat_data`、`SelectedMks`、`EditLogs` 与其余 ERA 聊天元数据只存在当前 SillyTavern 用户的原生 files 目录中的 Sidecar V2 文件：

```json
{
  "schemaVersion": 2,
  "sidecarId": "era_chat_<uuid>",
  "owner": {
    "characterId": "...",
    "groupId": null,
    "chatId": "..."
  },
  "revision": 1,
  "state": {
    "statData": {},
    "eraMeta": {}
  }
}
```

没有 `updatedAt`。`revision` 只用于拒绝陈旧的异步读写或旧冲突弹窗，不能替代业务状态。文件位于运行 SillyTavern 的设备或服务器的当前用户 files 目录；远程访问酒馆时，它位于远端服务器，而非浏览器设备。

## 分层与唯一职责

```text
Pack 真实切卡 / 切聊天 / reload
  → Tavern Helper technical adapter
      （身份、聊天指针、原生 files、内存快照、UI 通知）
  → era.tavern.sidecar capability
  → era.sidecar.store Nodeset
      ├─ inspect_pointer_and_identity
      ├─ load_or_migrate_state
      ├─ resolve_binding_choice
      ├─ commit_state
      ├─ publish_runtime_snapshot
      └─ apply_resolution
  → Sidecar V2 文件（唯一持久状态）
```

Host 仅承担读写技术能力：读取当前身份和聊天指针、读写原生 files、提交指针、发布/清除内存快照以及显示 UI。身份匹配、旧聊天迁移、冲突决策、状态事务和恢复指令全在 `javascript_project/service/configs/nodesets/sidecar_store.jsonc` 的 Service Nodeset 中；不能散落到 Host、同步 planner 或 UI。

身份由 Tavern Helper `getCurrentCharacterId()`、群组 ID 和当前聊天 ID 组成。不能使用会随切换漂移的 `SillyTavern.characterId` 作为绑定主键。

## 首次迁移与正常提交

- 旧 ERA 聊天没有 `SidecarId` 时，旧聊天的 `stat_data` 与完整 `ERAMetaData` 是一次性迁移的权威来源；即使旧 V1 镜像不同，也由旧聊天状态覆盖。
- 迁移顺序固定为：写入 V2 文件 → 回读验证 → 将聊天变量缩减为唯一指针 → 发布内存快照。任一步失败都会保留旧聊天状态，绝不出现“聊天已清空、文件未保存”。
- 已有 V2 文件时，只读取该文件；生产路径不会再把聊天变量当作状态降级来源。
- 同步、CRUD、MK 管理、查询和 `era:writeDone` 都提交或读取 V2 状态。文件写入失败不会发布新缓存，也不会把状态写回聊天变量；已写入的消息指令保留，后续完整同步可以重放。

宏只读取当前 ERA 页面实例的内存快照。该快照由 Sidecar 文件成功读取或写入后发布，不是持久化来源：切换聊天、身份不匹配、加载中、文件失败、reload、热重载、stop 或 pagehide 时均为空，宏不会使用上一聊天或聊天变量。

## 绑定与冲突合同

- ID 的本地 owner 与当前身份一致：正常继续，并在每次成功状态提交后更新 V2 文件与内存快照。
- ID 的 owner 不一致：显示不可关闭的冲突弹窗。没有取消、关闭、背景点击或 Escape 路径。用户必须选择：
  - **迁移变量**：保持原 ID，将文件 owner 迁移到当前聊天；在最后一条 AI 消息追加标准 `VariableDelete`/`VariableInsert` 恢复指令，再完整同步得到原变量 A。
  - **创建独立变量**：生成新 ID，并按当前聊天记录重算得到独立变量 B。
  - **复制变量**：生成新 ID，把原 V2 状态深拷贝为可重放恢复指令，得到初值 A；之后与原 ID 独立演进。
- 返回旧角色卡或聊天会再次触发同一三选项，因此可以在多个角色卡版本之间往返迁移。
- 本地记录缺失、损坏、文件写失败、当前聊天没有 AI 消息可追加，或受保护变量不能安全恢复时，进入仅含“修复当前聊天”的阻塞状态；不会静默新建或部分写入。

迁移、复制与修复在提交前都会重新读取当前身份、聊天 ID、SidecarId 与记录 revision。用户切换角色卡后点击旧弹窗会 fail-closed，绝不会写到新聊天。

## 测试范围

`era-sidecar-binding` 使用 Harness 的真实创建聊天、切聊天、切角色、reload、页面生命周期、原生 `/api/files` 读写和真实 UI 点击。该 suite 包含 24 条绑定与存储路径，覆盖：

- 首次绑定、同卡多聊天、跨角色卡、非 ERA 聊天；
- 迁移、独立、复制、嵌套对象深拷贝、返回旧卡再次冲突和陈旧弹窗；
- 旧聊天自动迁移、V1 文件升级、指针后聊天状态清除、V2-only reload；
- API 写入、AI 指令同步、相对更新、MK 更新、查询与 `writeDone`；
- 文件缺失、损坏、写入失败、迁移中断及无聊天变量回退；
- 切换、reload、热重载与 pagehide 时的宏快照隔离。

每条路径以 action-addressed evidence 同时断言聊天 `ERAMetaData.SidecarId`、聊天中不存在 ERA 状态字段、V2 文件 owner/revision/state、最终变量、真实 prompt、恢复指令、Service 结算、弹窗状态和跨聊天隔离。该 suite 单 worker 运行，因为当前 Tavern 身份是共享的真实页面状态。

```text
pnpm --silent era-test -- test --project <ST-Harness project> --era-bundle <ERA bundle> --suite era-sidecar-binding --workers 1
```

## 不在本轮实现的能力

- 剥离聊天消息中的 `Variable*` 指令或降低消息文本体积；
- 数据库或文件的跨设备同步、清理策略与容量优化；
- 文件失败时以聊天变量或内存缓存作为持久化降级存储。
