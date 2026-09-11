# ERA 消息内函数调用实施计划

更新日期：2026-09-11。

文档状态：需求与方案记录，尚未实施。本文描述当前源码基线、计划行为、变更范围和验收要求；接口细节见“待定设计”。本文不是功能已实现或已验收的证明，也不替代实施前的 VibeFlow 原位架构审核。

## 1. 目标

允许角色卡作者通过 SillyTavern 注册普通 JavaScript 工具函数，ERA 按消息内容中的出现顺序调用这些函数。函数可以使用条件、循环、字符串和异步逻辑，并通过绑定调用位置的 ERA API 读取和修改变量。

函数产生的 ERA 操作记录保存在调用位置下方。正式同步依据调用是否有“已处理”标记决定是否调用函数；已有标记时只重放保存的 ERA 操作。

本功能覆盖规划、正文、结算和历史消息编辑后的正式同步。消息内状态栏与外置脚本继续使用现有的已提交状态读取、目标消息末尾提交方式。

## 2. 当前实现基线

以下是本次核对的工作树源码行为，不代表当前酒馆页面加载的分发 bundle 已完成同等验收。

| 部分 | 当前行为与源码依据 |
| --- | --- |
| 消息指令 | `parseMessageCommands` 提取 VariableInsert/Edit/Delete 与 FunctionInsert/Edit/Delete，并按原文位置排序；`applyMessageCommands` 同步遍历完整列表。[CRUD 引擎](../../javascript_project/service/base_lib/domain/crud_engine.ts) |
| ERA 函数 | `statFunc` 与 `$expr` 支持有限数值表达式及自定义数值函数。[Expression 说明](../../javascript_project/expression/README.md) |
| 公开 API | `commit` 将独立事件送入 Service FIFO，并在完成消息及 Sidecar 保存后返回；常规读取使用已提交快照。[公开接口](../../app/src/ERA变量框架/service/public-api.ts) |
| 消息内状态栏 | 托管 Facade 绑定所在消息和 Swipe，等待状态就绪，操作追加到所在消息，随后重算受影响的历史。[状态栏指南](ERA托管状态栏作者指南.md) |
| 正式同步 | `planSyncWork`、`planEraSync` 和 CRUD 构成同步计算链，结果交给既有提交路径。[同步规划](../../javascript_project/service/base_lib/sync_planning.ts)、[同步引擎](../../javascript_project/service/base_lib/domain/sync_engine.ts) |
| Agent | 规划输出故事计划和数值函数调用表；独立结算接收 operations。开启独立结算时，正文 ERA 指令被隔离。[阶段执行](../../javascript_project/service/nodes/agent/execute_generation_session.ts)、[阶段纯逻辑](../../javascript_project/service/base_lib/agent_generation_session.ts) |
| 阶段交接 | 当前工作树已有成功阶段订阅及异步等待，完成后经内部事件恢复 Service；它提供阶段结果，尚未提供消息调用位置的变量上下文。[阶段订阅](../../app/src/ERA变量框架/service/generation-subscriptions.ts) |
| 酒馆工具 | 本地 SillyTavern 参考源码提供注册、同名覆盖、注销及按名称等待异步调用的能力。[ToolManager](../../references/SillyTavern/public/scripts/tool-calling.js) |

当前源码尚未提供本文计划的消息内 JavaScript 工具调用块、调用处理标记、调用位置 API 或异步逐块工具执行流程。

## 3. 已确定的行为

### 3.1 函数来源与调用参数

作者使用酒馆的函数注册系统定义工具，函数名、参数和处理逻辑由作者提供。同名覆盖及实际异步调用复用酒馆实现。ERA 为消息内调用增加适配，酒馆原生工具调用保持原有使用方式。

消息调用标记暂以 `<eraFCall>` 表达需求，准确语法、参数格式及调用上下文传递方式待定。模型提交调用名称和参数，执行的函数来自作者预注册的工具。

### 3.2 按位置执行与即时 API

正式执行按原文顺序处理普通变量指令和函数调用。到达无标记调用时，ERA 提供该消息运行到此处的变量状态，并等待函数完成。

函数中的 API 操作依次插入该调用所属操作区的末尾，由当前执行器应用。`await` 返回后，函数再次读取能看到已成功应用的操作。函数结束后，后面的消息指令从这个状态继续执行。

示例：

```text
HP = 100
调用 A
  A 读取 HP，得到 100
  A 调用 API 将 HP 改为 70
  API 操作应用后返回，A 再读取得到 70
HP = HP × 2
最终 HP = 140
```

保存后的逻辑顺序：

```text
HP = 100
调用 A（已处理）
A 产生的 ERA 操作：HP = 70
HP = HP × 2
```

操作记录保留作者提交的含义：提交 `$expr` 就保存表达式，提交固定值就保存固定值。当前执行器跳过本次已经应用的插入记录，避免再次计算。

位置上下文需要明确绑定到消息、调用位置和本次执行。异步等待期间，其他脚本的 API 调用仍使用自己的目标上下文。

### 3.3 调用标记与正式历史同步

- 每一处调用独立判断标记，相同函数名或相同参数的两处调用各自处理。
- 有“已处理”标记：跳过函数本体，继续执行其下方保存的操作。
- 无标记：尝试调用，记录实际成功产生的操作，并标记已处理。
- 成功但没有产生 ERA 操作的调用也会标记。
- 标记与操作记录作为消息内容保存；规划阶段先保存在本轮草稿。
- 用户编辑旧楼新增无标记调用，正式同步回放到该位置时执行它，再顺序影响后续操作和楼层。
- 修改已有标记的调用内容，本身不会触发重跑。移除标记后，下次正式处理会再次尝试；旧操作记录仍按消息内容执行，ERA 不擅自删除它们。

普通历史查询、状态栏快照计算、预览和压缩校验属于纯计算入口，不执行作者工具。需要执行的无标记调用由正式同步处理。

已有标记的函数不会因前面的历史改变而重新计算；后续效果由保存的表达式或固定值决定。

### 3.4 失败行为

函数中的 API 操作逐次生效。函数抛出未捕获异常或 Promise 拒绝时，结束此次调用、报告错误、保留已经成功的 API 操作，给调用标记已处理，然后继续后面的消息操作。

未注册函数同样报告错误并标记已处理，继续后续操作。自动同步不重试已有标记的调用。作者自行捕获异常后继续执行的，ERA 继续等待函数。

函数内部业务一致性、网络请求和其他外部副作用由作者负责。调用标记提供保存后的执行判断，不承诺执行与保存之间发生进程中断时，任意外部动作严格只发生一次。

单个函数发生部分失败，与整个生成会话取消是不同层次：前者保留本轮已成功操作，后者仍遵守本轮暂存和最终提交约定。

