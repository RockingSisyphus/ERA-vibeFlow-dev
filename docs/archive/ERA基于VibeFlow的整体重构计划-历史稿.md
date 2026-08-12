# ERA 基于 VibeFlow 的整体重构计划（历史稿）

> 归档说明：本文是迁移开始前的设计计划，保留两工作流拆分、Host 边界和验收思路，
> 但其中的 VibeFlow 版本、planned 状态、目录和门禁进度不再代表当前实现。
> 当前入口请见 `../README.md`、`../migration/TODO.md` 和
> `../migration/最终报告.md`。

## 1. 文档状态

- 目标项目：`/home/example/projects/ERA-vibeFlow`
- 权威实现参考：`/home/example/projects/ERA-EfficientRollbackArchitecture` 的
  annotated tag `era-vibeflow-baseline-v1`
- VibeFlow 基线：0.7.0（分发生成时间 2026-07-30 17:36:36 UTC），JavaScript/TypeScript AOT，browser target
- 当前实施状态：G0 完成；G1 已按新版内核登记 planned Service Host 并重新生成中文审核产物，尚未获批进入业务实现
- 生产归属：本仓库接管；旧仓库冻结为只读行为基线
- 持久化策略：首版保持现有 Schema，不做数据迁移
- 切换策略：最终门禁通过后一次性替换，不在生产包长期保留双后端

本计划用于把 ERA 的后台业务架构迁移到 VibeFlow，同时保留适合由 Vue、Webpack 和酒馆助手宿主代码管理的前端部分。实施前应先把本计划细化成真实的 planned workflow/nodeset，并通过 VibeFlow `review` 生成正式架构审查文档和展开 SVG；审查通过后再逐步实现。

## 2. 总体结论

ERA 应拆成三个边界：

1. **VibeFlow 后台业务层**
   - 事件规划、变量事务、CRUD、同步、回滚、时间旅行、查询、初始化决策和宏解析。
   - 使用 workflow、nodeset、node 和 base_lib 表达。
2. **VibeFlow Service Host Extension 宿主插件层**
   - 负责 Tavern Helper/SillyTavern 的服务事件监听、Port 队列、变量和消息 API、定时器、通知与卸载清理。
   - 它属于 VibeFlow 管理的 JS AOT 宿主资源，但不是普通流程 node。
3. **非 VibeFlow 前端与启动层**
   - Vue/Pinia 组件、DOM、CSS、动画、Webpack 资源处理、同步宏 adapter 和极小启动代码。
   - 前端的业务命令必须进入 VibeFlow 后台，但渲染本身不进入流程图。

目标不是把每个现有函数都变成 node，而是让所有影响 ERA 业务结果、事务顺序和副作用顺序的决策在流程图中可见。

## 3. 术语约定

本文中的“plugin”专指 JS/TS AOT 的 **Host Extension**，而不是 Python Runtime Plugin。

- Python `project/plugins/` 下的 policy/compiler/runtime plugin 不能进入 browser AOT 产物，不用于 ERA 浏览器运行时。
- ERA Service 的酒馆适配插件先在 Service workflow 顶层
  `host_extensions` 以 `status: "planned"` 登记；实现阶段再以同一 ID 在
  `project/service/host_extensions/` 放置源码并登记 descriptor，然后切换为
  `implemented`。Macro 不启用 Host Extension，由 `app/` 同步 adapter 读取
  输入并调用生成的 `runWorkflow()`。
- 项目如需给 VibeFlow 增加 ERA 专用静态治理规则，可以另写 Python policy plugin；它只在构建/审核阶段运行，不承担酒馆运行时职责。

## 4. 目标架构

```text
酒馆助手 ERA 脚本
│
├── 非 VibeFlow 极小启动层
│   ├── 等待 $(() => ...)
│   ├── 创建并启动 ERA Service Host
│   ├── 注册 ERA Macro 同步 adapter
│   ├── 启动永久 Service Workflow
│   ├── 挂载 Vue/Pinia UI
│   └── pagehide 时停止 Hosts 并卸载 UI
│
├── ERA Service Host（VibeFlow Host Extension）
│   ├── 注册/注销 Tavern 事件与脚本按钮
│   ├── 提供 vibeflow.port
│   ├── 管理 FIFO、sequence、receipt 与 generation barrier
│   ├── 提供 Tavern 数据、消息、世界书、正则和通知 Capability
│   ├── 把定时器转换成合成事件
│   └── 接受 AbortSignal 并执行幂等清理
│
├── ERA Service Workflow（VibeFlow，entry_mode: async）
│   └── 永久 loop
│       ├── receive 事件
│       ├── 更新批次状态
│       ├── 规划任务
│       ├── 执行事务/查询
│       ├── 输出事件结算
│       └── 输出锁外通知命令
│
├── ERA Macro Adapter（非 VibeFlow 极小宿主接线）
│   ├── 注册/注销 registerMacroLike
│   ├── 同步读取当前 ERA stored stat
│   └── 在宏回调中同步调用 Macro Workflow
│
├── ERA Macro Workflow（VibeFlow，entry_mode: sync）
│   └── 输入 substring + stored stat，立即输出 replacement
│
└── Vue/Pinia UI（非 VibeFlow）
    ├── 显示、交互、DOM、样式和局部视图状态
    └── 通过 Port/命令调用 ERA Service，不自行实现变量业务
```

## 5. 工作流划分

### 5.0 为什么是两个工作流、但仍是一个应用

