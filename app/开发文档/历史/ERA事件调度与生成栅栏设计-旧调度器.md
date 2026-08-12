# ERA 事件调度与生成栅栏设计（旧调度器历史稿）

> 归档说明：本文描述迁移前的 `EventScheduler`、Ticket 和 Dispatcher 设计。
> 当前生产实现已由 VibeFlow Service Host、receipt/high-water barrier、collection/planner
> 与工作流 task nodeset 接管。现行说明见 `../ERA事件调度与生成栅栏设计.md`。

本文记录 ERA 事件模块的职责边界、时序保证和扩展规则。它既是本次改造的设计说明，也是后续新增事件时的维护指南。

## 1. 要解决的问题

ERA 需要在酒馆的聊天历史发生变化后重新计算变量。普通情况下，这项工作可以在后台异步完成；但当酒馆准备生成提示词时，宏替换必须看到已经同步完毕的状态。

过去的队列只能表达“收到事件后稍后处理”，无法表达：

- 某个原始事件最终由哪个合并任务负责；
- 一个任务什么时候真正提交了 ERA 状态；
- 酒馆应该等待哪些任务，以及何时可以继续生成；
- 事件被合并、忽略、取消或执行失败时，等待方应该得到什么结果。

新的统一规则是：

> 每次真实生成开始前，ERA 必须先结算该生成事件序号之前的全部状态任务。

这是一条通用的一致性规则，而不是只针对“新建 swipe”增加的条件分支。

## 2. 不可破坏的时序

### 2.1 不能阻塞 `MESSAGE_SWIPED`

酒馆在新建 swipe 时依次执行：

```text
MESSAGE_SWIPED
  → Generate('swipe')
  → GENERATION_STARTED
  → 构建提示词
  → 发送请求
```

ERA 需要同时看到 `MESSAGE_SWIPED` 和 `GENERATION_STARTED`，才能把它们识别为“滑动并重新生成”。如果 `MESSAGE_SWIPED`
的监听器等待这个组合任务，酒馆就永远无法走到 `GENERATION_STARTED`，两边会互相等待。

因此：

- `MESSAGE_SWIPED` 只负责非阻塞入队；
- 非 dry-run 的 `GENERATION_STARTED` 才是生成栅栏；
- 栅栏等待由两个事件合并而成的状态任务提交完毕。

### 2.2 等待事件序号，不等待队列清空

每个原始事件入队时获得单调递增的 `sequence`。生成栅栏只等待 `sequence` 不大于自身序号的事件进入终态。

不能使用“等待整个队列为空”，因为栅栏出现后仍可能有界面刷新、API 查询或其他无关事件继续入队。如果等待队列为空：

- 后来的事件会无故延长当前生成；
- 高频事件可能让生成永久饥饿；
- 等待关系无法反映真实因果。

事件序号构成一个明确的高水位线：栅栏之后才出现的工作不属于本次生成的前置条件。

### 2.3 状态提交与外部通知分离

Ticket 的完成含义是：相关 ERA 状态操作已经成功提交，或事件已经以忽略、失败、取消等方式明确结算。

`era:writeDone` 是提交后的外部通知，不属于状态事务本身。通知必须在 scheduler 的执行锁释放后发送。否则，外部监听器在
`writeDone` 回调中再次调用 ERA 时，可能等待一把仍由当前任务持有的锁，造成重入死锁。

## 3. 分层结构

事件系统保留原有“监听 → 收集 → 合并 → 分发 → handler”轮廓，但每层只承担一种职责：

```text
事件目录
  声明监听顺序、事件分组、收集窗口和等待策略
      ↓
入口适配器
  保存全部参数，分配 id / sequence，决定是否向酒馆返回 Promise
      ↓
EventScheduler
  管理队列、收集窗口、单 worker、Ticket 和生成高水位线
      ↓
纯规划器
  把原始事件合并为领域任务，并保留所有来源事件
      ↓
Dispatcher
  根据任务声明准备上下文并调用 handler
      ↓
提交后通知
  在执行锁之外发送 writeDone 等事件
```