### 3.5 三阶段生成

```text
规划内容及调用
→ 处理规划操作，形成阶段状态
→ 将计划、调用结果及阶段状态提供给正文
→ 酒馆完成正文生成
→ 顺序执行正文中的变量指令和调用
→ 结算模型读取处理后的状态并补充操作
→ 完成最终消息与 Sidecar 保存
```

规划阶段的 API 操作写入本轮规划内容草稿，本轮成功后随最终消息提交。后续阶段能够读取规划处理后的临时状态。取消时不把规划操作转写到上一条 AI 消息。

正文调用在完整正文接收并完成必要的原生收尾后执行。开启独立结算时，正文变量指令与调用同样按顺序处理；结算输入和提示词需要表达已经执行的操作与当前状态，避免再次要求模型重复结算同一变化。

各阶段输出中的可执行内容需要有明确结构，报告中的引用文本不作为调用来源。

### 3.6 状态栏与外置 API

| 来源 | 读取状态 | 写入位置 | 调度 |
| --- | --- | --- | --- |
| 消息内函数 | 调用位置的当前状态 | 调用下方的操作区 | 当前执行器接续处理 |
| 托管消息内状态栏 | 所在楼层的已就绪状态 | 所在 AI 消息末尾 | 现有 FIFO |
| 外置脚本或状态栏 | 当前活动分支最新已提交状态 | 现有 API 选定的目标消息末尾 | 现有 FIFO |

消息内状态栏继续通过 `ERA.ready()` 等待状态，不以 iframe 已渲染代替结算就绪。旧楼状态栏写入旧楼，并沿现有流程重算后续历史。

scope 复用现有 `message`、`branch`、`always` 规则，不增加按函数名称去重。消息内调用位置与规划草稿如何适配现有生命周期窗口，需要在接口设计中写明。

## 4. 实施变更清单

### 4.1 复用

- SillyTavern 工具注册、同名覆盖、注销和异步调用器。
- ERA 普通增删改、保护规则、表达式求值、变量与函数日志。
- MK、Sidecar、历史协调、消息保存确认和最终状态发布路径。
- 消息内状态栏楼层绑定、就绪等待、末尾提交及外置 API 默认行为。
- ERA-Test-Pack 的 catalog、fixture、Evaluator、综合编排及现有 Harness/Bridge 接口。

### 4.2 修改

| 子系统 | 旧逻辑 | 计划修改 |
| --- | --- | --- |
| 解析器 | 一次提取六类 ERA 指令 | 识别调用块、标记及位置，维护可插入操作的顺序表示 |
| 正式执行 | 同步完成消息计算 | 支持调用处暂停、Host 执行工具、API 操作即时应用及继续执行 |
| API 路由 | 所有公开提交创建独立 FIFO 任务 | 保留外置路径，增加位置绑定调用的当前执行器路径 |
| API 读取与结果 | 以已提交状态和保存回执为中心 | 增加当前位置读取，明确“已应用到本轮状态”与“最终已保存”的返回语义 |
| 历史同步 | 重放已有指令 | 正式同步可处理无标记调用，并产生消息回写；已有标记仅重放操作 |
| Agent | 规划纯数值调用，独立结算隔离正文指令 | 承载规划操作草稿、正文有序执行和阶段状态传递；更新输出解析、提示词及结果组合 |
| Host 边界 | 提供既有 Tavern 技术能力 | 增加按名称调用酒馆工具、传递调用上下文和回送结果的技术能力；领域顺序与提交仍归 Service |
| 只读与试算 | 复用同步 CRUD | 保持纯计算，明确调用块的跳过和未执行信息，不触发工具副作用 |
| 压缩 | 对现有命令与事务分段处理 | 将调用标记及其操作位置作为保留边界，避免移动记录、丢失标记或触发工具 |
| 展示与提示投影 | 识别现有技术块 | 增加调用及标记的投影，报告显示副本与可执行原文分开 |
| 类型、文档和架构 | 描述现有指令/API/阶段 | 增加新合同，更新真实 descriptor、Config 及生成的 Architecture |

同步规划链目前是同步计算。正式执行需要可恢复的状态和异步编排接入，不能直接向纯 CRUD 函数混入浏览器回调。函数对象留在 Host，Service 与 Host 之间沿现有边界传递可序列化数据；具体调用上下文桥接方案见待定设计。

### 4.3 删除或替换

- 替换独立结算模式下隔离正文变量指令的行为、相关提示词及测试预期，使其符合新的顺序结算规则。
- 替换正式消息执行必须一次同步完成的调用路径；保留纯 CRUD 和只读计算的可复用部分。

本清单只针对当前存在的逻辑。讨论中的备选方案不构成待删除代码。

### 4.4 新增

- 消息调用及处理标记的语法、解析和保存规则。
- 位置绑定的 ERA API 上下文及工具调用 Host 适配。
- 正式执行暂停、继续和动态操作插入所需的最小执行状态。
- 调用结果、错误和已生成操作的诊断展示。
- 作者用法、scope 与重试说明、配套示例及完整测试细则。

## 5. 待定设计

以下尚未作为最终 API 承诺，实施前需要确定：

1. **调用语法与上下文传递。** 确定标签内容、命名参数格式，以及预注册酒馆回调如何取得位置绑定的 ERA 接口；避免依赖全局临时目标。
2. **操作记录格式。** 确定标记与调用所属操作区的文本结构、原文定位及保存方式，支持重复同名调用、编辑和多次追加。
3. **API 结果和 scope。** 明确消息内 API 的即时应用回执、最终保存边界，以及现有 scope 在旧楼调用和规划草稿中的适配。
4. **各阶段的输出承载。** 确定规划、正文、结算输出如何表示有序变量块和工具调用，及如何与现有规划数值调用表、结算 operations 协同。
5. **取消与中断收尾。** 正常同步仍按已处理标记判断；需要定义异步执行中切聊、取消及保存失败时上下文失效、草稿保留和错误报告的具体行为，不向新聊天写入旧任务结果。

## 6. 测试与验收

### 6.1 ERA 本地验证

- 解析：调用与六类既有指令混排、相同调用重复出现、带标记跳过、无操作标记、记录顺序和原文回写。
- 执行：`HP=100 → 调用改70 → HP×2=140`；异步等待、多次 API 提交和提交后读取。
- 失败：部分 API 成功后抛错、Promise 拒绝、未注册调用；成功操作保留、失败标记、后续操作继续。
- 重放：已标记函数不执行；保存操作只执行一次；前楼新增无标记调用正确影响后续楼层。
- 隔离：函数等待期间外置调用与状态栏点击不串目标；取消后的旧上下文不能继续写入。
- 纯计算：历史查询、快照、试算和压缩不执行工具，压缩保留调用及操作的必要位置关系。
- 兼容：普通 CRUD、数值函数、保护、scope、状态栏 API 与酒馆原生工具调用。