`era.service` 与 `era.macro` 是同一个 ERA 应用中的两个 AOT 工作流模块，不是
两个页面、两个浏览器进程或两个独立发布产品。最终由 `app/` 的唯一生产入口同时
装配，Webpack 仍可把两份生成模块打入同一个发布 bundle。

不能把二者合成同一个 VibeFlow workflow，原因是它们的入口与生命周期契约互斥：

- Service 必须是 `entry_mode: async`，使用 suspend `vibeflow.io.receive`、
  永久 loop、Port、Capability、AbortSignal 和单例 start/stop 生命周期。
- Macro 回调必须是 `entry_mode: sync`，每次调用立即返回字符串，不允许 Promise、
  receive、Capability、Host Extension 或长期状态。
- VibeFlow 不会把同步 workflow 自动升级为异步；同步与异步 workflow 导出不同入口。
  把 Macro 放入 Service 会迫使宏返回 Promise，破坏 Tavern 宏 ABI；把 Service 放入
  Macro 则无法使用 suspend receive。
- 两者共用一个启用 Service Host Extension 的 AOT root，还会让纯 Macro 构建继承
  不必要的监听器和高权限宿主边界，扩大权限与生命周期耦合。

因此保留两个 root 是 ABI 和权限隔离，不是产品拆分。允许共享的纯 DTO/codec
继续由 `packages/era-contracts` 提供，最终发布仍只有一个 ERA 应用入口。

### 5.1 `era.service`

`era.service` 是 ERA 后台的唯一长期状态服务，使用：

```text
entry_mode: async
→ vibeflow.loop.while(max_iterations: null)
→ vibeflow.io.receive
→ era.service.event_cycle nodeset
→ vibeflow.io.send
→ 下一轮 receive
```

原则：

- 一个 Service Host 只启动一个主 worker，保持 ERA 当前单 worker 事务语义。
- 永久 loop 每轮都必须经过 suspend `receive`，禁止同步忙循环。
- 永久 loop 只使用有界 `carry` 保存批次状态、定时器 token 等必要状态。
- 禁止在永久 loop 中使用无界 `collect`。
- Tavern 变量仍是持久化事实来源；loop carry 只保存运行期协调状态，不把整个聊天历史永久复制在内存中。
- 可恢复业务错误必须转换为结构化 outcome 数据并在图中路由，不能让一次坏事件直接终止永久 workflow。
- 配置错误、契约错误和无法继续保证一致性的错误才允许终止 Service Workflow。

### 5.2 `era.macro`

`era.macro` 是独立同步工作流：

```text
entry_mode: sync
输入：`substring`、`storedStat`

`storedStat` 使用 `{kind: "present", value: JsonValue}` 或
`{kind: "missing"}` 的 tagged 形式；首版不保留未被候选基线使用的
`macro_context`。
→ 检查 ERA 宏
→ 反转义 stored stat 并形成一次性只读快照
→ 选择含元数据/不含元数据快照
→ 解析路径
→ 格式化替换值
输出：replacement
```

原则：

- workflow、node、base_lib 和 Capability 全部必须是 immediate。
- 不使用 `receive`、Promise、deferred、detached、网络或异步存储。
- `app/` 中的同步宏 adapter 在回调触发时读取一次原始 stored stat，并作为普通输入传给 workflow；反转义、去元字段和快照构造属于 workflow/base_lib。
- 同一次宏替换只使用该快照，避免读取过程中状态变化。
- 宏回调直接返回 workflow 的 `replacement: string`，不得缓存 Promise 或异步补写结果。

### 5.3 暂不新增独立 UI workflow

UI 命令统一作为 `era.service` 的输入事件，例如：

```json
{
  "type": "era.ui.rollback",
  "payload": {"messageId": 12}
}
```

这样可以确保 UI 操作、酒馆事件和外部 ERA API 共用同一个事务顺序。只有在后续证明 UI 纯查询被永久队列明显拖慢时，才评估增加只读 query workflow；新增前必须证明它不会与写事务读取到互相矛盾的快照。

## 6. Node 与 Nodeset 设计

### 6.1 划分标准

应做成 node/nodeset 的内容：

- 在流程图上值得独立审查的业务步骤。
- 决定执行哪个分支、何时提交、哪些事件合并或忽略的规则。
- 调用 Capability 的明确副作用边界。
- 对外形成稳定领域结果、回执或通知命令的步骤。

不应把以下内容做成 node：

- 几行即可表达、只服务一个 node 的局部 helper。
- 单纯为了让每个函数出现在图上而产生的包装层。
- Vue computed、DOM 更新、CSS、动画和组件事件。
- Tavern 事件注册、`pagehide`、Port Promise resolver 等宿主接线。

### 6.2 主要 Nodeset

#### `era.service.event_cycle`

永久 loop 的单轮 body。建议包含：

1. 接收并验证传输 DTO。
2. 按事件目录分类。
3. 更新 collection window 状态。
4. 判断本轮是否形成可执行批次。
5. 尚未形成批次时输出新的 carry 状态并进入下一轮。
6. 形成批次时调用 `era.events.plan_batch`。
7. 顺序调用 `era.tasks.dispatch` 执行计划步骤。
8. 生成每个来源事件的唯一结算结果。
9. 输出锁外通知命令。
10. 清空已提交批次状态，保留下一批必要状态。

#### `era.events.plan_batch`

负责：

- 事件组合、碰撞、coalescing 和 ignore/execute 关系。
- 生成稳定的 `PlannedStep[]` 数据。
- 确保每个来源事件恰好被一个计划步骤覆盖。
- 若 planner 漏掉事件，生成明确失败 outcome，而不是留下永久未结算 receipt。

