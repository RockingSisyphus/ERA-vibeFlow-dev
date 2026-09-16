# ERA Service Host 适配层

这里不是领域规划器；它只将 Tavern Helper 运行时投影为 VibeFlow Service 所声明的 Port、Capability、event
receipt 与生命周期资源。领域行为的真实 source 位于
`../../../../javascript_project/service/**`，修改前必须先读取该 root 的 `AGENTS.md`、 `vibeflow_project.jsonc` 和
`ARCHITECTURE.jsonc`。

生成相关改动必须同时阅读 `../../../../docs/developer/开发总览.md`：

- `generation_started`
  的 Promise 是生成 barrier，只有相应 high-water 之前的 receipt 都进入终态才可解析；不得用超时自动放行。
- 宏只读取已提交快照；任何回退/同步必须在 barrier 放行前完成。
- detached 事件只入队，组合事件和回退目标由 VibeFlow planner 判断，不能在 adapter 中按事件名增加业务分支。

Tavern API 规则：使用 `eventOn`/`eventMakeFirst`、`eventRemoveListener`、`getChatMessages`、
`setChatMessages`、`getVariables`、`replaceVariables`
等高层 API，并在对应类型文件确认参数与返回值。直接 Host 调用是可观测副作用，必须可被测试记录；未计划调用应显式失败而非静默降级。