### 6.2 ERA-Test-Pack 全面验证

在 Pack 内新增工具注册脚本素材、调用专项 catalog 与业务 Evaluator，接入完整及综合回归。预期结果放在 Evaluator，不写进被测输入。

| 测试组 | 必须观察的结果 |
| --- | --- |
| 阶段组合 | 规划、正文、结算及开关组合中的调用；后阶段实际收到正确状态和函数结果 |
| 顺序执行 | 变量块中间插入多个同步/异步调用，读取值、操作顺序和最终状态正确 |
| 注册与失败 | 同名覆盖、未注册、无变量操作、部分成功后失败及后续继续 |
| 标记与持久化 | 原消息中标记与操作确实保存；刷新和正式重放不再次调用已有标记函数 |
| 历史交互 | 编辑旧楼新增调用、Continue、Swipe、重新同步及后续楼层重算 |
| 状态栏与外置脚本 | 所在楼/最新状态读取及末尾提交保持现有行为；与消息调用并发不串上下文 |
| 生命周期 | 停止、切聊、取消、保存失败及异步回调晚返回 |
| 既有能力 | 数值表达式、scope、原生工具调用和 Agent 既有生命周期回归 |

应同时验证函数实际调用次数、API 中间读取结果、最终变量值、消息中的操作顺序和处理标记，不能只看成功提示或最终数值。

ERA 构建预期测试 bundle，Pack 使用明确指定的预构建 bundle。按当前项目约定使用已配置的 8 worker；运行独立的新 Artifact，分别报告专项、完整细则和综合结果，不拼接旧结果。

### 6.2.1 真实酒馆测试统一使用 ERA-Test-Pack（人工确认）

真实酒馆验收**不在本仓自建测试流程**，一律通过 ERA-Test-Pack（`era-test` CLI）在真实酒馆
（SillyTavern + Tavern Helper + Response Lab）中执行；Pack 负责 sandbox、ST origin、浏览器
上下文与 Artifact，本仓只负责提供预构建产物与其证据。

运行前置（缺一不可，且必须晚于全部编辑）：

1. **发布 service AOT 到 app 实际引用的位置**：`app/webpack.config.ts` 把
   `@era/vibeflow-service` 别名到 `generated/era-service/workflow.js`，因此必须执行

   ```bash
   python3 run.py build --workspace vibeflow_config.jsonc \
     --config javascript_project/service/configs/era.service.jsonc \
     --target browser --profile esm-module --out-dir generated/era-service --replace
   ```

2. **重建 ERA bundle**：`pnpm --dir app build`，产物为
   `app/dist/ERA变量框架/index.js`（Pack 只接受这个预构建 bundle，不自行构建 ERA）。

3. **用 Pack 运行**（专项优先，全量综合只在功能完整后）：

   ```bash
   pnpm --dir "/home/example/projects/酒馆开发目录/测试工具链/ERA-Test-Pack" \
     --silent era-test -- test \
     --project "/home/example/projects/酒馆开发目录/测试工具链/ST-Test-Harness/.st-harness.jsonc" \
     --era-bundle "/home/example/projects/ERA-vibeFlow/app/dist/ERA变量框架/index.js" \
     --suite era-message-function-call --workers 8
   ```

要点：`--suite` / `--path` / `--file` / `--diagnose` 四选一；每次运行的 bundle 只经
`st-test-harness/domain-runner` 的受信任入口传递；长跑必须按 `long-running-task-monitor`
skill 监控；**真实 suite 未运行时必须明说「未运行」**，不得用离线门禁代替产品行为通过。

### 6.3 实施流程

完成待定设计后，沿各 root 已登记 Architecture 的 source，在真实生产 Config 位置表达 planned 变化，维护四类变更清单并生成完整展开审核图。人工批准后实施，更新 Architecture，执行适用的 validate、quality、build、本地测试和工作流探针，再运行 Pack 验收。

机器结构检查、实际功能测试和人工批准分别报告。本文档写入本身不表示上述工作已经完成。

## 7. 实施状态（截至 2026-09-11）

本节只记录**实际已实现并已验证**的内容，以及相对本文档前六节的偏差；不含计划意图。

| 批次 | 状态 | 依据 |
| --- | --- | --- |
| B1 语法与纯解析 | 已完成 | `<EraFCall/>`/`<EraFCallTx>` 解析、块列表、标记判定、操作区渲染均在 `base_lib/domain/message_function_calls.ts`，有专项测试 |
| B2 一步一块骨架 | **已完成（循环 + 交接记录提交）**；逐块状态提交待做 | 块推进已落成真实工作流步骤：`vibeflow.loop.while`（body `era.sync.block_step`）+ `era.sync.prepare_block_step` / `advance_message_block` / `era.sync.finalize_block_step`；遇无标记调用**无条件断开本批次**，且交接批次提交**消息记录**（见偏差 4）。**尚未做到**「每块执行完提交一次状态」（见偏差 1） |
| B3 Capability 与调用编排 | 已完成 | 交接事实 → `era.message.invoke_required` 后置通知；Host 在步骤之外驱动函数；`era.message.invoke_continue` 恢复事件把终态与产出操作送回；函数内 `ERA.commit`/`ERA.get` 走位置门面且绝不入队；工具失败**跨 realm** 判定（注册表在顶层窗口，它返回的 `Error` 在 iframe 里 `instanceof Error` 为 false，必须按 Error 标签/三件套判定） |
| B4 Agent 与压缩 | 已完成 | 三阶段输出统一执行（`isolateStoryEraCommands` 覆盖调用块）、含 `<EraFCall` 的楼层整层跳过封存压缩、规划提示词含调用语法 |
| B5 ABI 收口与文档 | **部分完成** | 交接 ABI 与位置门面约束已写入 `era-host-contract.md` 与作者指南，Architecture 已刷新；`era-host-contract.md` 的队列边界已按「交接提交记录而不是状态」改写；`syncCursor` 的持久化通道（契约 1.9.3 + 服务传递链）已接通（见偏差 2），但写入者未落地；作者指南的读回承诺仍不得声称已兑现 |

### 偏差 4（2026-09-11，已修）：交接批次必须提交消息记录

真机 MSG-FCALL-004（同一楼层两处同名同参调用）暴露：交接批次原先把工作项整体置为
`no-op`（`plan`/`payload` 归 null），而「已处理调用」的标记只存在于 `plan.messageUpdates`
里，于是记录随批次一起丢掉；恢复步只给本次回送的 `callId` 打标记，前一处的标记又没了，
两处调用互相覆盖、永不前进（实测 41 次重复调用、零标记、零落盘）。