它对应当前：

- `events/catalog.ts`
- `events/merger.ts`
- `events/types.ts` 中的计划数据契约

#### `era.tasks.dispatch`

根据 `DomainTask.kind` 路由到：

- `era.task.initialize`
- `era.task.sync`
- `era.task.api`
- `era.task.update_mk`

分支必须在 config 中通过 decision 与显式 `when` 边表达，不能在一个大 node 内用隐藏 switch 完成全部调度。

#### `era.task.sync`

负责历史变化、编辑、swipe-regeneration、手动同步和 API 写入后的状态同步：

1. 读取规范化聊天上下文。
2. 提取消息 MK 和 ERA 数据。
3. 找到分歧点。
4. 选择增量同步或完全重算。
5. 计算新 stat/meta/log。
6. 形成一次逻辑提交请求；只有全部必要写入被确认后才能结算。
7. 提交后形成 `writeDone` 等通知命令。

对应当前：

- `core/sync.ts`
- `events/handlers/sync.ts`
- `events/dispatcher.ts` 中同步分支

#### `era.task.crud_write`

统一处理 insert/update/delete：

1. 解析 API 或消息中的写入命令。
2. 归一化路径和值。
3. 选择 insert/update/delete 分支。
4. 应用模板继承或数组规则。
5. 生成 edit log。
6. 生成新的 stat/meta。
7. 形成提交请求和结果。

对应当前：

- `core/crud/delete.ts`
- `core/crud/insert/insert.ts`
- `core/crud/insert/template.ts`
- `core/crud/update.ts`
- `core/crud/patcher.ts`
- `events/handlers/api/handler.ts` 中的写入 API

#### 定向 rollback 归入 `era.task.sync`

候选基线中的 `forceSync rollbackTo` 实际进入定向 sync，因此首版不建立独立
`era.task.rollback` 生产 nodeset。`core/rollback.ts` 仅作为历史实现参考；
time-travel 纯算法仍可由 sync/snapshot 路径复用。

#### `era.task.snapshot_query`

统一承载：

- 当前变量查询。
- 指定 MK 快照。
- MK 区间快照。
- 指定 message id 快照。
- message id 区间快照。
- 最近新值查询。

对应当前：

- `core/snapshot.ts`
- `core/timetravel.ts`
- `events/handlers/api/handler.ts` 中的 query handlers

#### `era.task.initialize`

负责决定：

- 是否需要初始化外部设置。
- 是否创建或绑定主世界书。
- 哪些世界书条目需要新增/更新。
- 哪些酒馆正则需要新增/更新。
- 是否需要写入占位符。

实际 Tavern 写入由 Capability node 执行。

对应当前：

- `initer/auto/settings.ts`
- `initer/manual/regex.ts`
- `initer/manual/worldbook.ts`
- `macro/placeholder.ts` 中的初始化行为

#### `era.macro.parse`

同步 nodeset，负责完整宏替换语义。对应当前：

- `macro/syntax.ts`
- `macro/registration.ts` 中 `createEraMacroSnapshot` 的纯转换部分

### 6.3 建议的业务 Node

以下是建议的稳定 `type_key`，实施时可在 planned 审查后微调，但不应把多个职责重新合并成巨型 node。

| Node type_key | flow_kind | 职责 |
| --- | --- | --- |
| `era.event.validate_transport` | process | 校验 Host Extension 送入的 JSON DTO，保留未知字段和缺失状态 |
| `era.event.classify` | decision | 按事件目录产生领域事件类别与路由 |
| `era.collection.reduce` | process | 用当前事件更新批次、边界和 timer token 状态 |
| `era.collection.route` | decision | 选择继续等待或关闭批次 |
| `era.batch.plan` | process | 把批次转换为完整 PlannedStep 列表 |
| `era.batch.validate_coverage` | decision | 检查每个来源事件是否恰好被覆盖 |
| `era.task.route` | decision | 路由 initialize/sync/api/update_mk |
| `era.chat.read_context` | data_store | 通过 Capability 获取完成当前任务所需的聊天数据 |
| `era.variables.read` | data_store | 通过 Capability 读取 chat/script/message 变量 |
| `era.variables.commit` | data_store | 通过 Capability 提交单次变量事务 |
| `era.message.ensure_mk` | process | 决定沿用或创建 MK；时间和随机值通过显式输入提供 |
| `era.message.write_mk` | data_store | 通过 Capability 把 MK 写回消息 |
| `era.sync.find_divergence` | process | 找到历史与记录的分歧位置 |
| `era.sync.route_rebuild` | decision | 选择增量同步或完全重算 |
| `era.crud.parse_commands` | process | 解析并验证 ERA 写入命令 |
| `era.crud.route_operation` | decision | 选择 insert/update/delete |
| `era.crud.apply_insert` | process | 应用插入语义并生成变更记录 |
| `era.crud.apply_update` | process | 应用更新语义并生成变更记录 |
| `era.crud.apply_delete` | process | 应用删除语义并生成变更记录 |
| `era.timetravel.rollback` | process | 根据 edit log 反向计算状态 |
| `era.timetravel.forward` | process | 根据 edit log 正向计算状态 |
| `era.snapshot.select` | process | 选择单点或区间快照 |
| `era.api.route` | decision | 路由写入、同步、查询等 ERA API 请求 |
| `era.notification.build` | process | 把业务结果转换为声明式通知命令 |
| `era.notification.publish` | io | 通过 Capability/Port 交给 Host Extension |
| `era.receipt.build_settlement` | process | 为来源事件形成 completed/ignored/failed/cancelled 结果 |
| `era.timer.build_command` | process | 生成启动/取消 collection timer 的声明式命令 |
| `era.timer.publish_command` | io | 请求 Host Extension 管理真实定时器 |
| `era.macro.select_snapshot` | decision | 选择含/不含元数据快照 |
| `era.macro.resolve_path` | process | 解析 `$ALLDATA` 或普通路径 |
| `era.macro.format_value` | process | 把对象、标量和缺失值转换为宏替换字符串 |

