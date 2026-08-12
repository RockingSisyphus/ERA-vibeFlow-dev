# Tavern Helper / SillyTavern 上游兼容性治理

## 目标

让 `app/@types/**` 保持为可追溯的开发输入，而不是无来源、无验证地复制上游文件。上游更新不是
自动合并：ERA 对事件顺序、生成 barrier 与宏时机有额外要求，类型通过不代表运行时语义兼容。

## 更新流程

1. 记录候选上游仓库、tag/commit、发布日期、Tavern Helper 与 SillyTavern 版本范围。
2. 对 `app/@types/**` 做最小 diff，按新增、修改、删除、弃用四类列出影响接口。
3. 把影响映射到 ERA adapter、Service capability、宏、UI 和测试；特别审查事件参数、Promise
   等待语义、聊天/swipe 数据结构和 `registerMacroLike` 时机。
4. 先更新 planned 变更清单并取得批准，再更新类型与使用代码。
5. 运行 TypeScript/合同测试；对有语义风险的接口，在受控真实酒馆或 Harness 中验证实际行为。
6. 将最终版本证据、兼容结论和未覆盖风险写入本仓迁移/发布记录。

## 禁止事项

- 不以类型文件存在为由宣称用户当前环境一定可用；
- 不直接从上游覆盖 ERA 自有声明或跳过 diff；
- 不为兼容旧 API 而绕过 Service、宏同步或生成 barrier；
- 不在未经授权的真实聊天中用生成、删除、回滚操作做探针。

## 当前定位

现有 `app/@types/**` 是当前本地开发基线。它们的更新时间可由 Git 追溯；在尚未完成上述审计前，
不应把它们表述为“自动跟随最新上游”。