### 3.1 原始事件

原始事件只保存可以安全流转的数据：

```ts
interface RawEvent {
  id: string;
  sequence: number;
  type: string;
  args: unknown[];
  occurredAt: number;
}
```

必须保存 `args` 全部参数，而不是只保存第一个 `detail`。例如 `GENERATION_STARTED(type, options, dryRun)`
的生成类型和 dry-run 标记都属于等待策略所需信息。

Promise、resolve 函数、`AbortSignal`
和可变的提示词对象不进入原始事件的深拷贝流程；这些运行态信息由 scheduler 的回执表单独持有。

### 3.2 Ticket 与结果

每个入队事件都有一张 Ticket：

```ts
interface EventReceipt<T = void> {
  eventId: string;
  sequence: number;
  done: Promise<EventOutcome<T>>;
}

type EventOutcome<T = void> =
  | {
      status: 'completed';
      taskId: string;
      relation: 'primary' | 'combined' | 'coalesced';
      value?: T;
    }
  | { status: 'ignored'; reason: string }
  | { status: 'failed'; error: unknown }
  | { status: 'cancelled'; reason: string };
```

每张 Ticket 必须且只能结算一次。事件无论执行、合并、忽略、失败还是因脚本卸载取消，都不能从系统中静默消失。

scheduler 的回执表只保留尚未结算的 Ticket，调用方自己持有的 `done`
Promise 仍保存最终结果。已结算失败会进入独立的“待报告失败”表，在下一道覆盖其序号的生成栅栏中报告一次；成功 Ticket 不会因为长期没有再次生成而永久滞留在调度器内存中。

### 3.3 领域任务

合并器输出表达“ERA 要做什么”的领域任务，而不是伪造新的酒馆事件名。同步任务应显式描述：

- `reason`：为何同步；
- `target`：自动计算、指定楼层，或最新楼层的上一层；
- `context`：dispatcher 在执行前需要准备哪些消息和 MK 上下文。

dispatcher 只解释任务声明，不再通过事件名称猜测“是否跳过 MK”“是否定向同步”等例外。

## 4. 收集、合并与结算

### 4.1 收集窗口

保留 ERA 原有时间语义：

- 默认事件：100ms；
- `MESSAGE_SWIPED`：500ms；
- `MESSAGE_UPDATED`：1500ms；
- swipe 与 generation 的组合最大间隔：600ms。

收集由“定时器”和“立即处理信号”竞速。生成边界形成有效组合时，立即信号会提前关闭当前窗口，不需要每 20ms 轮询。

每一批任务拥有独立收集窗口。worker 执行期间到达的新事件进入下一批，重新按照该批第一个事件的策略收集。

`dry_run` generation 是透明的预演事件：它自己会以 `ignored` 结算，但不会关闭收集窗口，也不会截断
`MESSAGE_SWIPED → 真实 GENERATION_STARTED` 或 `MESSAGE_UPDATED → 真实 GENERATION_STARTED` 的邻接关系。

### 4.2 来源事件不能因合并丢失

合并器输出的每个执行步骤都携带来源事件 ID：

- combo：所有来源 Ticket 在合成任务完成后以 `combined` 结算；
- 同组覆盖：旧事件与最终任务一起在执行后以 `coalesced` 结算；
- 普通任务：主要来源以 `primary` 结算；
- 孤立 detector、starter 或对冲事件：产生明确的 `ignored` 结果；
- handler 抛错：所有相关来源以 `failed` 结算。

这样既保留防抖和合并效率，也不会让任何等待方悬空。

## 5. 生成栅栏

入口使用最高可用监听优先级注册 `GENERATION_STARTED`。对于 dry-run，事件照常记录但不阻塞；对于真实生成：