说明：

- JS AOT 的宿主副作用实际通过 Capability 注入；上表中的 `io`/`data_store` 是业务图形分类，必须在 descriptor 中准确声明 Capability。
- 若某个 Capability node 同时进行大量业务判断，应继续拆成“纯业务 node → Capability 边界 node”。
- 现有异步函数不能仅因为返回 Promise 就保留为大 node；先分离纯计算和真实 IO。

## 7. base_lib 设计

### 7.1 原则

base_lib 只能包含：

- 纯计算、纯转换、纯验证和格式化。
- 无可变模块级状态。
- 不读取 Tavern 全局、DOM、时间、随机数、storage、网络或文件。
- 不注册事件、定时器或宏。
- 不导入 node、Host Extension 或 runtime。

时间、随机值、用户名、角色名、聊天变量等宿主数据必须作为函数参数传入，或由 node 通过 Capability 获取后再传给 base_lib。

### 7.2 建议模块

| base_lib id | 当前来源 | 迁移内容 |
| --- | --- | --- |
| `era.data.encoding` | `utils/data.ts` | ERA 点号/引号转义与反转义、数组清洗、JSONL 解析、replace-array merge |
| `era.data.paths` | `core/crud/**`、`utils/data.ts` | 路径解析、路径访问、不可变更新辅助 |
| `era.data.templates` | `core/crud/insert/template.ts` | 模板继承、父模板查找、模板合并 |
| `era.data.edit_log` | `core/crud/**`、`core/timetravel.ts` | edit log 结构、正向/反向应用辅助 |
| `era.data.metadata` | `utils/era_data.ts` | 移除元字段、stat/meta 纯转换 |
| `era.event.catalog` | `events/catalog.ts` | 事件定义、group、await mode、collection window 配置查询 |
| `era.event.merge_rules` | `events/merger.ts` | combo、collision、coalescing 和来源关系纯规则 |
| `era.message.parse` | `utils/message.ts`、`core/key/mk.ts` | 消息内容、ERA tag、命令和 MK 的纯解析 |
| `era.message.keys` | `core/key/mk.ts` | MK 格式化和合法性判断；now/random 作为参数 |
| `era.timetravel` | `core/timetravel.ts` | rollback/forward/calculate-at/between 的纯算法 |
| `era.snapshot` | `core/snapshot.ts` | 单点和区间快照选择算法 |
| `era.text.tags` | `utils/string.ts` | XML/tag 匹配、代码围栏清理和块提取 |
| `era.text.character_macros` | `utils/text.ts` | 使用显式 user/char 输入执行文本替换 |
| `era.macro.syntax` | `macro/syntax.ts` | ERA 宏识别、路径解析和替换值格式化 |
| `era.api.contracts` | `events/types.ts`、`utils/constants.ts` | 纯 DTO 类型守卫、领域错误构造和结果归一化 |

### 7.3 外部纯依赖

`lodash`、OpenCC 等依赖只有在其使用方式保持纯函数时才能由 base_lib descriptor 的 `external_packages` 声明。不得依赖带模块级可变状态的全局正则或第三方单例。

对于 `createEraMacroRegex()` 这类带 `g` 标记的正则，每次调用必须创建新实例，不能把有状态正则保存在模块级。

## 8. Host Extension（plugin）设计

### 8.1 推荐逻辑组件

首版只有一个 Host Extension：`era.tavern.service_host`，服务于异步永久
`era.service`。Service workflow 顶层以 `status: "planned"` 登记它，明确
browser target、`vibeflow.port`、五类 Tavern Capability 与宿主资源限制。
Service 与 Macro 使用两个独立 AOT root/build；Macro workflow 顶层
`host_extensions` 固定为空。同步宏接线属于 `app/` adapter。

### 8.2 `era.tavern.service_host` 必须实现的功能

#### 生命周期

- `start()` 注册 Tavern 事件、脚本按钮和必要的 UI bridge。
- 支持 `eventMakeFirst`、`eventOn`、`eventMakeLast` 的目录声明顺序。
- 保存原始 handler 引用，`stop()` 使用 `eventRemoveListener` 精确注销。
- `stop()` 幂等；部分启动失败时可安全清理已注册资源。
- 响应 VibeFlow Host AbortSignal。
- 不在模块 import 或 `createWorkflowHost()` 时自动启动。

#### Port 与事件队列

- 提供标准 `vibeflow.port.receive/send`。
- 维护严格 FIFO 队列。
- 每个入队事件分配单调递增 sequence 和稳定 event id。
- 保存事件发生时刻，但时间由 Host Extension 提供，不让 base_lib 直接读取 `Date.now()`。
- `receive` 在无数据时挂起，并正确响应 AbortSignal。
- 队列必须设置显式上限；达到上限时使用可审计的拒绝/降级策略，不能无限增长。
- 不把 DOM、JQuery、函数、Promise 或浏览器 Event 对象送入 workflow。
- 将 Tavern 原始参数转换为 JSON DTO；无法无损序列化但业务确实需要的字段，应在 Host Extension 保留引用并通过受控 token 查询，不能伪造 JSON 值。