现行修法（锁定语义中「消息记录逐块落盘」的那一半，`buildHandoffRecordWork`）：交接批次
**提交记录而不是状态**——`plan.stat`/`statFunc`/`meta` 回到已提交世界（块步进状态新增
`baseStat`/`baseStatFunc`，并携带 `consecutive`），清空封存压缩候选，不推进连续处理事实；
交接通知随 `SyncCommitRequestV1.handoff` 走提交分支，交接提交不呈现楼层。恢复时该楼层从
已提交世界整楼重放，恰好一次。

**仍待人工确认的两点**（属切片 1b 的另一半「状态也逐块落盘」与切片 3，未确认前不实施）：

1. **收尾/呈现/通知归属**：处理楼层改为逐块提交后，原整条提交链
   （`assemble_expression_sync_plan → crud_write → commit_variables`）应退化为「只做收尾与
   呈现」，还是完全跳过？本轮的答案是「交接与收口仍复用整条链、只把状态换回已提交世界」；
   逐块提交落地后必须重新定这一条。
2. **单块记录与封存压缩共存**：逐块提交在消息中留下的记录（每块一条、按原文位置）与
   「封存压缩按 scope 分段且不跨正文」如何共存——尤其位置锚定的记录层不能被错误合并。

两者都动共享同步核心（处理楼层的提交粒度、封存压缩边界），实施前需要人工确认。

### 偏差 1（部分消除）：块级步骤已落地，逐块提交未落地

`process_message_blocks`（`vibeflow.loop.while`）+ body `era.sync.block_step` 已实现并接线
（`sidecar_store_prepare → prepare_block_step → process_message_blocks → finalize_block_step
→ apply_command_compaction`），承载状态为 `era.sync.block.step.state`/`.next`，单块推进节点为
`era.sync.drive_message_blocks`。

**仍未落地的是锁定的提交粒度**：现在仍是「整条消息一次规划 + 一次提交」，而不是「每执行完一个
操作块就提交一次状态」。切片 1a（提交记录的位置锚定）已完成；切片 1b 起见本文档
「这项锁定的实现面」一节。在切片完成前，块进度不跨批次携带，恢复按「从楼层起点重算」执行。

### 偏差 2（载体已接通，写入待逐块提交落地）：`syncCursor` 的持久化通道

`EraServiceStateV1.syncCursor` 已作为公共 ABI 声明并随服务状态 schema 生成类型。
要写入必须让游标经 `EraTaskStateUpdateV1` 穿过批次合并：这是 `packages/era-contracts` 的
canonical schema + `index.d.ts` 变更，需要升版打包并让服务 root 重装 `file:` tarball。

**2026-09-11 更新（第 70 轮）**：载体已经接通——契约包升到 **1.9.3**，
`EraTaskStateUpdateV1.syncCursor` 成为可选字段（`isEraSyncCursorV1` 校验 + canonical schema +
`index.d.ts`），服务 root 的 `file:` 依赖切到新 tarball 重装，源码与安装副本字节一致；
服务侧 `SyncWorkV1`/`SyncCommitRequestV1` → `stateUpdateForPlan` → `buildSyncCommittedResult`
→ `mergeTaskResult` 整条传递链已实现并有红→绿测试（区分「缺键」与「显式 null 清空」）。
**仍未写入**：游标的产生者是逐块提交（本条锁定语义的另一半），在该实现落地前它保持 `null`，
恢复仍走重算路径。

### 偏差 3（未决）：函数内的即时读回尚未兑现

本文档 §3.2 承诺「提交后再次 `ERA.get()` 能看到刚提交的效果」。现行实现**不保证**，它把提交
登记为调用位置的操作、随消息重放生效。**这是未决设计，需要人工在两种机制里选一个**：

- **机制 A（走普通提交事件）**：位置提交以带调用位置标记的普通 `era.facade.commit` 事件进入 FIFO，
  由 Service 用真实 CRUD/表达式语义应用（唯一权威，不复制引擎），`ERA.get()` 立即读回。原先
  「入队会互等」的理由在当前架构下已不成立：函数在**批次发布之后**的后置通知阶段执行
  （`dispatchGenerationHandoff` 就是在这个阶段入队并等待结算的），当前批次不再等待函数返回。
  必须先定死「调用位置那条记录的唯写者」——普通提交自己写的记录与 resume 端写操作区不能同时存在，
  否则同一次变化会生效两次。
- **机制 B（发布纯应用能力给宿主）**：保持「位置提交绝不入队」，把 Service 的 CRUD 应用以纯函数
  形式发布给宿主（新导出/新包），宿主就地应用到位置状态；操作区仍是唯一持久记录。代价是新增
  一个发布面与 ABI 变更。

在选定机制之前，本文档与作者指南都不得声称读回已兑现。

### 偏差 3 决定（2026-09-11）：采用机制 A1

已确认走 **A1**：函数内 `ERA.commit` 走既有即时提交路径，**由这条普通提交自己写调用位置的持久记录**；
resume 端不再写 `<EraFCallTx>` 操作区，只给调用块打 `status="done"`（失败时另写 `error`）。

读实的关键事实（决定实现细节）：既有即时提交的记录落点是**追加**，不是插入——
`facade_api_engine.buildAppend` 组装 `content = latest.activeText + "\n" + <era_tx …>`。
因此 A1 必须补一个**位置锚定**的落点变体：把该次事务文本插到被调用块之后、后续块之前，
否则重放顺序与实时顺序不一致（对非交换操作会算出不同终值）。位置锚点只被调用位置提交使用，
普通提交仍按既有追加语义，不改动既有路径。

实现切片（下一步执行）：

1. `era.facade.commit` 载荷新增位置锚点（`callId` + 楼层/MK），仅调用位置提交携带；
2. `facade_api_engine` 增加位置锚定的落点构造（锚点处插入 `<era_tx>`），普通提交路径不变；
3. 恢复路径不再写操作区，只写 `status="done"`/`error`；
4. Host 位置门面把 `ERA.commit` 路由到普通提交事件并等待结算，`ERA.get()` 由此立即读回；
5. 合同测试 + 文档：作者指南恢复读回承诺，`era-host-contract.md` 把「位置绑定提交绝不入队」
   改写为「位置提交走普通提交事件、记录锚定在调用位置」（这是本轮人工批准的机制变更）；
6. 完成后跑 service validate/quality/build 与 app verify。

实现期间需要一并核实：插在消息中部的 `<era_tx>` 与封存压缩/scope 分层的相互作用
（压缩按 scope 分段且不跨正文，位置锚定的层不能被错误合并）。