1. 事件入队并获得序号；
2. 生成边界立即关闭当前收集窗口；
3. 入口向酒馆返回 `waitThrough(sequence)`；
4. scheduler 依次结算该序号及以前的全部事件；
5. 若全部成功或被明确忽略，栅栏正常释放；
6. 若存在失败，记录结构化错误、显示醒目提示，然后 fail-open 放行酒馆。

栅栏没有自动放行的固定超时。等待超过 5 秒只产生一次 watchdog 警告，不改变 Promise 状态；固定时间放行会重新制造“ERA 仍在写状态，酒馆已经构建提示词”的竞态。

## 6. 宏替换

生成宏使用 Tavern Helper 的 `registerMacroLike` 注册。宏回调同步读取 `getEraData()`：

- 生成栅栏先保证状态已经同步；
- 随后的宏回调只做同步解析；
- 不再通过 `GENERATE_AFTER_DATA → era:getCurrentVars → era:queryResult` 往返；
- 不再存在事件响应晚于提示词发送的问题。

宏支持 `{{ERA:path}}`、`{{ERA-withmeta:path}}`、`$ALLDATA`，并处理 Tavern
Helper 传入的字符串与多模态文本片段。宏模块不按 role 过滤文本。

旧的 `era:getCurrentVars` 与 `era:queryResult` 协议仍供外部脚本使用，但生成宏不再依赖它们。

ERA 内部存储会转义键和值中的点号与引号。同步宏快照在解析前必须先执行
`unescapeEraData`，保证宏输出与既有查询 API 一致，不向角色卡作者暴露 `__DOT__`、`__DQUOTE__` 等内部占位符。

## 7. 错误、卸载与重入

- worker 的运行状态必须由 `try/finally` 恢复，单个任务失败不能锁死后续队列；
- handler 不得记录错误后伪装为成功，错误必须传播到 dispatcher 和 Ticket；
- 写入类 `era:*` API 必须在同一个领域任务中完成“写消息指令 →
  ERA 状态同步”；不能把提交职责交给稍后才入队的 debounce 事件，否则生成高水位看不到这项未来工作；
- 既有 `era:apiWrite` 名称保留为状态提交后的兼容广播，但 ERA 不再监听它来启动第二次同步；
- 生成栅栏遇到失败时采用 fail-open，同时明确提示本次请求可能读取到旧状态；
- `pagehide` 后 scheduler 停止接收新任务，并把所有未结算 Ticket 置为 `cancelled`；
- dispose 和正常执行之间即使发生竞态，同一 Ticket 也只能结算一次；
- 提交后通知在锁外按声明顺序启动、并发结算，不建立跨批次的全局通知链；因此通知回调可以重新入队，也可以等待重入任务的新通知，而不会被一把“隐形通知锁”卡住。

## 8. 扩展新事件的标准步骤

新增事件时，按以下顺序设计：

1. 在事件目录声明事件分组、监听顺序、收集窗口和等待策略；
2. 确认它是酒馆原始事件，还是 ERA 内部领域任务，禁止混用名称；
3. 为原始事件到领域任务的转换增加纯规划规则；
4. 明确它与其他事件组合、覆盖或对冲时，所有来源 Ticket 的结算关系；
5. 只有在酒馆发射点确实 `await` 事件监听器时，才允许配置 Barrier；
6. Barrier 应等待事件序号高水位，而不是等待队列为空；
7. 为主要路径、合并路径、失败与 dispose 增加假时钟单元测试。

如需在 Promise 中返回 ERA 内部数据，可以使用泛型 Ticket；不要假设酒馆会接收监听器 Promise 的 resolved
value。酒馆事件 Promise 的职责是建立完成屏障，业务返回值应通过 ERA 内部接口或已有的带关联标识协议传递。

## 9. 本轮边界

- 不监听 `MESSAGE_SWIPE_DELETED`；
- 不新增公开 `Era` Promise API；
- 不修改既有 `era:*` 请求和响应协议；
- 不把 ERA-Test-Harness 或浏览器自动化加入单元测试门禁；
- 保留原有 500ms/600ms/1500ms 的行为含义。
