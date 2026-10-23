# ERA 宏语法同源分发包

源码位于 `../../javascript_project/macro/base_lib/syntax/macro_syntax.ts` 和 `technical_blocks.ts`，分别登记为 Macro root 的宏标记语法库与技术块解析库，现有 Macro 工作流也消费这些源码。

本包供 Tavern 注册回调生成延迟标记，以及前端读取技术块结构。中文标签、DOM 和组件留在 App。普通宏、延迟宏替换与提示文本清理通过现有 Macro AOT 执行，不在这个包另存替换实现。

`npm run build` 从上述源码生成 JS、声明和入口；`npm pack` 先构建。生成文件不可手改，更新 tarball 后安装到 App。
