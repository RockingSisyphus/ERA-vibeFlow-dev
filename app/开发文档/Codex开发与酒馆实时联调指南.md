# Codex 开发与酒馆实时联调指南

本文说明如何不依赖 VS Code，在 Codex Desktop、Codex CLI 或普通终端中修改、构建并在酒馆网页里验证 ERA。

## 结论

项目已经具备 Codex 配置和项目提示词，原有源码及主要开发文档也不依赖 VS Code。此前真正由 VS Code 提供的是两项进程管理功能：

1. `.vscode/tasks.json` 启动 `pnpm watch`；
2. Live Server 在 `5500` 端口提供带 CORS 的项目文件。

现在项目根目录的 `pnpm dev` 已同时提供这两项能力，因此 VS Code 只保留为可选编辑器。

## Codex 配置与提示词

| 路径 | 用途 | 是否为 Codex 原生 |
| --- | --- | --- |
| `AGENTS.md` | 整个仓库的持久项目说明、开发约束和完成标准 | 是 |
| `.codex/config.toml` | 项目级 Codex 配置，目前注册 chrome-devtools MCP | 是 |
| `.agents/skills/*/SKILL.md` | 酒馆助手脚本、界面、MVU 等按任务加载的专项知识 | 是 |
| `.mcp.json` | 为仍读取该格式的其他客户端保留的兼容配置 | 否，Codex 不依赖它 |
| `.vscode/*` | VS Code 推荐插件、任务、调试入口和 Live Server 设置 | 否，可选 |

不再另建 Codex 自定义 prompt 文件。Codex 当前推荐把持续生效的仓库规则写入 `AGENTS.md`，把可复用的专项流程写成 `.agents/skills`；旧式 custom prompts 已被弃用。

项目根 `AGENTS.md` 当前小于 Codex 默认的 32 KiB 项目说明上限，可以完整加载。若未来文件继续增长，应把只对某个子目录生效的规则下沉到该目录的 `AGENTS.md`，而不是盲目提高上限。

## 一次性准备

需要：

- Node.js 24；
- pnpm 10；
- 已运行的 SillyTavern 与酒馆助手；
- 一个允许 Codex 通过 Chrome DevTools Protocol 连接的 Chrome/Chromium 实例；
- 在 Codex 中信任本项目，以允许加载项目级 `.codex/config.toml`。

安装依赖：

```bash
pnpm install --frozen-lockfile
```

`.codex/config.toml` 使用 `pnpx chrome-devtools-mcp@latest --autoConnect`。Codex Desktop 会读取这份项目配置；首次启动 MCP 时可能需要下载对应包，因此配置了 20 秒启动等待时间。

## 启动开发环境

在项目根目录运行：

```bash
pnpm dev
```

它会启动：

| 端口 | 服务 | 作用 |
| --- | --- | --- |
| `8000` | SillyTavern | 酒馆网页；通常由酒馆自己的启动方式提供 |
| `5500` | `pnpm serve` | 提供本项目源码及构建文件，并允许跨域读取 |
| `6621` | `pnpm watch` | webpack 编译及酒馆助手热更新通知 |

`pnpm dev` 不会启动 SillyTavern。它只替代 VS Code 的 Live Server 与监听任务；按 `Ctrl+C` 会同时停止这两个项目进程。

如只需要其中一项：

```bash
pnpm serve
pnpm watch
```

静态服务器默认只监听本机回环地址。需要修改时使用项目专用环境变量：

```bash
ERA_STATIC_HOST=0.0.0.0 ERA_STATIC_PORT=5501 pnpm serve
```

端口改变后，还必须同步修改酒馆助手中的本地导入 URL。热更新服务目前固定使用 `6621`，因为酒馆助手按该端口连接。

## 酒馆内的联调检查

让 Codex 通过 chrome-devtools 连接已打开的酒馆网页，然后依次确认：

