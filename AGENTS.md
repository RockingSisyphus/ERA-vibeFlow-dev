# VibeFlow 开发入口

本项目工具链已升级到 VibeFlow 1.3.8，包含五个 JavaScript AOT root：异步领域服务 `javascript_project/service`、同步宏 `javascript_project/macro`、表达式 `javascript_project/expression`、命令压缩 `javascript_project/compaction` 和酒馆辅助流程 `javascript_project/tavern`。酒馆sync保持独立，async Config含operation/runtime两个命名入口，调用须显式填写options.entry。工具链与等价声明迁移已完成；Macro共享转换和Tavern五职责普通分支已实现并通过原生执行探针。剩余结构整治和当前业务验收状态见交接；旧0.20.0的495/924历史成绩不构成新版验收。先阅读所选root的 `vibeflow_project.jsonc`、`root_rules.jsonc` 和已登记的Architecture，沿真实source定位Config、NodesetType、Node、BaseLib或Plugin包。生成文档只通过VibeFlow命令更新，具体状态见交接。

按任务阅读规范：

- 修改 workflow、Config 或 edge：[`kernel/docs/user/workflow-and-config.md`](kernel/docs/user/workflow-and-config.md)
- 查阅 Python Target 接口（本项目当前不使用）：[`kernel/docs/user/python-development.md`](kernel/docs/user/python-development.md)
- 开发 JavaScript/TypeScript Node：[`kernel/docs/user/javascript-development.md`](kernel/docs/user/javascript-development.md)
- 开发 Nodeset 或 Loop：[`kernel/docs/user/nodeset-types-and-loops.md`](kernel/docs/user/nodeset-types-and-loops.md)
- 定义或选择 Rule / Ruleset：[`kernel/docs/user/rules-and-nodes.md`](kernel/docs/user/rules-and-nodes.md)
- 开发 Plugin、Capability 或 Host Extension：[`kernel/docs/user/plugins-and-integrations.md`](kernel/docs/user/plugins-and-integrations.md)
- 登记多文件实现与源码归属：[`kernel/docs/user/multifile-resources.md`](kernel/docs/user/multifile-resources.md)
- 升级旧资源声明及 API：[`kernel/docs/user/rule-system-migration.md`](kernel/docs/user/rule-system-migration.md)
- 查询运行日志与状态：[`kernel/docs/user/runtime-observation.md`](kernel/docs/user/runtime-observation.md)
- 配置命名入口或独立 Workflow 通信：[`kernel/docs/user/workflow-coordination.md`](kernel/docs/user/workflow-coordination.md)
- 开发并发任务、协作停止或等待退出：[`kernel/docs/user/graph-concurrency.md`](kernel/docs/user/graph-concurrency.md)
- 运行检查或解释结果：[`kernel/docs/user/commands-and-results.md`](kernel/docs/user/commands-and-results.md)

1.3.8使用固定 `@vibeflow/plugin` SDK。业务Node位于 `nodes/`，以 `id` 声明并引用 `node_type`；Config调用以 `definition_id` 引用业务定义或NodesetType。Plugin位于独立 `plugins/<包名>/`，只贡献类型、规则、Schema、Capability及包内支持资源；独立BaseLib位于 `base_lib/`。支撑源码通过 `implementation_files` 登记，路径相对声明模块；源码实现引用沿用所属root路径。Node明确选择Ruleset，库引用用 `base_libs`。两级治理由 `project_rules.jsonc` 和 `root_rules.jsonc` 承担，不能用关闭默认规则掩盖归属错误。

Workflow / Plugin / Rule ABI分别为v10 / v4 / v3，AOT为v4。每项 `pipeline.inputs` 显式填写布尔 `required`。task_manager、task_targets、TaskRef、context.tasks、Host Extension与原生io调用已退役；普通Node通过授权的Capability完成收发。并发使用显式普通分支与独立all汇合，取消后须等待实际执行和异步finally完成。不得引入旧执行器回退、把context存入Session或在Node返回后用context回调遥控流程。作者函数按消息位置串行执行，并与当前Service任务协作完成提交和回执；通知终态及计时分别由自己的普通Loop处理。新一批planned图只用于审查，不作为运行证据。

完成修改后更新 Architecture，并执行适用的 validate、quality、build 和工作流执行探针。按结果中的实际证据报告完成状态。

# Collaborative profile

遵循[`人机协同开发协议`](kernel/docs/user/profiles/collaborative.md)：维护四类变更清单，以 planned 内容生成正式HTML审核快照，等待人类明确批准后实施获批变化。机器检查与人工批准分别报告。

# 酒馆运行时与 ERA 宿主路由

本文件保留全仓 VibeFlow 规则；不要把 Tavern Helper 的长篇接口说明复制到这里。涉及
SillyTavern、Tavern Helper、浏览器事件、ERA 宏、UI 或真实酒馆联调时，还必须按目标目录
读取更具体的 `AGENTS.md`：

- `app/**`：读取 `app/AGENTS.md`，其 `@types/**` 是本仓 Tavern Helper/SillyTavern 接口
  的唯一类型参考；实际可用性仍由已连接酒馆页面验证。
- `app/src/ERA变量框架/**`：额外读取该目录及 `service`、`macro` 或 `ui` 下的局部规则；
  ERA 业务状态不得绕过主 Service 规划及原生 Capability 执行路径直接修改。
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

## 本项目资料存放与清理

用户明确要求：本项目的源码、文档、报告、日志、备份、归档及临时资料只保存在当前开发目录内。不得向项目旁边、外部归档目录或其他项目目录写入本项目资料；过时内容直接删除，不以迁出归档代替清理。需要中间处理时优先使用内存，确需落盘则在本项目内使用独立临时位置并及时删除。此用户约束优先于通用临时目录skill的默认位置。已有外部工具链的共享服务及其自身数据不因本规则获得清理或搬移授权。

独立BaseLib需由每个workflow的 `base_lib.modules` 显式选择，包含实际使用的传递依赖；Node的 `base_libs` 和库的 `dependencies` 只描述依赖关系，不自动授予使用权限。Plugin贡献的库只随Plugin整包选择。
