# ERA 酒馆开发知识入口

这里存放面向 ERA 开发者和 Codex 的路由文档，不复制接口签名，也不替代 VibeFlow 自动生成的
Architecture。接口事实以 `app/@types/**` 为准，运行时可用性以已连接的 SillyTavern 页面为准。

| 需要解决的问题                              | 先读什么                                                                                               | 再定位什么                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Tavern Helper/SillyTavern API、iframe、事件 | [tavern-runtime.md](tavern-runtime.md)                                                                 | `app/@types/function/**`、`app/@types/iframe/**`                                |
| Service、回滚、事件组合、生成 barrier       | [era-host-contract.md](era-host-contract.md)                                                           | `javascript_project/service/ARCHITECTURE.jsonc` 与 source                       |
| `{{ERA:...}}` 宏                            | [era-host-contract.md](era-host-contract.md)                                                           | `javascript_project/macro/ARCHITECTURE.jsonc` 与 `app/src/ERA变量框架/macro/**` |
| 托管状态栏模板、按楼读取与写入              | [ERA托管状态栏作者指南.md](ERA托管状态栏作者指南.md)                                                   | `statusbar-runtime.ts`、`era.snapshot.query` 与快速初始化资源规划               |
| ERA UI、设置、快照和视觉验收                | [era-host-contract.md](era-host-contract.md)                                                           | `app/src/ERA变量框架/ui/**`、`docs/testing/ERA前台UI测试需求.md`                |
| 单层模式、旧楼卸载及性能证据 | [ERA单层模式.md](ERA单层模式.md) | `single-floor-runtime.ts`、Pack `era-single-floor` 与单层 RPG 双版本 |
| 当前开放缺陷、真实表现与修复验收            | [../testing/ERA当前缺陷基线.md](../testing/ERA当前缺陷基线.md)                                         | 对应 ERA-Test-Pack 细则、综合 owner 与 Artifact                                |
| 多阶段规划、骰点、正文与变量结算            | [ERA三段式故事编排器初步设计.md](ERA三段式故事编排器初步设计.md)                                       | `AgentGenerationSession`、内建投影、辅助预设/模型与尝试卡内联 API               |
| Agent 角色卡配置与发布                      | [ERA-Agent角色卡作者配置指南.md](ERA-Agent角色卡作者配置指南.md)                                       | `data.extensions.era_agent` V2、导入导出与跨设备重新绑定                        |
| Agent 预设快照、连接方案与隐私              | [ERA-Agent预设快照与隐私边界.md](ERA-Agent预设快照与隐私边界.md)                                       | 脱敏快照、extension settings、密钥与 Artifact 边界                              |
| Sidecar 唯一变量存储、绑定、迁移与复制变量  | [era-sidecar-identity-test.md](era-sidecar-identity-test.md)                                           | `era.sidecar.store` Nodeset、technical adapter 与 `era-sidecar-binding` suite   |
| 真实酒馆联调                                | [../../app/开发文档/Codex开发与酒馆实时联调指南.md](../../app/开发文档/Codex开发与酒馆实时联调指南.md) | 浏览器页面、Console、8000/5500/6621                                             |
| 更新上游类型/兼容性判断                     | [upstream-compatibility.md](upstream-compatibility.md)                                                 | 上游发布说明、类型 diff、合同与真实联调                                         |

## 测试并发约定

按本轮用户约定，通过 ERA-Test-Pack 运行自动 suite 使用 `--workers 8`，包括 Sidecar、runtime、
UI 与完整回归。ST-Test-Harness 会为每条 path 创建独立 sandbox、ST origin、
浏览器上下文、Lab namespace 和 Artifact 目录。Project Config 必须先配置
`execution.maxWorkers: 8` 与 8 个唯一 `fixture.workerOrigins`；CLI `--workers` 只能降低
该值，不能在命令行提高项目上限。ERA 测试用户人工审核模式或 Harness 明确降级的
路径使用其实际并发数，不要为普通自动回归习惯性传入 `--workers 1`。

目录分层规则写在根 `AGENTS.md` 及各局部 `AGENTS.md`。若修改跨越 `app/**` 与
`javascript_project/**`，必须同时遵守二者的局部规则；不能以其中一层的便利性绕过另一层的边界。
