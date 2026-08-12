# ERA 酒馆开发知识入口

这里存放面向 ERA 开发者和 Codex 的路由文档，不复制接口签名，也不替代 VibeFlow 自动生成的
Architecture。接口事实以 `app/@types/**` 为准，运行时可用性以已连接的 SillyTavern 页面为准。

| 需要解决的问题                              | 先读什么                                                                                               | 再定位什么                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Tavern Helper/SillyTavern API、iframe、事件 | [tavern-runtime.md](tavern-runtime.md)                                                                 | `app/@types/function/**`、`app/@types/iframe/**`                                |
| Service、回滚、事件组合、生成 barrier       | [era-host-contract.md](era-host-contract.md)                                                           | `javascript_project/service/ARCHITECTURE.jsonc` 与 source                       |
| `{{ERA:...}}` 宏                            | [era-host-contract.md](era-host-contract.md)                                                           | `javascript_project/macro/ARCHITECTURE.jsonc` 与 `app/src/ERA变量框架/macro/**` |
| ERA UI、设置、快照和视觉验收                | [era-host-contract.md](era-host-contract.md)                                                           | `app/src/ERA变量框架/ui/**`、`docs/testing/ERA前台UI测试需求.md`                |
| 真实酒馆联调                                | [../../app/开发文档/Codex开发与酒馆实时联调指南.md](../../app/开发文档/Codex开发与酒馆实时联调指南.md) | 浏览器页面、Console、8000/5500/6621                                             |
| 更新上游类型/兼容性判断                     | [upstream-compatibility.md](upstream-compatibility.md)                                                 | 上游发布说明、类型 diff、合同与真实联调                                         |

目录分层规则写在根 `AGENTS.md` 及各局部 `AGENTS.md`。若修改跨越 `app/**` 与
`javascript_project/**`，必须同时遵守二者的局部规则；不能以其中一层的便利性绕过另一层的边界。
