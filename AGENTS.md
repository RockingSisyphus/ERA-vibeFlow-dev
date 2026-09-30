# VibeFlow 开发入口

本项目使用四个 JavaScript AOT root：异步服务 `javascript_project/service`、同步宏 `javascript_project/macro`、表达式 `javascript_project/expression` 和命令压缩 `javascript_project/compaction`。先阅读所选 root 的 `vibeflow_project.jsonc` 和已登记的 `ARCHITECTURE.jsonc`，沿 Architecture 的 source 定位并修改真实 Config、Nodeset、descriptor 或 Node source；生成文档只通过 VibeFlow 命令更新。

按任务阅读规范：

- 修改 workflow、Config 或 edge：[`kernel/docs/user/workflow-and-config.md`](kernel/docs/user/workflow-and-config.md)
- 查阅 Python Target 接口（本项目当前不使用）：[`kernel/docs/user/python-development.md`](kernel/docs/user/python-development.md)
- 开发 JavaScript/TypeScript Node：[`kernel/docs/user/javascript-development.md`](kernel/docs/user/javascript-development.md)
- 开发 Nodeset 或 Loop：[`kernel/docs/user/nodesets-and-loops.md`](kernel/docs/user/nodesets-and-loops.md)
- 开发 Plugin、Capability 或 Host Extension：[`kernel/docs/user/plugins-and-integrations.md`](kernel/docs/user/plugins-and-integrations.md)
- 运行检查或解释结果：[`kernel/docs/user/commands-and-results.md`](kernel/docs/user/commands-and-results.md)

完成修改后更新 Architecture，并执行适用的 validate、quality、build 和工作流执行探针。按结果中的实际证据报告完成状态。

# Collaborative profile

遵循[`人机协同开发协议`](kernel/docs/user/profiles/collaborative.md)：维护四类变更清单，以 planned 内容生成正式审核图，等待人类明确批准后实施获批变化。机器检查与人工批准分别报告。

# 酒馆运行时与 ERA 宿主路由

本文件保留全仓 VibeFlow 规则；不要把 Tavern Helper 的长篇接口说明复制到这里。涉及
SillyTavern、Tavern Helper、浏览器事件、ERA 宏、UI 或真实酒馆联调时，还必须按目标目录
读取更具体的 `AGENTS.md`：

- `app/**`：读取 `app/AGENTS.md`，其 `@types/**` 是本仓 Tavern Helper/SillyTavern 接口
  的唯一类型参考；实际可用性仍由已连接酒馆页面验证。
- `app/src/ERA变量框架/**`：额外读取该目录及 `service`、`macro` 或 `ui` 下的局部规则；
  ERA 业务状态不得绕过 Service Host 直接修改。
- `javascript_project/service/**` 或 `javascript_project/macro/**`：读取对应 root 的局部规则；
  先遵循本文件的 VibeFlow review/validate/build 流程，再处理 Tavern 宿主边界。

跨越上述目录的修改（例如生成事件、回滚与宏）先读
[开发总览](docs/developer/开发总览.md)，再依照局部规则和登记Architecture定位源码。
文档职责及更新方式见[文档维护指南](docs/developer/文档维护指南.md)。

## 测试监控强制规则

执行全量综合测试、专项测试、单项测试或失败复跑前，必须读取并使用
`long-running-task-monitor` skill；不因测试数量少或预计耗时短而豁免。
这是用户明确指定的项目规则，覆盖 skill 的默认时长适用范围。跨轮测试按其心跳/目标模式
规则监控，不以持续手动轮询代替；短测试完成后直接验收，不留无用心跳。
具体记录、验收和收尾要求见 [开发总览](docs/developer/开发总览.md#测试职责)。

## 回归循环与工作流说明强制规则

真实业务测试、批量修复、定向复跑及断点续跑遵循[回归测试与问题处理](docs/developer/回归测试与问题处理.md)。先全量综合，再全量细则；一批问题跑完后统一归因、修复，先定向复跑失败路径再重跑全量。最终两套证据须对应同一最终 bundle 和测试定义，断点成绩须按原 ID 严格对账并称“分段覆盖通过”。细则额外检出的回退在当前任务修复，同时记录综合覆盖缺口，覆盖改进留主任务完成后处理。

用户明确覆盖长任务 skill 默认异常暂停调度：suite 安全活跃时，个别 Evaluator failed 不停止整套测试，也不暂停唯一心跳；跟踪至自然结束。无活跃作业后才在分析、编码或等待必要决定期间暂停。提示词必须写出测试结束后的独立审计、批量归因、定向复跑、下一套全量测试与收尾，不把失败报告当任务终点。健康后约 60 分钟检查，启动/恢复约 10 分钟，可靠近完成 ETA 可缩短。

所有 root 的 Config 调用、Node descriptor、Nodeset 的 `desc` 以及数据流说明必须遵循[文档维护指南](docs/developer/文档维护指南.md#节点与数据流说明规范)：适合中文的内容用中文，让不了解内部实现和相邻节点的人能单独读懂处理对象、具体动作、重要分支、结果和此处作用。以源码为事实，避免抽象短语、虚构职责和仅 tooltip 可读；正式图只由 VibeFlow 命令生成。
