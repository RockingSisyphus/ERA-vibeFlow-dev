# ERA UI 宿主与表现层

此目录只负责 Vue/DOM 表现、用户意图收集和领域 UI 状态展示。UI 通过受限 ERA Service 调用与
`ERA.get()` / `ERA.subscribe()` 获取只读状态，通过 `ERA.sync()` 提交用户同步意图；不得直接调用世界书、
正则或变量 API 来改变 ERA 业务状态，也不得重复实现 Service 的同步/回滚逻辑。

修改前阅读：

- `../../../../docs/developer/开发总览.md`（宿主边界与测试职责）；
- `../../../../docs/author/advanced/显示模式与状态栏.md`（当前显示行为）；
- `../../../../docs/developer/文档维护指南.md`（维护来源与验证要求）。

交互范围只覆盖鼠标与触屏主路径。每个新增用户动作必须有 loading/busy、成功、失败和结算后的可观察状态；同一动作不得重入。组件卸载必须注销 listener、移除由本实例创建的 DOM/style，并避免跨 script
ID 破坏其他 ERA 实例。不要为测试目录暴露 CSS selector；测试可通过角色、文本、ID 和领域观察接口定位。
