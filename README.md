# ERA 变量框架

ERA为SillyTavern角色卡提供变量、表达式、消息内函数调用和历史恢复。推荐使用外置状态栏，按需开启单层模式；传统楼内状态栏也可使用。

- [在线查看 VibeFlow 项目架构](https://rockingsisyphus.github.io/ERA-vibeFlow-dev/vibeflow-preview.html)
- [角色卡作者指南](docs/author/README.md)：从快速初始化到高级业务。
- [开发总览](docs/developer/开发总览.md)：工程边界、构建和验证。
- [交接说明](docs/developer/交接说明.md)：当前状态和限制。
- [文档维护指南](docs/developer/文档维护指南.md)：资料职责及更新方式。

使用 SillyTavern 1.19.0 或更新版本及酒馆助手，通过酒馆助手导入并启用已构建的 ERA 脚本。源码构建入口是app，业务使用VibeFlow JavaScript AOT；开发约束见[AGENTS.md](AGENTS.md)。

## 获取酒馆助手脚本包

在项目根目录运行 `pnpm --dir app release`。最新版位于 `app/artifact/bundle.js`，可直接在酒馆助手中导入。ERA 版本号取自 `app/package.json`，写在文件头。发布新版本时，被替换的包自动归档到 `app/artifact/archive/era-v<版本号>.zip`。
