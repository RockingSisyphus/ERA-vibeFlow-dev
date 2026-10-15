# ERA VibeFlow 异步 Service Root

本目录的 `vibeflow_project.jsonc` 与 `ARCHITECTURE.jsonc` 是异步 ERA 领域服务的入口和登记架构。
先沿 Architecture 的 `source` 定位真实 Config、Nodeset、SDK声明或 Node source，
不要修改 `generated/**`，也不要在 `app/src/**` 复制 planner 逻辑。

Tavern 边界：Service 只依赖运行选项接入的受限 Capability 提供的 JSON DTO，不可直接访问 DOM、
`window`、Tavern Helper 全局函数或浏览器事件。酒馆Capability/Port实现位于
`../tavern/`，浏览器Facade与展示端口位于`../../app/src/ERA变量框架/service/`；双方可共享的约束见
`../../docs/developer/开发总览.md`。

涉及生成、重新生成、swipe、编辑或回退时，必须阅读
`../../docs/developer/开发总览.md`。业务 planner 决定事件组合、定向同步和回退
目标；辅助workflow负责FIFO、receipt、生命周期与Capability执行。不要通过辅助流程特例、定时猜测或
宏侧补偿规避领域建模。

改动 workflow、Config、edge、Node 或 Nodeset 时遵循根目录协同协议：维护变更清单、生成 review，
获得明确批准后实现；随后更新 Architecture，并运行适用的 validate、quality、build 与执行探针。

节点、Nodeset、调用与数据流的中文说明遵循根 AGENTS 和[文档维护指南](../../docs/developer/文档维护指南.md#节点与数据流说明规范)。真实业务复测与失败处理遵循[回归测试与问题处理](../../docs/developer/回归测试与问题处理.md)，不以定向通过代替最终全量。