### A1 实施前的读码发现（2026-09-11，需人工确认后继续）

读实两件事后，A1 的「记录锚定」部分可以直接做，但**「函数内读到正确的位置状态」不能只靠它**：

1. **记录落点**：`facade_api_engine.buildAppend` 是**追加**（`latest.activeText + "\n" + <era_tx>`）。
   位置锚定需要一个插入变体（插在被调用块之后），这是纯增量改动，普通提交路径不变。
2. **基线问题**：即时提交把操作应用到 Sidecar，而 Sidecar 的基线是**这条消息之前**的状态；
   「本条消息调用之前的块」（`<VariableInsert>`、`<VariableEdit>` …）在交接时**还没有提交**
   （现行实现按计划「无条件断开、本批次不提交任何状态」）。于是：

   - 交接时函数读到的位置状态（`handoff.stat`）＝ 基线 + 调用前的块；
   - 但函数 `ERA.commit` 之后，已提交快照 ＝ 基线 + 本次操作（**不含**调用前的块）。

   两者不一致：若前块把 hp 改成 50、函数提交 hp+30，函数内 `ERA.get()` 会看到 130（已提交基线 100+30）
   而不是期望的 80。也就是说：**A1 单独做出来，仍然给不出作者指南承诺的「提交后读回」语义**。

### 因此需要人工再定一次：调用位置状态的来源

- **A1-轻**：只做「记录锚定 + 去掉操作区 + 位置提交走普通事件」，并把函数内 `ERA.get()` 定义为
  「读已提交侧车快照」。代价：函数看到的是**已提交世界**，本条消息调用之前的块尚未生效——
  与「位置状态」的本意不符，文档必须如实写明。
- **A1-全（计划原意）**：交接时先把「调用之前的块」按既有即时提交语义落成 Sidecar 状态并记录在调用位置，
  函数在此基础上读取与提交，resume 后剩余块在已包含前块与函数操作的基线上继续。这样函数视图
  与已提交视图一致，读回语义才真正成立。代价：交接时不再是「不提交任何状态」，需要重新确认
  「无条件断开」这条已锁定语义在「前块先落盘」下的含义（是否接受交接批次包含前块的部分提交）。
- **B**：保持位置提交绝不入队，改为把 CRUD 应用以纯函数发布给宿主，在宿主侧维护位置状态。

未定之前不实施，避免交付一个「看起来能读回、实际上前后不一致」的版本。

### 最终锁定语义（2026-09-11 人工确认，取代上面的候选）

**A1-全 + 逐块提交**，原文口径：

> 不是弄成「ERA 看到有函数调用了，才将状态提交进 sidecar」，而是「ERA 每执行完一个操作块，
> 就提交状态进 sidecar 一次」，确保真正的、每个操作块都是一次完整的 ERA 工作，处理逻辑完全统一。

因此锁定的行为：

1. **块是工作单元**：每个操作块（`<VariableInsert>/<VariableEdit>/<VariableDelete>`、
   函数/操作区内的块、以及调用块本身）执行完就把该块之后的累计状态**提交进 sidecar 一次**；
   调用块不特殊对待，函数只是「在块边界上被执行的块」。
2. **提交不是「有调用才发生」**：不调用函数的消息同样逐块提交，处理路径与含调用的消息完全一致。
3. **函数读到的是已提交状态**：调用发生时，调用之前的块**已经提交**，因此函数内 `ERA.get()` 与
   提交后的读回都基于同一份已提交状态，不需要宿主复制变量引擎，也不存在位置视图与已提交视图不一致。
4. **消息记录逐块落盘**：每个块的提交在消息中留下它自己的记录（按原文位置有序），
   因此「从楼层起点重算」与「逐块实时提交」得到同一终值；已提交的块不被重复执行。
5. **续做点由文本与已提交状态共同确定**：哪些块已提交由消息中的记录判定，因此跨批次恢复不需要
   额外发明一套进度来源；`syncCursor` 仍是已声明的 ABI，其写入属本项的一部分。

### 这项锁定的实现面（按依赖顺序切片）

1. **单块提交节点**：把「读已提交状态 → 执行一个块 → 提交该块后的累计状态 + 在该块位置写记录」
   做成一个真实的提交（复用既有即时提交/`era_tx` 语义），替代当前「整条消息一次规划 + 一次提交」。
2. **循环体改造**：`era.sync.block_step` 的 body 由「只推进状态」改为「推进并提交一个块」；
   循环的终止条件改为「该消息再无未提交块或遇到需要交接的调用」。
3. **与既有提交链的关系**：处理楼层不再走 `assemble_expression_sync_plan → crud_write → commit_variables`
   的整条链路，或该链路退化为「收尾与呈现」；封存压缩、协调同步、回退与 API 提交路径保持不变
   （它们服务的是**其他**楼层与显式同步请求）。
4. **调用块交接**：仍然无条件断开本批次；函数由 Host 在步骤之外执行，其提交与普通块提交走同一条路径；
   恢复事件只负责「继续同一楼层」。
5. **合同测试与文档**：逐块提交的终值一致性、已提交块不重复执行、刷新/切聊/重放一致性；
   作者指南恢复读回承诺；`era-host-contract.md` 的队列边界描述按本锁定改写。

**这是对共享同步核心的改动**（处理楼层的提交粒度从「整条消息」变为「单个块」）。实施按上述顺序进行，
每一步独立验证与独立提交；若某一步需要改动现有封存压缩、协调同步或回退语义，先停下来问人。

### 切片 3 两个红线的决定（2026-09-11 人工确认，取代本文档前述的两个「待定」）

**决定一（收尾/呈现/通知归属）**：保留末尾那条「结账」链路，但它**不再写消息文本、不再写
sidecar 状态**；它只负责逐块保存做不到的事（刷新楼层显示等）。并且**尾链只在确定当前消息
已经没有未执行的 ERA 操作块时才执行**。

⇒ 推论（实施时必须照做）：交接（还有未执行块）时的 `era.message.invoke_required` 通知
**不得依赖尾链**，必须由交接点直接发出；尾链只在楼层真正算完时跑，并且不再有「提交状态」的
职责。本轮（偏差 4）为了修无限交接而让交接批次走整条提交链，是**中间态**：逐块提交落地后，
交接批次只留下「该块已执行」的记录，通知改由交接点直发。

**决定二（凭据与封存压缩共存）**：口头口径如下（用户原话要点）：

- 「走到哪一步的凭据」只在 ERA 计算/重算某楼层**期间**存在于消息里；**该楼层算完后立即删除凭据**。
  因此曾经压缩过的老楼层重算前后内容完全不变，最新楼层算完也不留凭据，两者都不与压缩冲突。