#### Receipt 与 generation barrier

- 为每个被接受事件创建 receipt Promise。
- workflow 通过 settlement 输出结算事件。
- 每个 receipt 只能结算一次。
- `waitThrough(sequence)` 只等待目标 sequence 及更早事件，不等待后来进入的 UI/API 事件。
- generation-barrier 事件监听器返回该等待 Promise。
- detached 事件监听器同步返回 `undefined`，避免等待尚未发生的生成事件形成死锁。
- 失败和取消结果至少在下一道覆盖它们的 generation barrier 中报告一次。
- `pagehide`/Host stop 时拒绝新事件，并把所有未结算 receipt 标记为 cancelled。

#### collection timer

- 接受 workflow 输出的 `schedule/cancel` timer 命令。
- 使用真实 `setTimeout/clearTimeout`。
- 超时后把带 token 的合成 timer 事件写回同一 Port。
- workflow 负责判断 token 是否仍有效；迟到 timer 只能被忽略，不能关闭错误批次。
- 边界事件到来时不在 Host Extension 中复制业务合并规则；它只保证事件顺序和 timer 投递。

#### Tavern Capability

至少提供以下契约，实际 operation 名称在 descriptor 设计阶段固定：

- `era.tavern.variables`
  - 读取/替换 script、chat、message 等作用域变量。
- `era.tavern.messages`
  - 获取消息、更新消息内容、读取最新楼层和必要聊天上下文。
- `era.tavern.worldbook`
  - 获取、创建、绑定和更新世界书及条目。
- `era.tavern.regex`
  - 获取、创建和更新角色卡正则。
- `era.tavern.identity`
  - 提供 user、char、chat id、script id 等宿主身份数据。

公共事件、通知和 timer 不作为领域 Capability 立即执行，而由 workflow 形成
outbound command，经 `era.service.out` Port 交给 Host，保证 receipt 先结算、
通知后在锁外启动。

每个 operation 都必须：

- 有 JSON Data Schema。
- 明确 `completion: immediate | suspend`。
- 接受并遵守 AbortSignal。
- 保留原始错误 cause，同时向 workflow 返回稳定的领域错误身份。
- 不在 provider 内重新实现 CRUD、同步、合并、回滚等业务规则。

#### 锁外通知

- 变量事务成功并输出 settlement 后，再发布 post-commit notification。
- notification listener 可以重入 ERA，但只能形成新事件，不能重入尚未完成的事务。
- 多个通知按声明顺序启动，但彼此失败隔离。
- 通知失败记录 warning/error，不反向把已提交事务改成失败。
- `console`/`toastr` 自身失败不能阻塞 generation barrier。

### 8.3 `app/` Macro Adapter 必须实现的功能

- 创建独立宏正则并调用 `registerMacroLike`。
- 宏回调同步读取当前 ERA stored stat，并原样作为 JSON 输入交给 workflow。
- 反转义、去元字段和快照构造全部由同步 workflow/base_lib 完成，adapter 不复制这些规则。
- 同步调用本构建的 `runWorkflow()` 并立即返回 `replacement: string`。
- 不使用 Promise，不把宏请求放进异步 Service 队列。
- 保存并幂等调用 `unregister()`。
- 不自行复制宏路径、`$ALLDATA`、缺失值和对象格式化规则；这些规则必须只存在于 `era.macro` workflow。

### 8.4 Host Extension 禁止事项

- 不把事件 combo、collision、同步策略或 CRUD 规则藏在插件中。
- 不持有另一份权威 ERA stat 缓存来绕过 Tavern 变量事务。
- 不导入 node 或 base_lib 私有实现。
- 不使用模块级可变业务状态在多个 Host 实例之间共享队列或快照。
- 不在 `start()` 完成前偷偷启动无法追踪的永久 Promise。
- 不吞掉所有错误并返回伪成功。

## 9. 非 VibeFlow 管理的部分

### 9.1 Vue/Pinia 前端

以下目录和职责保留为普通前端：

- `ui/App.vue`
- `ui/components/**`
- `ui/template/**`
- `ui/store.ts`
- `ui/processing/panel-data.ts`
- 组件局部的 loading/error/selected/open 状态
- CSS、scoped style、样式传送和视图动画

前端不得：

- 直接重算 ERA stat、edit log 或历史快照。
- 直接写 Tavern 变量实现业务操作。
- 复制 backend 的回滚、同步、查询或 CRUD 规则。

前端可以：

- 将用户动作转换成稳定 command DTO。
- 订阅后台发布的只读结果和状态事件。
- 维护纯表现状态。
- 在展示前做不影响业务含义的格式化。

### 9.2 DOM 与样式宿主代码

以下内容不进入流程图：

- 创建/删除挂载点。
- `createApp`、`createPinia`、`app.mount/unmount`。
- `teleportStyle/deteleportStyle`。
- JQuery DOM 操作。
- 页面显示刷新和 UI 组件生命周期。

`macro/dom-refresh.ts` 应保留为前端/宿主显示逻辑。它可以消费 workflow 发布的 `WriteDonePayload`，但不改变宏业务语义。

### 9.3 极小启动层

普通 TypeScript 启动层负责：

```ts
$(() => {
  // 1. 创建并 await start 两个 VibeFlow Host
  // 2. 启动永久 era.service runWorkflowAsync
  // 3. 挂载 Vue UI
  // 4. pagehide 时按确定顺序停止 Host、等待服务取消、卸载 UI
});
```

