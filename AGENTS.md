# VibeFlow 开发入口

## 核心目标

把程序组织为可执行、可检查、可审阅的显式工作流，使业务职责、数据契约、控制关系和源码来源清晰可追踪。以小型 Node 承载单一职责，以 Nodeset 复用流程，保持架构视图与实际程序一致。

## 开发规范

- 开始开发先遵循[架构阅读与维护指南](kernel/docs/user/architecture.md)，再按任务修改真实源码。
- 从 `vibeflow_config.jsonc` 确定任务所属 root 和 Target，阅读该 root 的 README、项目配置及目标目录适用的 `AGENTS.md`。
- 将执行关系、资源依赖和外部边界明确表达在工作流及资源声明中；相同业务职责优先复用已有 Node、Nodeset 或 BaseLib。
- 按当前开发协议推进，完成与修改相称的检查、构建和执行验证，分别报告机器检查、实际执行与业务验收结果。
- 同步维护受影响的调用、契约和项目说明，使文档、架构与最终行为一致。

## 按目标查阅

文档入口为 [用户手册](kernel/docs/README.md)。按当前任务选择：

| 目标 | 文档 |
| --- | --- |
| 了解模型与能力 | [项目概览](kernel/docs/overview.md) |
| 优先了解项目、root 与 workflow 的架构 | [架构阅读与维护](kernel/docs/user/architecture.md) |
| 首次运行项目 | [快速开始](kernel/docs/user/quickstart.md) |
| 组织项目、root 与共享资源 | [项目治理](kernel/docs/user/project-governance.md) |
| 编写 workflow、输入输出和连边 | [Workflow 与 Config](kernel/docs/user/workflow-and-config.md) |
| 开发 Python Node、BaseLib 或部署 AOT | [Python 开发](kernel/docs/user/python-development.md) |
| 开发 JS/TS Node 或构建 AOT | [JavaScript 开发](kernel/docs/user/javascript-development.md) |
| 复用子图与循环 | [Nodeset 与 Loop](kernel/docs/user/nodeset-types-and-loops.md) |
| 定义、组合或选择检查规则 | [Rule 与 Node](kernel/docs/user/rules-and-nodes.md) |
| 开发 Plugin、生命周期或宿主 API | [Plugin 与集成](kernel/docs/user/plugins-and-integrations.md) |
| 拆分实现文件、声明库依赖或设置资源样式 | [多文件资源](kernel/docs/user/multifile-resources.md) |
| 管理分支并发、汇合与取消 | [普通图并发](kernel/docs/user/graph-concurrency.md) |
| 配置命名入口、调用或通信 | [Workflow 协同](kernel/docs/user/workflow-coordination.md) |
| 接入日志、状态与业务进度 | [运行观测](kernel/docs/user/runtime-observation.md) |
| 生成审核材料、浏览流程与历史 | [本地预览](kernel/docs/user/local-preview.md) |
| 选择命令、读取检查与执行结果 | [命令与结果](kernel/docs/user/commands-and-results.md) |
| 了解静态检查的覆盖范围 | [产品检查边界](kernel/docs/user/product-check-boundaries.md) |
| 升级旧配置与产物 | [迁移说明](kernel/docs/user/rule-system-migration.md) |

## 当前开发协议

采用 [人机协同开发协议](kernel/docs/user/profiles/collaborative.md)，按该文档规定的变更清单、架构审阅和人工批准顺序推进。

# ERA 项目约定

本项目工具链已升级到 VibeFlow 1.5.6，包含五个 JavaScript AOT root：异步领域服务 `javascript_project/service`、同步宏 `javascript_project/macro`、表达式 `javascript_project/expression`、命令压缩 `javascript_project/compaction` 和酒馆辅助流程 `javascript_project/tavern`。酒馆同步、异步操作、实例运行和并行读取使用独立 Workflow。同步、异步操作和实例运行各自共用一个业务处理节点，调用须显式填写 options.entry。工具链与等价声明迁移已完成；Macro共享转换和Tavern五职责普通分支已实现并通过原生执行探针。既有迁移已实施；当前构建和实际验收范围见开发交接。先阅读所选root的 `vibeflow_project.jsonc`、`root_rules.jsonc` 和已登记的Architecture，沿真实source定位Config、NodesetType、Node、BaseLib或Plugin包。生成文档只通过VibeFlow命令更新，具体状态见交接。

优先遵循[架构阅读与维护指南](kernel/docs/user/architecture.md)：先读项目 `PROJECT_ARCHITECTURE.jsonc`、目标root条目及相关workflow架构，再沿source定位真实源码。审核使用HTML；只有用户主动要求时才生成、打开或渲染SVG。工具链按本机 VibeFlow 1.5.6 协同分发同步；工具链更新与已验收业务包分开记录，当前结论见[交接说明](docs/developer/交接说明.md)。


当前工具链使用固定 `@vibeflow/plugin` SDK。业务Node位于 `nodes/`，以 `id` 声明并引用 `node_type`；Config调用以 `definition_id` 引用业务定义或NodesetType。Plugin位于独立 `plugins/<包名>/`，只贡献类型、规则、Schema 及包内支持资源；独立BaseLib位于 `base_lib/`。支撑源码通过 `implementation_files` 登记，路径相对声明模块；源码实现引用沿用所属root路径。Node明确选择Ruleset，库引用用 `base_libs`。两级治理由 `project_rules.jsonc` 和 `root_rules.jsonc` 承担，不能用关闭默认规则掩盖归属错误。

