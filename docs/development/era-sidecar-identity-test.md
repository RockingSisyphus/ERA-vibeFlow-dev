# ERA Sidecar 绑定、迁移与复制变量设计

## 当前边界

ERA 仍以聊天记录中的 ERA 指令为变量状态的可重放事实来源。本设计在聊天变量中只保存稳定的身份引用，并把一份可恢复的 `stat_data` 镜像存入当前 SillyTavern 用户的原生 files 目录；本轮不移除聊天中的变量数据或指令文本，因此不以缩小聊天文件体积为验收目标。

聊天变量的格式固定为：

```json
{
  "ERAMetaData": {
    "SidecarId": "era_chat_<uuid>"
  }
}
```

本地记录为版本化 JSON：

```text
sidecarId
├─ owner: characterId / groupId / chatId
├─ revision
├─ statData
└─ updatedAt
```

文件位于运行 SillyTavern 的设备或服务器的当前用户 files 目录。远程访问酒馆时，它位于远端酒馆服务器，而不是浏览器设备。

## 分层与唯一职责

```text
Pack 真实切卡 / 切聊天 / reload
  → Tavern Helper technical adapter（身份、聊天变量、原生 files、UI 通知）
  → era.tavern.sidecar capability
  → era.sidecar.binding Nodeset
      ├─ inspect_current
      ├─ resolve_choice
      ├─ publish_choice_prompt
      ├─ apply_resolution
      └─ persist_snapshot
  → 聊天变量与本地 Sidecar 记录
```

Host 只承担读写技术能力：读取当前身份与聊天变量、读写原生 files、提交 `SidecarId` 元数据、生成 ID、发布/清除 UI 提示。归属匹配、冲突判断、迁移/独立/复制事务以及恢复指令全部在 `javascript_project/service/configs/nodesets/sidecar_binding.jsonc` 的 Sidecar Nodeset 中，不散落在 Host、同步 planner 或 UI。

身份由 Tavern Helper `getCurrentCharacterId()`、群组 ID 和当前聊天 ID 组成。不能使用会随切换漂移的 `SillyTavern.characterId` 作为绑定主键。

## 绑定与冲突合同

- ERA 聊天无 `SidecarId`：首次同步创建 ID，写入聊天变量与本地记录。
- ID 的本地 owner 与当前身份一致：正常继续；每次正常 ERA 变量提交成功后异步镜像最新 `stat_data`。
- ID 的 owner 不一致：显示不可关闭的冲突弹窗。没有取消、关闭、背景点击或 Escape 路径。用户必须选择：
  - **迁移变量**：保持原 ID，将 owner 迁移到当前聊天；在最后一条 AI 消息追加标准 `VariableDelete`/`VariableInsert` 恢复指令，再完整同步得到原变量 A。
  - **创建独立变量**：生成新 ID，并按当前聊天记录重算得到独立变量 B。
  - **复制变量**：生成新 ID，把原镜像 A 转成同样可重放的恢复指令；得到初值 A，之后与原 ID 独立演进。
- 返回旧角色卡/聊天会因 owner 不再一致再次显示三选项，因此可以在多个角色卡版本之间往返迁移。
- 本地记录缺失、损坏、文件写失败、当前聊天没有 AI 消息可追加，或受保护变量不能安全恢复时，进入仅含“修复当前聊天”的阻塞状态；不会静默新建或部分写入。

迁移、复制与修复在写入前都会重新读取当前身份、聊天 ID、SidecarId 与记录 revision。用户切换角色卡后点击旧弹窗会 fail-closed，绝不会写到新聊天。

## 测试范围

`era-sidecar-binding` 使用 Harness 的真实创建聊天、切聊天、切角色、reload、页面生命周期、原生 `/api/files` 读写和真实 UI 点击。它覆盖首次绑定、同卡多聊天、跨角色卡、非 ERA 聊天、迁移、独立、复制、嵌套对象复制、返回旧卡再冲突、损坏记录修复、reload 与陈旧弹窗。

每条路径同时断言聊天 `ERAMetaData.SidecarId`、本地文件记录、最终变量、恢复指令、Service 结算、弹窗状态和跨聊天隔离。该套件必须单 worker 运行，因为当前 Tavern 身份是共享的真实页面状态。

## 不在本轮实现的能力

- 删除聊天中的 `stat_data`、EditLog 或 Variable 指令；
- 数据库/文件的跨设备同步、清理策略或文件体积优化；
- 将 Sidecar 状态提升为聊天记录之外的唯一事实来源。