启动层不得实现事件规划、变量计算或 API 业务。它只组合产物和生命周期。

### 9.4 构建与资源

继续由现有前端工具链管理：

- `.vue` SFC 编译。
- SCSS/CSS 和样式注入。
- `?raw`、HTML、TXT 等资源导入。
- Tavern Helper 本地热更新和最终脚本打包。

VibeFlow 生成 `esm-module` 产物，再由 ERA 的 Webpack 构建消费。初始化使用的世界书文本、正则对象和 HTML 模板可以继续作为普通静态资源；进入 workflow 时必须转换为 JSON 字符串/对象，不能让 node 直接依赖 Webpack loader。

### 9.5 ERA 专用质量检查器

现有 ERA TypeScript/Vue/中文注释质检器保留在 VibeFlow 外部，并继续进入项目 `verify`：

- VibeFlow 负责图、契约、资源边界、Promise 所有权、Capability 和 AOT 构建检查。
- ERA 质检器负责 TS/Vue 规模、依赖、副作用策略、中文注释数量与质量、baseline ratchet。
- 两者不能互相替代。

## 10. 当前源码迁移总表

| 当前路径 | 主要归属 | 处理方式 |
| --- | --- | --- |
| `core/crud/**` | node + base_lib + nodeset | 纯数据算法进 base_lib；insert/update/delete 和事务步骤在图上可见 |
| `core/key/mk.ts` | node + base_lib + Capability | 解析/格式进 base_lib；时间随机输入、消息写入走 Capability |
| `core/rollback.ts` | 历史参考；纯算法按需复用 | 不建立独立生产 task；`rollbackTo` 继续走定向 sync |
| `core/snapshot.ts` | base_lib + query node | 纯快照选择进 base_lib，查询入口做成 node |
| `core/sync.ts` | nodeset + base_lib + Capability | 分歧计算进 base_lib；读写和重算顺序进图 |
| `core/timetravel.ts` | base_lib + process node | 算法进 base_lib；作为快照/回滚步骤由 node 包装 |
| `events/catalog.ts` | base_lib + config/contracts | 稳定事件目录、监听顺序、await mode 和窗口规则 |
| `events/types.ts` | Data Schema + TS types | 函数/Promise 类型改为 JSON command/outcome DTO |
| `events/merger.ts` | base_lib + planning node | 纯合并规则进 base_lib；plan batch 作为可审查节点 |
| `events/scheduler.ts` | service workflow + Host Extension | 业务调度迁入永久 loop；队列/receipt/timer/lifecycle 迁入插件 |
| `events/queue.ts` | Host Extension | Port 队列和入口 facade |
| `events/dispatcher.ts` | dispatch nodeset | 任务分支、顺序和结果显式化 |
| `events/handlers/**` | nodeset + node + Capability | 按 initialize/sync/api/update_mk 拆分 |
| `events/emitters/**` | notification node + Host Extension | workflow 生成命令，插件执行真实 event emit |
| `macro/syntax.ts` | sync node + base_lib | 完整宏业务语义进入 `era.macro` |
| `macro/registration.ts` | app adapter + sync workflow | 注册/读取宿主数据在 adapter；解析在 workflow |
| `macro/dom-refresh.ts` | 非 VibeFlow UI/宿主 | 只刷新已显示 DOM |
| `macro/placeholder.ts` | initialize nodeset + Capability | 是否写入由 workflow 决定，实际消息操作走 Capability |
| `initer/auto/**` | initialize nodeset + Host lifecycle | 去掉模块级 Promise，改为显式初始化状态/事件 |
| `initer/manual/**` | initialize nodeset + Capability + 静态资源 | 决策进图，资源由构建系统管理，实际写入走 Capability |
| `ui/**` | 非 VibeFlow Vue/Pinia | 保留表现层，通过 command/event 与后台交互 |
| `utils/constants.ts` | Data Schema + config + TS types | 拆成跨边界 DTO、事件常量和纯业务常量 |
| `utils/data.ts` | base_lib | 纯数据转换 |
| `utils/era_data.ts` | base_lib + Capability | 纯转换与 Tavern 变量读写分开 |
| `utils/message.ts` | base_lib + Capability node | 纯解析与真实消息读取/重试分开 |
| `utils/regex.ts` | Capability node/Host Extension | Tavern 正则读写 |
| `utils/worldbook.ts` | Capability node/Host Extension | 世界书读写 |
| `utils/string.ts` | base_lib + clock/random Capability input | 纯字符串算法进 base_lib；随机数不在 base_lib 读取 |
| `utils/text.ts` | base_lib + identity Capability | user/char 显式作为输入 |
| `utils/log.ts` | VibeFlow trace + Host logger | 业务 trace 用 VibeFlow；宿主/UI 日志保留普通 logger |
| `index.ts` | 极小启动层 + Host Extension | 事件注册进插件；入口只启动/停止 Hosts 和 UI |

## 11. 跨边界数据契约

所有进入 VibeFlow 的数据必须是 JSON 可表达 DTO。

### 11.1 输入事件

建议最小结构：

```ts
interface EraTransportEvent {
  id: string;
  sequence: number;
  type: string;
  occurredAt: number;
  payload: unknown;
  source: "tavern" | "ui" | "era-api" | "timer";
}
```

不得包含：

- Promise
- function
- Error 实例
- DOM/JQuery/Event 对象
- Vue Proxy/Ref
- AbortController