- 若某楼层里仍存在凭据，说明此前发生过异常中断：**优先从凭据处把剩余部分算完，然后删除凭据**。
- 调用块被执行后会被标记 `done`（等于永不再执行），所以压缩**跳过 `<EraFCall>` 那一行**即可，
  把它留下的变量操作当成普通 API 操作一起压缩，不需要担心压缩搞坏结构。
- 压缩永远不作用于最新的 AI 消息；未被调用的调用块要么只出现在最新消息（与压缩不相遇），
  要么出现在用户手动修改的历史楼层（这种会先重算并把调用算完，之后调用块的位置无所谓）。
- ⇒ **删除「含函数调用的楼层整层跳过压缩」这条规则**（B4 引入的 `command_compaction.ts`
  里的 `MESSAGE_FUNCTION_CALL_MARKER` 整层跳过）。

**剩余实施顺序（下一轮起，每步独立验证与独立提交）**：

1. 逐块提交（状态 + 凭据 + 续做点）：切片 1b 的另一半；
2. 尾链改造（只在楼层算完时执行、且不写文本/状态）+ 交接通知改由交接点直发；
3. 封存压缩按决定二改写（去掉整层跳过；跳过调用行、把调用产出的操作当普通操作），
   并做差分验证证明「压缩前后重放终值一致」；
4. 文档收口：作者指南恢复读回承诺、`era-host-contract.md` 再次更新；
5. 每步之后跑机器检查，功能完整后跑真机专项与 `era-regression-all` 全量综合。

### 切片 1b 剩余实施设计（2026-09-12 已读实，逐项可执行）

**决定性问题：进度不能只放内存。** `createWorkflowHost()` 每次页面加载重建，服务/批次状态
（含 `syncCursor`）**不跨重载持久**；而逐块提交后 sidecar 里的 `stat` 已经是「楼层算到一半」的
世界。因此「已提交到哪一块」必须同时有**消息级持久记录**，否则重载后整楼重放会把已提交的块算
第二遍。这就是「凭据」必须存在的硬理由（也解释了为什么它算完要删：删掉之后原文与「从楼层起点
重算」一致，压缩永不与它相遇）。

**已落地（第 71 轮）**：标签 `<era_block mk="…" applied="1">…</era_block>`、区域解析与跳过
（复用 `operationsRegionApplied`）、`wrapBlockAsAppliedRecord` / `unwrapAppliedRecords` /
`hasAppliedBlockRecords` / `appliedCommandPrefix` 四个纯函数、宏技术块名单与
`packages/era-macro-syntax` 重新生成；以及第 70 轮的 `syncCursor` 载体与 `prepare_block_step`
续做。

**待做，按依赖顺序**：

**循环体装配配方（2026-09-12 已读实各节点 type key，可直接照做）**：

```
start
 → advance_message_block        era.sync.block.step.state → era.sync.block.step.state.next + era.step.done
 → build_block_commit (新)      era.sync.block.step.state.next → 同名透传 + era.tavern.commit.request
 → era.tavern.variables_commit   era.tavern.commit.request → era.tavern.commit.result
 → fold_block_commit (新)        era.tavern.commit.result + era.sync.block.step.state.next → era.sync.block.step.state.next
 → end                          outputs：era.sync.block.step.state.next + era.step.done
```

已核实的事实与取舍：

- `validate_commit_candidate` 是「requires 与 provides 同类型」的透传节点（`era.tavern.commit.request`
  进、同名出），所以**透传模式在核心里合法**：`build_block_commit` 与 `fold_block_commit` 都用它
  把状态带过提交节点。
- 第一版装配**先不接** `validate_commit_candidate`：失败分支会让 `fold` 的输入类型在某些路径上
  无法满足。单块请求由 `buildSyncCommitRequest` 构造、本身即契约合法，且 `foldBlockCommitOutcome`
  对非成功状态抛 `ERA_BLOCK_COMMIT_FAILED`（内核按失败结算），因此少一道校验不会写出坏状态。
  接校验作为后续加固（需要给失败分支补一个产出 `era.tavern.commit.result` 的结算节点）。
- 交接迭代（没有执行块）：`build_block_commit` 产出 `{mode: "non-commit"}` 信封，`era.tavern.variables_commit`
  原样返回、不写任何宿主状态，`foldBlockCommitOutcome` 对此信封**原样放行**（已实现并测试）。
- `era.step.done` 由 `advance_message_block` 产出、由 `end` 消费，中间节点不得消费它。

1. **记录写入者 `commit_block_state`（循环体内）**：body 改为
   `start → advance_message_block → build_block_commit → validate_commit_candidate →
   era.tavern.variables_commit → fold_block_commit → end`。
   `build_block_commit` 用 `buildBlockCommitWork` 造单块计划（`stat`/`statFunc` = 该块之后的累计
   状态、`meta` = 已提交 meta、`messageUpdates` = 把该块包进记录后的楼层文本）；
   `fold_block_commit` 把提交结果折回状态（记录失败则按批次失败结算）。
   **可行性已读实**：`batch_execute.jsonc` 的循环体就是 `era.service.step`（含能力调用），
   循环体可以用能力节点。
   楼层最后一块的提交把 `syncCursor` 写 `null` 并**删除全部记录标签**（`unwrapAppliedRecords`）。
2. **引擎侧三处耦合（缺一不可）**：
   a. `findSyncDivergence`：**存在记录的最早楼层必须参与重算**——把 recalcId 收紧到
      `min(常规 recalcId, 该楼层)`，否则「中断楼层 + 之后新楼层」会让中断楼层永远算不完。
   b. 逐楼重放：`applyMessageCommands` 传 `commandRange.fromIndex = appliedCommandPrefix`，
      让已提交的块不被算第二遍（`toIndex` 取 `Number.MAX_SAFE_INTEGER`）。
   c. **`EditLogs` 累积**：`planEraSync` 现在用 `defineOwn(editLogs, mk, effectiveEditLog)`
      **覆盖**；有记录的楼层必须**追加**（回退依赖逐块日志完整），否则回退会漏掉已提交块。
3. **随机抽取偏移**：`applyMessageCommands` 的 `nextRandomDrawOffset` 是块游标的一部分，重载后
   会丢；把「该块之后的 draws 偏移」一起写进记录（记录加 `draws` 属性），恢复时用它起算，
   否则重载后后续块会重复抽取。
4. **尾链改造（决定一）**：处理楼层的写入所有权移入循环后，尾链只做收尾——用 `no-op` 工作项承载
   `stateUpdate`（`consecutiveMk`/`consecutiveProcessingCount`/`syncCursor`）与交接通知，不写
   文本与 sidecar；`present_finalized_floor` 扩展为「非提交但带呈现意图时也刷新楼层」。
