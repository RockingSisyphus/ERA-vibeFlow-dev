# ERA 变量框架

ERA为SillyTavern角色卡提供变量、表达式、消息内函数调用和历史恢复。推荐使用外置状态栏，按需开启单层模式；传统楼内状态栏也可使用。

- [在线查看 VibeFlow 项目架构](https://rockingsisyphus.github.io/ERA-vibeFlow-dev/vibeflow-preview.html)
- [角色卡作者指南](docs/author/README.md)：从快速初始化到高级业务。
- [开发总览](docs/developer/开发总览.md)：工程边界、构建和验证。
- [交接说明](docs/developer/交接说明.md)：当前状态和限制。
- [文档维护指南](docs/developer/文档维护指南.md)：资料职责及更新方式。

制卡使用已构建的ERA脚本，通过酒馆助手导入并启用。源码构建入口是app，业务使用VibeFlow JavaScript AOT；开发约束见[AGENTS.md](AGENTS.md)。

## 获取酒馆助手脚本包

在项目根目录运行 `pnpm --dir app release`。构建完成后，最新生成的 ERA 单文件脚本包位于 `app/artifact/bundle.js`，可直接在酒馆助手中导入并启用。