### 11.2 业务错误

可恢复错误转换为：

```ts
interface EraFailure {
  code: string;
  message: string;
  category: "input" | "domain" | "tavern" | "cancelled";
  retryable: boolean;
  details?: Record<string, unknown>;
}
```

Host Extension 负责保留原始 cause 到日志/trace；跨 workflow 只传稳定错误 DTO。

### 11.3 事件结算

```ts
type EraSettlement =
  | {eventId: string; sequence: number; status: "completed"; taskId: string; relation: string; value?: unknown}
  | {eventId: string; sequence: number; status: "ignored"; reason: string}
  | {eventId: string; sequence: number; status: "failed"; error: EraFailure}
  | {eventId: string; sequence: number; status: "cancelled"; reason: string};
```

每个接受的事件必须恰好产生一次 settlement。

### 11.4 通知命令

禁止继续在 workflow 内传递 `() => void | Promise<void>`。改为：

```ts
type EraNotificationCommand =
  | {kind: "emit_write_done"; payload: unknown}
  | {kind: "emit_query_result"; payload: unknown}
  | {kind: "refresh_displayed_macros"; payload: unknown}
  | {kind: "show_warning"; message: string};
```

## 12. 状态与并发不变量

迁移后必须保持以下不变量：

1. ERA Service 同一时刻只有一个状态事务 worker。
2. 事件按 Host Extension sequence 进入单一 FIFO。
3. generation barrier 只等待其 high-water sequence，不等待未来事件。
4. `MESSAGE_SWIPED` 等 detached 事件不等待未来 `GENERATION_STARTED`。
5. 每个接受事件恰好结算一次。
6. planner 漏掉来源事件时显式失败，不能永远 pending。
7. 变量提交先完成，receipt 后结算，post-commit notification 最后在锁外运行。
8. notification 失败不回滚已提交事务。
9. notification 重入只创建下一批事件。
10. pagehide 后拒绝新事件、取消未结算事件并停止等待中的 receive。
11. recoverable event failure 不终止永久 workflow。
12. 永久 loop 不使用无界 collect，不产生随迭代线性增长的内存集合。
13. 宏读取 generation barrier 释放后的同步快照，并立即返回字符串。
14. Vue 不维护第二份权威 ERA 变量状态。

## 13. 工程与工具链方案

ERA 当前主项目使用 pnpm、TypeScript 6 和 Webpack；VibeFlow 0.7.0 AOT 要求 Node.js `>=22.12`、TypeScript `>=7 <8`、esbuild `0.28.x` 和 `package-lock.json`。

首版采用隔离工具链：

```text
ERA-vibeFlow/
├── project/                 # VibeFlow AOT 项目及其 npm lock
├── generated/               # VibeFlow esm-module 构建产物
├── app/                     # Tavern 启动层与 Vue 前端，使用 ERA 主工具链
└── docs/
```

要求：

- VibeFlow AOT 子项目独立维护 `package.json`/`package-lock.json`。
- 主前端继续使用 pnpm；不得让两个 lockfile 管理同一个 `node_modules`。
- Webpack 只消费经过 VibeFlow 构建并带有效 `vibeflow-build.json` 的 ESM 产物。
- 构建脚本顺序固定为：VibeFlow review/validate → AOT build → ERA typecheck/quality/test → Webpack build。
- 不手工修改 generated workflow。

如果未来 VibeFlow 正式支持 pnpm lockfile，再评估合并工具链；不在 ERA 中 patch 内核绕过锁文件检查。

## 14. 分阶段迁移

### 阶段 0：行为冻结与测试基线

- 列出现有 Tavern 事件、API、宏、变量结构和 UI 命令。
- 为当前 scheduler、merger、CRUD、timetravel、macro 建立可复用 fixture。
- 锁定 generation barrier、receipt、通知重入和 pagehide 行为。
- 不先清理或重写现有 ERA 源码。

### 阶段 1：建立 planned VibeFlow 架构

- 新建真实 `era.service` 和 `era.macro` config。
- 用 planned nodeset 表达本文主要模块。
- 定义 Data Schema 与 Capability descriptor，并在 Service workflow 顶层登记
  planned Host Extension；planned 阶段不创建占位 descriptor 或 factory。
- 运行正式 `review`，人工审核架构图后再实现。

### 阶段 2：迁移纯 base_lib

优先迁移：

1. 数据转义与路径工具。
2. template/CRUD 纯算法。
3. timetravel/snapshot。
4. event catalog/merge rules。
5. macro syntax。

所有函数使用现有 fixture 与旧实现做 differential test。

### 阶段 3：实现同步宏

- 实现 `era.macro` workflow。
- 实现 `app/` 同步 Macro Adapter；Macro AOT root 不启用 Host Extension。
- 验证回调返回值不是 thenable。
- 对比现有 `parseEraMacroText` 的全部 fixture。
- 验证启动/停止不会重复注册宏。

### 阶段 4：实现 Service Host 与空业务循环

- 为同一 `era.tavern.service_host` ID 新增真实 descriptor 与 TypeScript
  factory，并将 workflow 使用项切换为 `implemented`。
- 实现 FIFO、AbortSignal、receipt 和 timer 合成事件。
- 用 fake Tavern 和测试 Port 跑永久 loop。
- 暂时只做 echo/settlement，不写真实变量。
- 验证高压事件、队列上限、pagehide 和长期内存。

### 阶段 5：迁移事件规划和只读查询

- 迁移 catalog、merger、plan batch。
- 迁移 snapshot/timetravel query。
- UI 查询改走新 Service。
- 不与旧 ERA 同时注册同一组生产事件监听器。