5. **封存压缩（决定二）**：删掉 `command_compaction.ts` 的 `MESSAGE_FUNCTION_CALL_MARKER`
   整层跳过，改为跳过 `<EraFCall>` 那一行、把调用产出的操作当普通操作压缩；加「压缩前后重放
   终值一致」差分验证。
6. **打包**：`era-macro-syntax` 升版 0.1.1 重装（让 `era_block` 在显示与提示词里隐藏）——与
   写入者同批做；同批还要重跑真机专项与回归门。

### 切片 1 落点（已读实，下一轮直接实施）

- **写入能力已存在**：`era.tavern.variables_commit`（`manifests/nodes/sync-commit.jsonc`，
  `nodes/sync/commit_sync.ts`）已持有一次提交所需的全部副作用——
  `era.tavern.messages.update_content` 与 `era.tavern.sidecar.{read_current,read_record,write_record,commit_metadata,present_prompt}`，
  其 base_libs 为 `era.service.sidecar_binding` / `era.service.sync_commit_policy` / `era.service.sync_contracts`。
  逐块提交不需要新增能力，只需要一个「单块提交请求」的表达。
- **记录构造可复用**：`base_lib/facade_api_engine.ts` 的 `buildTransaction`（把操作拼成
  `<era_tx s="…">…</era_tx>`）与 `buildAppend`（当前是追加）就是普通即时提交的记录构造；
  切片 1 给它们加**位置锚定**变体（插到被锚定块之后、后续块之前），普通提交路径保持不变。
- **循环体接线点**：`configs/nodesets/message_block_step.jsonc` 的 body 现在是
  `start → advance_message_block → end`；切片 1 在 `advance_message_block` 之后插入
  `commit_block_state`（单块提交），并让 `end` 输出「已提交到的块」。
- **待核实（实施时确认，不确定就问人）**：单块提交写出的 `<era_tx>` 与既有
  「按 scope 分段、不跨正文」的封存压缩规则如何共存；以及处理楼层不再走
  `assemble_expression_sync_plan → crud_write → commit_variables` 后，收尾/呈现/通知链路由谁负责。

### 切片 1b 设计（已读实 `sync_commit_policy.buildSyncCommitRequest`，无需新增提交通道）

关键事实：`SyncCommitRequestV1` 的三个状态字段全部来自 **plan**：

```ts
// sync_commit_policy.buildSyncCommitRequest
{ …, messageWrites: plan.messageUpdates→写消息, stat: plan.stat, statFunc: plan.statFunc, meta: plan.meta, … }
```

因此**单块提交不需要发明新的提交类型**，它可以原样复用既有提交链：

1. 为「第 N 块之后」构造一个**只含该块**的 plan：
   - `plan.stat` / `plan.statFunc` / `plan.meta` = 块步进累计状态（`era.sync.block.step.state` 里已有的值）；
   - `plan.messageUpdates` = 一条该楼层的文本更新，内容是**锚定记录之后的原文**（锚定由切片 1a 的
     `anchoredTransactionContent` 完成：`<era_tx s="m">` 插在该块之后，调用块同时标记 `status="done"`）；
   - `plan.pages`/`messages` 等按既有 `EraSyncPlanV1` 形状给足（`messages.length === 0` 时允许 payload 为 null）。
2. 把该 plan 包成工作项：`{ ...work, disposition: "commit", plan, payload }`；
3. 调用既有 `buildSyncCommitRequest(work)` → 交给既有节点 `era.tavern.variables_commit`
   （`era.tavern.messages.update_content` + `era.tavern.sidecar.*`）执行写入。

这条路线的好处：**零新增能力**、复用既有消息写入与 Sidecar 提交的核对/回读/失败语义；
循环体只需在 `advance_message_block` 之后加一个「构造单块 plan 并提交」的节点。

仍需在实施时核实并在不确定时问人（红线不变）：

- `plan` 的最小合法形状（`EraSyncPlanV1` 的必填字段、`actionsTaken`、`nextConsecutiveState` 是否需要随块推进，
  以及它与 `consecutiveMk`/连续处理计数语义的关系）；
- 处理楼层完成逐块提交后，原本的整条提交链（`assemble_expression_sync_plan → crud_write →
  commit_variables`）应退化为**收尾与呈现**还是完全跳过——这决定收尾/通知链的归属；
- 单块记录（每块一条 `<era_tx>`）与封存压缩「按 scope 分段、不跨正文」的共存。

### 最小合法 plan 配方（已读实 `domain/sync_engine.ts` 的 `EraSyncPlanV1`）

`kind: "sync"` 分支的必填字段（按源码顺序）：`kind, status, committed, divergence, stat, statFunc, meta, messages, messageUpdates, sealedCompactionCandidates, recalculatedMessageIndexes, rollback, applied, fromMk, toMk, actionsTaken, consecutiveProcessingCount, nextConsecutiveState, diagnostics, kind, status, committed, divergence, stat`。

因此切片 1b 的「单块 plan」按此填写即可，不需要新增类型：

- `kind: "sync"`、`status` 取 `"fast-sync"`（本块有实际写入）或 `"no-op"`；
- `stat`/`statFunc`/`meta` = 块步进状态里的累计值（`era.sync.block.step.state`）；
- `messages` = 该楼层的消息投影（提交链与压缩候选都会读它，不能空）；
- `messageUpdates` = 一条 `kind: "update-message-content"`（锚定记录后的文本 + 该楼层 MK + messageIndex）；
- `actionsTaken` 至少把 `apply` 置真（决定 `assemble_expression_sync_plan` 的 `crud`/`reconcile` 分支）；
- `sealedCompactionCandidates`/`recalculatedMessageIndexes` 给空数组、`rollback` 给 `{applied:false,fromMk:null,toMk:null}`、
  `divergence` 给 `null`、`committed` 置真；其余（`consecutiveProcessingCount`/`nextConsecutiveState`/`diagnostics` 等）
  按既有规划产物同形填写。

**归一化要求已读实（`sync_planning.normalizePlan`，结论：单块 plan 方案可行）**：

```ts
if (plan.status === "failed") return plan;
return { ...plan,
  committed: plan.committed || preUpdates.length > 0,
  actionsTaken: actionsForStep(step, plan.actionsTaken),   // 由 step 重算，不必自己精确填
  messageUpdates: [...preUpdates, ...plan.messageUpdates] };
```

