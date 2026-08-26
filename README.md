# ERA VibeFlow

ERA VibeFlow 是 ERA 的生产后继实现：异步业务服务和同步宏分别编译为两个
JavaScript/TypeScript AOT 模块，再由同一个 Tavern/webpack 应用入口装配。当前使用
VibeFlow 0.13.2，内部 contracts 版本为 1.6.0。

## 当前状态

ERA 已使用 Sidecar 用户文件作为唯一变量持久化源，聊天变量只保留
`ERAMetaData.SidecarId` 指针。公开写入只通过全局 `ERA` Facade 的即时
`commit()`；旧 `eventEmit('era:*')`、`writeDone`、`queryResult` 及外部
`forceSync` 合同已删除。安全命令压缩仅在消息封存时运行，且不跨
`message/branch/always` scope 边界合并。

## 工程边界

- `javascript_project/service`：异步 ERA Service，包含永久工作流、Host Extension、
  Capability、collection/planner、同步事务和公开 API。
- `javascript_project/macro`：同步 ERA Macro；不启用 Host Extension 或 Capability。
- `packages/era-contracts`：跨边界 DTO、Schema 和安全 JSON codec 的唯一来源。
- `app`：Vue/Pinia、webpack、Tavern adapter、唯一生产入口和差分测试 oracle。
- `generated`：VibeFlow AOT 构建输出，禁止手工修改。

## 表达式与函数

`<VariableEdit>` 和 `ERA.commit()` 用唯一数学操作 `$expr`：

```json
{
  "player": {
    "hp": { "$expr": "hp - damage" },
    "damageMultiplier": { "$expr": "damageMultiplier * 1.2" }
  }
}
```

目标和结果必须是有限数字。表达式支持顺序变量引用、层起始快照
`@path`、自定义函数与函数快照 `@f(...)`。函数库持久化在 Sidecar
`state.statFunc`；`$inc/$mul/$div/$sub/$set` 均被拒绝。

表达式还提供可重放的确定性随机函数：`random()` 使用当前消息 MK 和消息内自动抽取
序号，`random(seed)` 使用显式有限数值种子和自动序号，`random(seed, draw)` 同时固定
种子与非负安全整数序号。它不读取系统时间、`Math.random()` 或变量目标路径；因此同一
消息在 full sync、历史编辑恢复和切回既有 Swipe 时会得到相同结果。插入或删除更早的
自动随机调用会顺移后续序号，需要永久固定某次抽取时应使用三参数形式。

## Sidecar 唯一存储

ERA 聊天在 `ERAMetaData.SidecarId` 保存稳定的 `era_chat_<uuid>`，对应的
`statData`、`statFunc` 和 ERA 元数据只保存在当前 SillyTavern 用户 files
目录。聊天消息里的 Variable/Function 指令仍是可重放的历史事实，但 Tavern
聊天变量不再是业务状态来源。

当导入聊天或切换角色卡使同一个 ID 指向另一 owner 时，ERA 会显示不可关闭的三选项：迁移原变量、
创建独立变量、或复制原变量。迁移/复制以标准可重放的 ERA 指令写回当前聊天；返回旧卡会再次要求
选择，支持在多个角色卡版本间往返。详细合同见
[`docs/development/era-sidecar-identity-test.md`](docs/development/era-sidecar-identity-test.md)。

## 常用检查

```bash
python run.py verify-kernel
python run.py validate --config javascript_project/service/configs/era.service.jsonc
python run.py validate --config javascript_project/macro/configs/era.macro.jsonc
python run.py quality --path javascript_project/service
python run.py quality --path javascript_project/macro
pnpm --dir app verify
pnpm --dir app build
```

工作流或节点变更必须遵循根目录 `AGENTS.md` 的协同审核流程。当前文档入口见
[`docs/README.md`](docs/README.md)，当前待办见
[`docs/migration/TODO.md`](docs/migration/TODO.md)。