1. 当前页面确实是正在运行的 SillyTavern，而不是静态文件服务器；
2. `酒馆助手 → 实时监听 → 允许监听` 已开启；
3. 浏览器 Console 中没有本地资源跨域错误；
4. `pnpm watch` 终端出现“成功连接到酒馆网页”；
5. 修改源码后出现重新编译与更新事件，并在页面或 Console 中观察到新行为。

调试 ERA 本体时还要检查酒馆助手脚本：

- 启用“ERA变量框架-本地导入”；
- 停用已发布的 ERA bundle；
- 避免本地版和发布版同时注册事件、宏与监听器。

切换脚本启用状态会改变当前酒馆运行环境。Codex应先读取并报告现状；只有任务明确要求进入本地联调时才进行切换，并在完成后说明最终状态。

## 推荐的 Codex 工作循环

1. 读取 `AGENTS.md` 以及与当前任务匹配的 `.agents/skills`。
2. 检查工作树，保留用户已有的未提交改动。
3. 确认 `8000`、`5500`、`6621` 服务与酒馆助手实时监听状态。
4. 读取相关源码和 `@types` 接口定义后再修改。
5. 等待 webpack 编译完成，通过酒馆页面、DOM 和 Console 验证实际行为。
6. 执行 `pnpm verify`。
7. 需要验证完整开发分发物时执行 `pnpm build`；只需生成 ERA 发布包时执行 `pnpm release`。

实时监听开启后，一般不需要每次修改都刷新酒馆或运行完整构建。若热重载失效，应先检查 `6621` 连接、监听开关及 Console，再决定是否刷新页面。

## 可以直接交给 Codex 的任务描述

```text
请按项目 AGENTS.md 和匹配的 .agents/skills 修改 ERA。
先检查当前工作树、8000/5500/6621 服务、酒馆助手实时监听，
再修改源码；通过酒馆页面和 Console 验证，最后运行 pnpm verify。
不要覆盖无关改动，也不要让本地 ERA 与已发布 ERA 同时启用。
```

这段文字只是一次性任务范围。长期规则应继续维护在 `AGENTS.md` 或项目技能中。

## 常见问题

### `5500` 端口已被占用

通常表示 VS Code Live Server 或另一个 `pnpm serve` 仍在运行。停止旧服务后再运行 `pnpm dev`。如果改用其他端口，还需修改本地导入 URL。

### `6621` 端口已被占用

已有 webpack 监听任务正在运行。不要重复启动 `pnpm dev`；直接确认旧任务是否来自当前项目并继续使用，或先正常停止旧任务。

### 改完源码但酒馆没有变化

依次检查：

1. webpack 是否重新编译成功；
2. 终端是否显示酒馆网页已连接；
3. “允许监听”是否开启；
4. 本地导入脚本是否启用；
5. 本地导入 URL 是否指向当前项目；
6. 是否错误地仍在运行已发布 bundle。

### Codex 没有浏览器工具

确认项目已被信任，重启 Codex 任务以重新加载 `.codex/config.toml`，并检查 Chrome 是否允许自动连接。源码编辑、`pnpm verify` 和构建仍可进行，但网页端实际效果在恢复浏览器连接前不能算完成验证。

## 与 VS Code 教程的对应关系

教程中的工作流仍然成立，只是启动入口不同：

| VS Code 教程步骤 | Codex/终端对应方式 |
| --- | --- |
| 推荐插件与编辑器能力 | Codex 直接编辑；格式、Lint、类型检查由项目命令负责 |
| Run Task / `pnpm watch` | `pnpm dev` 内置执行 |
| Go Live / Live Server | `pnpm dev` 内置的 `pnpm serve` |
| F5 打开 `localhost:8000` | 连接用户已经打开的酒馆 Chrome 标签页 |
| 开启酒馆助手实时监听 | 完全相同，仍须在酒馆中开启 |
| 修改后查看热重载 | 完全相同，由 `6621` 推送更新 |

`.vscode` 配置不会删除，它仍可供习惯 VS Code 的开发者使用；但项目的构建与联调链路不再以它为必要条件。