### 阶段 6：迁移写事务

- 依次迁移 CRUD、MK、sync、rollback。
- 每种操作使用旧/新实现对同一 fixture 做结果比较。
- 增加提交失败、取消和 notification 失败测试。

### 阶段 7：迁移初始化与宿主功能

- 世界书、正则、占位符和设置初始化改走 Capability。
- 处理静态 TXT/HTML/regex 资源。
- 删除旧后台入口中已由 Host Extension 承担的监听器和全局状态。

### 阶段 8：前端接入与正式切换

- Vue 只保留展示和 command 发送。
- 本地酒馆中只启用一个 ERA 实现，防止双监听。
- 完成真实生成、编辑、swipe、回滚、API 和 UI 联调。
- 通过全部门禁后再移除旧后台实现。

## 15. 测试与验收

### 15.1 VibeFlow 架构门禁

- `review` 顶层通过。
- `ARCHITECTURE.jsonc` 与真实 config 一致。
- expanded SVG 能看清 service loop、任务分支、事务和 Capability 边界。
- 无 node 直接导入 node。
- base_lib 无宿主 IO、时间、随机和可变全局状态。
- 同步 macro build 不含 suspend/deferred/detached。
- Service loop 每轮经过 receive，且无无界 collect。

### 15.2 Host Extension

- start/stop 顺序正确且 stop 幂等。
- 热重载不叠加监听器。
- `eventMakeFirst/Last` 顺序与当前 catalog 一致。
- FIFO、queue limit、receipt exactly-once 和 waitThrough 正确。
- receive 遵守 AbortSignal。
- pagehide 后所有 pending receipt 得到 cancelled。
- timer token 能忽略迟到 timer。
- 并发 notification 失败隔离。

### 15.3 业务等价

- CRUD、edit log、snapshot、timetravel 和 rollback fixture 与旧 ERA 一致。
- history change、edited、swipe-regeneration、manual、api-write 同步路径一致。
- planner 对 combo/coalesced/ignored 的来源关系一致。
- generation barrier 保持 fail-open 提示策略。
- 宏对普通路径、`-withmeta`、`$ALLDATA`、缺失值、对象和多模态文本行为一致。
- 初始化世界书、正则和占位符结果一致。

### 15.4 前端

- Vue 不直接写业务变量。
- 悬浮球、展开视图、快照查询、回滚按钮和设置界面可用。
- UI loading/error 不影响后台事务。
- app、样式和挂载点在 pagehide 时完全清理。

### 15.5 性能

- 长时间空闲时永久 loop 不忙轮询。
- 事件持续运行时 trace、receipt、timer 和 detached 集合不线性泄漏。
- 大 stat 在 Data Schema 校验和节点传递中的性能可接受。
- 必要时减少大对象穿过的细粒度 node 数，但不能把业务顺序重新藏进单个巨型 node。

## 16. 明确不做的事情

- 不把 Vue SFC、DOM 或 CSS Node 化。
- 不把 Tavern globals 直接放进 base_lib。
- 不用 `external=true` 或 Host Extension 隐藏 ERA 内部业务规则。
- 不让 node 通过代码导入另一个 node。
- 不把 callback、Promise、Error、DOM 对象穿过 workflow。
- 不用普通 edge cycle 模拟 scheduler。
- 不在永久 loop 中无限 collect。
- 不让宏异步化或改成最终一致缓存语义。
- 不同时启用旧 ERA 和新 ERA 的生产事件监听器。
- 不在迁移过程中顺手大规模重写 Vue 外观。
- 不手工修改 VibeFlow `kernel/`、`run.py` 或完整性清单来绕过限制；内核升级
  只能从可信分发包按完整性清单成组同步。

## 17. 后续可能需要 VibeFlow 改进、但不阻塞首版迁移的事项

新版内核已经提供 workflow 顶层 `host_extensions` 选择，因此原“workflow 级
Host Extension 选择”改进项已解决，不再列为后续前置事项。

1. **多工作流 Application Host**
   - 一个应用统一组合 `era.service` 异步 Host 和 `era.macro` 同步 Host。
2. **pnpm lockfile 支持**
   - 允许 ERA 主项目与 AOT 共用受验证的 pnpm 工具链。
3. **更完整的 TS/Vue quality**
   - 当前仍由 ERA 专用质检器补足中文注释和 Vue 源码质量。

这些改进会减少工程胶水，但当前均可通过两个构建、隔离 npm 子项目、极小启动层和 ERA 质检器曲线解决，不应作为开始迁移的前置条件。

## 18. 完成定义

只有同时满足以下条件，才可以称为“ERA 后台已整体迁移到 VibeFlow”：

- 影响 ERA 业务结果的全部后台路径均由登记的 workflow/nodeset/node/base_lib 执行。
- Tavern 真实副作用全部通过声明的 Capability 和 Host Extension。
- 旧 scheduler/dispatcher/handler 不再作为并行生产实现运行。
- 同步宏由 VibeFlow 同步 workflow 计算。
- Vue 只承担表现和命令入口。
- VibeFlow review/AOT build、ERA quality/typecheck/test 和真实酒馆联调全部通过。
- pagehide、热重载、生成栅栏、回执、失败隔离和长期内存满足本文不变量。

最终目标可以概括为：

> VibeFlow 管理 ERA 后台业务架构和宿主插件生命周期；Vue 管理前端表现；极小启动层只负责组合和启停，不再承载 ERA 业务。
