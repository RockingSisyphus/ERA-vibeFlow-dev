# ERA VibeFlow 同步宏 Root

本目录的工作流入口模式必须保持 `sync`。它接收宏片段与已存 ERA 状态，返回替换文本；不得声明
异步 Capability、浏览器副作用、Service Port 调用、写入操作或 detached work。

浏览器侧 `registerMacroLike` 适配器位于 `../../app/src/ERA变量框架/macro/`，并只将已提交快照传入
本工作流。宏 API、生成 barrier 与公开语法边界见
`../../docs/developer/开发总览.md` 和
`../../docs/author/advanced/显示模式与状态栏.md`。

修改前必须读取本 root 的 `vibeflow_project.jsonc` 和 `ARCHITECTURE.jsonc`，再沿 `source` 修改真实
配置或节点。任何宏语义改变均为公开 ABI 变化：先维护变更清单并得到批准，之后重新生成 Architecture、
执行 VibeFlow 检查及 app 宏差分/集成测试。

节点、Nodeset、调用与数据流的中文说明遵循根 AGENTS 和[文档维护指南](../../docs/developer/文档维护指南.md#节点与数据流说明规范)。真实业务复测与失败处理遵循[回归测试与问题处理](../../docs/developer/回归测试与问题处理.md)，不以定向通过代替最终全量。