即归一化**只动 `committed`/`actionsTaken`/`messageUpdates` 三项**，`stat`/`statFunc`/`meta`/`messages`
原样保留——单块 plan 不会被还原成整条消息的计划。另据 `payloadFor`：`plan.consecutiveProcessingCount`
必须是 ≥ 1 的整数，否则构造 payload 会抛错，单块 plan 必须填它（沿用既有计数或取 1）。

**因此切片 1b 的实施不再有未知项**：按上面的字段配方生成单块 plan → 包成 `disposition: "commit"` 的工作项 →
`buildSyncCommitRequest` → 既有 `era.tavern.variables_commit` 写入。剩余待人工确认的只有切片 3 的两个红线问题
（收尾/通知链归属、单块 `<era_tx>` 与封存压缩共存）。

### 机器检查证据

| 检查 | 结果 |
| --- | --- |
| Service `run.py validate` / `quality-check` / `build`（era.service） | PASS / PASS / PASS |
| App `pnpm verify`（format → lint → typecheck → aot → quality → 全量单测） | PASS；87 文件 / 665 测试，quality 无 `[NEW]` |
| ERA-Test-Pack 离线门禁 | typecheck / format:check / build / catalog:check（`valid`）/ test:contract 253 项 / verify:baseline（`valid`）全部 PASS |

### 人工验收状态

**未运行真实 suite。** Pack 规则要求真实 ST/浏览器/Lab 运行需另行授权；在授权前不得把离线门禁
通过当作产品行为通过。专项已具备可评估条件：`era-message-function-call` 套件 6 条
（MSG-FCALL-001..006），其中 006 使用卡片内注册的 `era_message_call_fixture_v1` 验证「函数在
调用位置提交的操作随消息重放生效」。

### 真实 suite 首次运行记录（2026-09-11，已授权）

运行命令（计划 §6.2.1）：`era-test -- test --project …/.st-harness.jsonc --era-bundle …/app/dist/ERA变量框架/index.js --suite era-message-function-call --workers 8`

Artifact：`本地运行资料/live/artifacts-v4/st-run-20260911T13365826-e091db350beb`

| 项 | 结果 |
| --- | --- |
| Pack CLI | `completed_with_findings` |
| Harness | `status=incomplete`、`recordingStatus=partial`、**`evaluationStatus=failed`** |
| 记录计数 | `selectedPaths=6`、`recordedPaths=6`、`actions=90`；`structuralStatus=consistent`、`recorderEvidenceStatus=complete` |
| 逐条评估 | MSG-FCALL-001..006 **全部 failed** |

失败 findings（6 条一致）：

```
ERA_BEHAVIOR_EVIDENCE_MISSING
  Action realistic-baseline-quick-initialize is missing, duplicated, incomplete, or has the wrong type
  Action realistic-baseline-observe-resources is missing, duplicated, incomplete, or has the wrong type
```

**已排查的关键事实（决定了修哪一侧）**：这些 baseline action **确实被执行并记录**。
`paths/MSG-FCALL-001/actions.jsonl` 的前 6 条正是
`realistic-baseline-wait-era-ball`、`-open-era-panel`、`-quick-initialize`、`-observe-resources`、
`-observe-state`、`-close-era-panel`，各出现一次、无重复。

因此**问题不在场景装配**（`applyRealisticBaseline` 已按 `quick-init` 模式注入并通过了 Harness 记录），
而在 **Evaluator 的证据要求判定**：它认为这些 action「缺失/重复/不完整/类型不对」。
下一步排查方向（下一轮）：

1. 对比本套件用例与**通过中**的套件（如 `era-expression-function`）在 catalog fixture 里这些
   baseline action 的 **type / input 形状**是否一致；
2. 检查我新加的 `messageFunctionCallAssertions` 接入是否影响了 `exactStateAssertionsForRealisticBaseline`
   对 baseline 证据的期望构造（例如断言引用的 actionType 与实际记录不一致）；
3. 必要时用 `--path MSG-FCALL-001` 单条运行缩小范围，避免一次跑 6 条。

**在取得有结论（或有明确修复方向）的真实结果之前，不得把该特性记为「真实酒馆验收通过」。**

### 真实 suite 第二次运行记录（2026-09-11，专项 6/6 通过）

运行命令同 §6.2.1（`--suite era-message-function-call --workers 8`）。
Artifact：`本地运行资料/live/artifacts-v4/st-run-20260911T15542066-e9262bb76377`

| 项 | 结果 |
| --- | --- |
| Pack CLI | `completed` |
| Harness | `recordingStatus=completed`、**`evaluationStatus=passed`**、`structuralStatus=consistent`、`recorderEvidenceStatus=complete` |
| 记录计数 | `selectedPaths=6`、`recordedPaths=6`、`actions=90` |
| 逐条评估 | MSG-FCALL-001..006 **全部 passed、findings 0** |

工具调用次数（`[ERA] 工具注册表解析`）：001=1、002=0（文本已带标记，不重跑）、003=1（未注册、
一次失败）、**004=2（修复前 41）**、005=0（嵌套只报诊断）、006=1。

决定性终态证据：

```
003：statData.mfc_fixture.hp = 90；
     <EraFCall name="era_message_call_missing_v1" args='{}' id="c1" status="done" error="ERA_FCALL_FAILED"/>
     + 空操作区 <EraFCallTx for="c1"></EraFCallTx>
004：statData.mfc_fixture.hp = 100；
     c1、c2 各自 status="done" 且各带一个 <EraFCallTx>
```

回归门（不劣于基线）：`--path SEM-INS-001` → `evaluationStatus=passed`、18 actions。
Artifact：`本地运行资料/live/artifacts-v4/st-run-20260911T15564682-0e4821694899`

### 交付冻结复跑（2026-09-12，晚于全部源码提交）

把两份构建产物冻结并记录哈希后，用同一份产物重跑两条验收：

| 产物 | sha256 | 字节 |
| --- | --- | --- |
| `app/dist/ERA变量框架/index.js` | `8e42e55d3b207d8e52129c24578ae2afc8e856622bbac18e8d65778e96b28e56` | 12951511 |
| `generated/era-service/workflow.js` | `2ecbf90c7b68af79b4a86db998af75e1fbfda79f975befae85291bd0c0822a11` | 12694999 |

| 运行 | Artifact | 结果 |
| --- | --- | --- |
| `--suite era-message-function-call` | `st-run-20260911T16374264-997653e52f67` | `evaluationStatus=passed`，6/6 passed、findings 0 |
| `--path SEM-INS-001` | `st-run-20260911T16400427-f8dde8eab83c` | `evaluationStatus=passed`，18 actions |

⇒ **功能行为已通过真实酒馆验收（专项 6/6）**；仍未完成的是锁定语义的另一半
（状态也逐块落盘，见偏差 1、4 与两个待确认点），以及 `syncCursor` 的正式升版打包。
