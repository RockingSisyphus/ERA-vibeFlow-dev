# ERA 同步宏适配层

宏回调由 Tavern Helper `registerMacroLike` 同步调用。此目录只能读取已经提交的 ERA 快照并调用 `@era/vibeflow-macro`
的同步工作流；不得等待 Promise、入队异步 Service 工作、写变量或把宏替换伪装成一次状态同步。

修改前阅读：

- `../../../../javascript_project/macro/AGENTS.md`、`vibeflow_project.jsonc` 和 `ARCHITECTURE.jsonc`；
- `../../../../docs/developer/开发总览.md` 的生成 barrier 与提交顺序；
- `../../../@types/function/macro_like.d.ts` 的注册签名。

`{{ERA:...}}` 与 `{{ERA-withmeta:...}}`
是公开兼容语法。变更解析语义、缺失值行为或元数据可见性必须先获批准，并配套宏差分/集成测试。宏正确性依赖生成 barrier 的先提交后读取顺序，不能在这里用重试、缓存延迟或 DOM 刷新掩盖 Service 侧问题。