Workflow / Plugin / Rule ABI 分别为 v12 / v5 / v3，AOT 构建清单为 v6。每项 `pipeline.inputs` 显式填写布尔 `required`。task_manager、task_targets、TaskRef、context.tasks、Host Extension与原生io调用已退役；跨工作流节点通过原生 context.workflow 完成调用和收发，声明 workflow_operations，并在 Config 指明实际目标与入口。同页资源由所属实例通过本地输入传入。并发使用显式普通分支与独立all汇合，取消后须等待实际执行和异步finally完成。不得引入旧执行器回退、把context存入Session或在Node返回后用context回调遥控流程。作者函数按消息位置串行执行，并与当前Service任务协作完成提交和回执；通知终态及计时分别由自己的普通Loop处理。审核快照只证明结构已展示，执行成绩须来自对应实际AOT。

完成修改后更新 Architecture，并执行适用的 validate、quality、build 和工作流执行探针。按结果中的实际证据报告完成状态。

# 当前迁移状态

既有通信迁移与本轮原生候选修复方向、具体审核图及实施已获批准；同范围等价修复不重复请求方向批准。批准范围包含计算、酒馆资源操作、消息路径、Tavern生命周期、值封装和原有并行读取。当前工具链为 1.5.6。工具链验证和各版 ERA 正式包的验收分别见交接。当前正式包和实际验收范围见[交接说明](docs/developer/交接说明.md)。日常酒馆部署、推送与发布仍须单独授权。

# 酒馆运行时与 ERA 宿主路由

本文件保留全仓 VibeFlow 规则；不要把 Tavern Helper 的长篇接口说明复制到这里。涉及
SillyTavern、Tavern Helper、浏览器事件、ERA 宏、UI 或真实酒馆联调时，还必须按目标目录
读取更具体的 `AGENTS.md`：

- `app/**`：读取 `app/AGENTS.md`，其 `@types/**` 是本仓 Tavern Helper/SillyTavern 接口
  的唯一类型参考；实际可用性仍由已连接酒馆页面验证。
- `app/src/ERA变量框架/**`：额外读取该目录及 `service`、`macro` 或 `ui` 下的局部规则；
  ERA 业务状态不得绕过主 Service 规划及原生工作流执行路径直接修改。
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

用户2026-11-16指定：本项目自动化测试默认使用8并发（`workers=8`），配置相应8个独立worker origin和沙箱。路径数少于8时实际并发受路径数限制；原定义要求exclusive或坐标目标独占时遵循官方调度隔离，不绕过。并发调整不改变原路径、断言、事件或单动作预算。正在运行的批次只有用户明确要求时才中断，接续按原ID保留已独立审计完成路径，未完成路径从原起点重跑。

所有 root 的 Config 调用、Node descriptor、Nodeset 的 `desc` 以及数据流说明必须遵循[文档维护指南](docs/developer/文档维护指南.md#节点与数据流说明规范)：适合中文的内容用中文，让不了解内部实现和相邻节点的人能单独读懂处理对象、具体动作、重要分支、结果和此处作用。以源码为事实，避免抽象短语、虚构职责和仅 tooltip 可读；正式图只由 VibeFlow 命令生成。

新版 Harness 的同轮正式验收可按综合、细则顺序选择两套，细则依赖综合通过。跨套件的相同原 ID 可引用同一份合格实录，各套仍分别逐 ID 判定。恢复失败或前置套件阻塞时保留未执行状态；运行状态与当前新版验收范围见[森林实施验收](reports/测试效率探索/森林实施验收.md)。

## 本项目资料存放与清理

### 测试结果仅保留当前一份

按用户2026-11-12明确要求：过去的测试记录不保留，也不压缩后长期归档。只维护一份当前最新测试结果汇总；成功路径删除动作、截图、Console、trace、沙箱等详细记录。每条仍未解决的失败只保留一份最新详细证据用于分析；对应失败经后续验证解决后，立即删除其详细证据。旧批次、重复副本和已解决失败的记录同时清理。

汇总应保留当前结果的实际版本、范围、退出状态、逐ID状态与未执行项；删除记录不等于测试通过，不能跨版本拼接验收。当前任务状态说明和固定测试定义属于继续工作所需资料，不作为历史成绩收藏。活动作业输入、依赖和正在写入的输出先由当前作业使用；结束并审计后立即按上述规则收尾。审核资料只保留各工作流当前的一份，使用官方预览命令更新索引；不保留过时图卡。

用户明确要求：本项目的源码、文档、报告、日志、备份、归档及临时资料只保存在当前开发目录内。不得向项目旁边、外部归档目录或其他项目目录写入本项目资料；过时内容直接删除，不以迁出归档代替清理。需要中间处理时优先使用内存，确需落盘则在本项目内使用独立临时位置并及时删除。此用户约束优先于通用临时目录skill的默认位置。已有外部工具链的共享服务及其自身数据不因本规则获得清理或搬移授权。

独立BaseLib需由每个workflow的 `base_lib.modules` 显式选择，包含实际使用的传递依赖；Node的 `base_libs` 和库的 `dependencies` 只描述依赖关系，不自动授予使用权限。Plugin贡献的库只随Plugin整包选择。
