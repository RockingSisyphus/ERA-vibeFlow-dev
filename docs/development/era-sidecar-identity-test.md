# ERA Sidecar 身份识别测试设计

## 当前边界

本设计只验证未来 Sidecar 持久化所需的“当前聊天属于谁”的身份识别与安全重绑判定；它不创建
Sidecar 文件、数据库或外部存储，也不改写聊天记录、`ERAMetaData`、`stat_data`、宏或公开
`era:*` ABI。

测试通过受控聊天变量中的 `__eraSidecarTestV1` marker 模拟已保存 Sidecar 的拥有者。marker 只在
测试期间存在，测试结束和 service stop 都会被清除。

## 分层

```text
Pack 真实切卡 / 切聊天 / reload
  → Tavern Helper technical adapter（读取当前身份与 marker）
  → era.tavern.sidecar_test capability
  → VibeFlow observe_sidecar_test_identity node
  → 纯 sidecar_identity 分类规则
  → 测试报告槽，供 Artifact 采集
```

Host 只读取技术事实、发布 workflow 已产生的报告并在 stop 时清理报告；不拥有匹配、冲突或重绑
业务判断，也不注册额外 Tavern listener。分类规则只位于 `javascript_project/service/base_lib/sidecar_identity.ts`
并由 `observe_sidecar_test_identity` workflow node 调用。

因为 Tavern Helper 脚本可运行在同源 iframe，Pack fixture 与测试 adapter 都复用同一份生产身份
合同：`getCurrentCharacterId()` 提供稳定的角色卡 ID，Tavern identity context 提供 `groupId`、
`chatId`，受控 loader 提供 script ID。特别地，不能以会随切卡/聊天变化的
`SillyTavern.characterId` 索引作为 Sidecar 绑定主键。这条路径仅在 Pack session fixture 已启用时
使用。

## 报告合同

报告只包含下列字段：

```text
status: matched | rebind-approved | conflict | unbound | invalid | not-applicable
currentIdentity
markerOwner
reason
```

- `matched`：当前身份与 marker owner 完全一致。
- `rebind-approved`：marker 可迁移，且 fixture 明确标记旧 owner 已退役；这只是建议，不会实际迁移数据。
- `conflict`：旧 owner 仍可能有效，禁止自动绑定。
- `not-applicable`：当前聊天没有 marker。
- `invalid`：marker 结构或版本错误。
- `unbound`：marker 合法但不属于当前聊天/脚本。

## 真实测试范围

`era-sidecar-identity` 使用 Harness 的真实创建聊天、切聊天、切角色和 reload 能力，覆盖精确匹配、
同卡多聊天、跨卡切换、非 ERA 聊天、可批准重绑、冲突、损坏 marker、错聊天、reload 和 stop 清理。

这些路径必须以单 worker 运行，因为它们有意共享同一个真实 Tavern 页面和当前聊天身份；并发 worker
会使“当前聊天”这一宿主事实失去路径隔离。此限制是 Sidecar identity suite 的运行约束，不改变其他
ERA 测试的 worker 策略。

## 后续持久化实现前提

真正加入本地文件或数据库 Sidecar 时，应复用这里的身份 DTO 和分类结论，但另行审核：存储格式、
原子写入、清理/导入迁移、跨设备可移植性、用户可见恢复入口和数据丢失策略。本测试不能证明这些
尚未实现的持久化能力。
