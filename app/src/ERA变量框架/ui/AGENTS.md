# ERA UI 宿主与表现层

此目录只负责 Vue/DOM 表现、用户意图收集和领域 UI 状态展示。UI 通过受限 ERA Service 调用与
`ERA.get()` / `ERA.subscribe()` 获取只读状态，通过 `ERA.sync()` 提交用户同步意图；不得直接调用世界书、
正则或变量 API 来改变 ERA 业务状态，也不得重复实现 Service 的同步/回滚逻辑。

修改前阅读：

- `../../../开发文档/ERA事件调度与生成栅栏设计.md`；
- `../../../../docs/testing/ERA前台UI测试需求.md`（功能/视觉验收范围）；
- `../../../../docs/development/era-host-contract.md`（UI 可用接口和禁止绕过项）。

交互范围只覆盖鼠标与触屏主路径。每个新增用户动作必须有 loading/busy、成功、失败和结算后的可观察状态；同一动作不得重入。组件卸载必须注销 listener、移除由本实例创建的 DOM/style，并避免跨 script
ID 破坏其他 ERA 实例。不要为测试目录暴露 CSS selector；测试可通过角色、文本、ID 和领域观察接口定位。
