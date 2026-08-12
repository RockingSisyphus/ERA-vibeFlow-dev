# VibeFlow 长期服务工作流与 AOT 宿主扩展 RFC（历史提案）

> 归档说明：本文写于相关能力尚未进入 VibeFlow 核心时。当前项目已使用
> VibeFlow 0.13.2 的 async workflow、Port、Capability 与 planned/implemented
> Host Extension；本文仅作为需求演进记录。

## 摘要

VibeFlow 当前的 JS/TS AOT 模型适合“输入一次，执行有限流程，返回一次结果”的 workflow。对于事件驱动的浏览器脚本、WebSocket 服务、桌面后台进程、游戏状态机和队列消费者，程序需要在一次启动后长期等待输入，为每条消息产生独立结果，并在宿主要求时可控地停止。

本 RFC 建议在不放宽现有有限 workflow 约束的前提下，新增一等 `service workflow`，并为 JS/TS AOT 增加：

1. 可取消、必须让出执行权的安全无界循环；
2. 运行期可继续接收输入的类型化双向端口；
3. 按消息关联的 receipt/reply/error 语义；
4. service 级状态、停止、`finally` 和逐消息 trace；
5. 可进入 browser/node AOT 产物的 `host_extension` 扩展点。

本提案不将任何特定宿主 API 写入 VibeFlow 核心。例如酒馆事件、DOM、WebSocket 和 Electron IPC 应由项目级 `host_extension` 与 Capability 实现。

## 背景与问题

当前 JS/TS AOT 产物导出：

```ts
export async function runWorkflow(
  inputs: WorkflowInputs,
  options?: WorkflowRunOptions,
): Promise<WorkflowOutputs>;
```

它具有明确且有价值的语义：

- 输入在调用开始时一次性提供；
- 每次调用的 context、trace、Capability 包装和异步任务隔离；
- workflow 完成时返回一个最终结果；
- loop 必须有显式停止条件和迭代上限；
- detached task 在调用返回前完成跟踪与清理。

这些保证不应被删除或放宽。问题是另一类程序没有对应的一等模型：

```text
启动
  → 等待外部消息
  → 处理一条或一批消息
  → 为这条消息返回结果
  → 继续等待
  → 收到停止请求后清理并退出
```

当项目尝试用现有机制表达这类程序时，只能在下列方案中取舍：

- 每条事件新调用一次 `runWorkflow()`，但无法在调用间保留可审核的队列、序号、水位和批次状态；
- 把长期状态全部放进宿主 adapter，但关键架构不再出现于 workflow 与审查图；
- 把完整调度器包成一个 `external` node，但其内部控制流、依赖和副作用成为不透明黑盒；
- 滥用永不结束的 Promise 或循环，但失去取消、清理、活性检查和稳定 ABI。

## 设计目标

1. 让事件驱动、长期运行的程序可由真实 workflow 和 nodeset 组织，而非只能由不透明 adapter 实现。
2. 保留 VibeFlow 现有的显式 edge、contract、Capability、静态检查和 AOT 优势。
3. 防止无界循环在浏览器主线程上忙等或无法取消。
4. 为每条消息提供独立的成功、失败、取消和 trace，而不只有 service 最终结束结果。
5. 宿主特化代码可被复用和打包，但不得绕过图上的业务主流。
6. 现有有限 workflow 的 config、ABI、构建产物和运行语义保持向后兼容。

## 非目标

- 不用 service loop 替代浏览器、Node.js 或其他宿主的底层 event loop。
- 不在 VibeFlow 核心内置 DOM、WebSocket、Electron、酒馆或其他宿主 API。
- 不允许普通 node 保留隐藏的模块级可变业务状态。
- 不允许普通有限 loop 通过取消上限偷偷变成 service。
- 不承诺强制终止忽略 `AbortSignal` 的 Promise 或同步死循环。
- 不提供宿主副作用的自动事务回滚或 exactly-once 保证。
- 不把业务算法、业务调度策略或特定宿主事件名移入内核。

## 提案一：一等 Service Workflow

### 显式区分两种 workflow

概念配置：

```jsonc
{
  "workflow": {
    "mode": "service",
    "input_port": {
      "type": "service.request",
      "reply_type": "service.reply"
    },
    "service": {
      "body": "project.process_request",
      "max_sync_steps": 1000,
      "shutdown_timeout_ms": 5000
    }
  }
}
```

`mode` 默认值保持为 `finite`，因此现有 config 无须修改。

```text
finite workflow
  runWorkflow(inputs) -> Promise<final outputs>

service workflow
  startWorkflowService(options) -> WorkflowServiceHandle
```

service workflow 应被编译为专用的静态控制流，不要在 AOT 产物中嵌入通用 graph interpreter。

### 生成的顶层 ABI

概念 TypeScript ABI：

```ts
export type ServiceReceiptStatus =
  | "completed"
  | "failed"
  | "cancelled";

export interface ServiceReceipt<TReply> {
  readonly id: string;
  readonly done: Promise<{
    readonly status: ServiceReceiptStatus;
    readonly reply?: TReply;
    readonly error?: VibeFlowWorkflowError;
  }>;
}

export interface WorkflowServiceHandle<TRequest, TReply> {
  readonly done: Promise<void>;
  readonly signal: AbortSignal;

  send(request: TRequest): ServiceReceipt<TReply>;
  stop(reason?: unknown): Promise<void>;
}

export function startWorkflowService(
  options?: WorkflowServiceOptions,
): WorkflowServiceHandle<ServiceRequest, ServiceReply>;
```

核心只定义服务生命周期和消息关联。项目可在宿主适配层上另行包装 `sendAndWait()`、fire-and-forget 或领域专用 API。

### 服务状态

service 内部可持有当次服务实例的 carry state，但必须遵守：

- 每次 `startWorkflowService()` 创建独立实例；
- 状态不在多个 service 实例间共享；
- 状态只在显式 carry 中流转，不允许 node 使用模块级可变变量隐藏状态；
- browser/node 可移植路径默认仍使用 JSON 可表达数据；
- 不把 Promise resolver、DOM、socket 或其他宿主对象放入 carry，它们应由 host extension 持有。

## 提案二：安全无界循环

### 不放宽现有 loop

现有 `vibeflow.loop.while` 仍必须保留显式停止条件和迭代上限。service 使用独立的系统类型，例如：

```text
vibeflow.service.loop
```

这能避免旧 config 因默认值或 policy 改变而意外获得无界执行能力。

### 强制 yield 规则

每个 service loop 从一次消息处理返回等待状态前，必须到达内核能识别的 yield point。yield point 不能仅通过“函数返回 Promise”猜测，而应由一等端口读取或带 effect metadata 的 Capability operation 声明。

构建期应拒绝：

```text
SERVICE.LIVENESS.NO_YIELD_PATH
SERVICE.LIVENESS.UNBOUNDED_SYNC_PATH
SERVICE.LIFECYCLE.NOT_CANCELLABLE
```

生成代码还应维护 `max_sync_steps`。即使静态分析漏掉某条动态路径，也应在长时间占用主线程前以稳定错误码终止服务。

### 等待与超时

一等端口应支持：

```ts
type ReceiveResult<T> =
  | { readonly kind: "message"; readonly id: string; readonly value: T }
  | { readonly kind: "timeout" }
  | { readonly kind: "stopped" };
```

这允许项目表达“等待下一条消息或收集窗口到期”，而不要求内核了解任何领域事件。

## 提案三：类型化双向端口

### 核心与宿主的责任

VibeFlow 核心负责：

- 生成类型化 `send()` 和 receipt；
- 为每条消息分配稳定的 service-local ID；
- 在消息、reply、error 和 trace 之间保留关联；
- 保证每个 receipt 最终以 completed/failed/cancelled 之一且仅一次结算；
- 服务停止时取消尚未结算的 receipt；
- 对 request/reply 执行 Data Schema 校验并生成 `.d.ts`。

host extension 负责：

- 将外部事件转换为 `send()`；
- 决定宿主回调是否等待 receipt；
- 把取消、热重载、页面卸载或 socket 断开转换为 `stop()`；
- 持有不可 JSON 化的宿主对象；
- 实现具体 IO Capability。

### 背压与队列上限

service 必须显式声明或接受 policy 默认的队列约束：

```jsonc
{
  "service": {
    "queue": {
      "max_pending": 1024,
      "overflow": "reject"
    }
  }
}
```

首版建议只支持 `reject`，不在内核中默认实现 drop-oldest、drop-newest 或合并。丢弃和合并是业务语义，应使用显式 node/nodeset 或 host extension 策略表达。

## 提案四：生命周期、错误和观测

### 状态机

service handle 至少应有：

```text
created → running → stopping → stopped
                    └→ failed
```

规则：

- `send()` 只在 running 状态接受新消息；
- `stop()` 幂等，并可在 created/running/stopping 状态安全调用；
- stop 首先停止接收新消息，然后按声明策略 drain 或 cancel pending 消息；
- fatal workflow error 使 service 进入 failed，并结算所有 pending receipt；
- `done` 只在清理完成后 settle。

### 停止策略

概念配置：

```jsonc
{
  "service": {
    "shutdown": {
      "pending": "cancel",
      "in_flight": "cooperative",
      "timeout_ms": 5000
    }
  }
}
```

首版不应声称能硬终止忽略 signal 的同步函数或 Promise。超时后应以稳定错误结束宿主等待，并明确报告哪个 node/Capability 没有协作取消。

### Finally/Cleanup

service workflow 需要显式 cleanup nodeset：

```jsonc
{
  "service": {
    "body": "project.process_request",
    "finally": "project.cleanup_service"
  }
}
```

cleanup 在正常 stop、fatal error 和协作取消后都运行，但不得宣称可回滚已发生的外部副作用。

### 逐消息 Trace

每条 trace 事件应包含：

```ts
interface ServiceTraceEvent extends WorkflowTraceEvent {
  readonly serviceInstanceId: string;
  readonly messageId?: string;
  readonly messageSequence?: number;
}
```

长期服务不应在内存中无界保留完整 trace。`onTrace` 继续流式输出，内核只保留有界摘要。

## 提案五：JS/TS AOT Host Extension

### 为什么不直接复用现有 RuntimePlugin

当前 plugin 是通过 Python registry 加载的 policy/compiler/runtime hook。RuntimePlugin 服务于 Python Runtime，不是 browser/node AOT 产物中的 TypeScript 宿主适配层。

两者的信任和职责也不同：

- RuntimePlugin 观察或扩展内核运行 hook；
- host extension 在目标环境中连接外部事件源、实现 Capability 并管理宿主对象。

建议新增独立 descriptor，不要用同名 plugin ABI 混合两种概念。

### 概念 Descriptor

```jsonc
{
  "kind": "host_extension",
  "id": "example.event_host",
  "display_name": "Example Event Host",
  "description": "Binds an external event source to a service workflow.",
  "version": "1.0.0",
  "targets": ["browser"],
  "source": {
    "kind": "file",
    "ref": "host/event_host.ts",
    "export": "createHostExtension"
  },
  "capabilities": ["example.events", "example.storage"],
  "external_packages": []
}
```

workflow 或项目配置必须显式启用它：

```jsonc
{
  "host_extensions": [
    {"id": "example.event_host", "config": {}}
  ]
}
```

### 概念 ABI

```ts
export interface HostExtensionContext<TRequest, TReply> {
  readonly signal: AbortSignal;
  readonly service: WorkflowServiceHandle<TRequest, TReply>;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface HostExtensionInstance {
  start(): void | Promise<void>;
  stop(reason?: unknown): void | Promise<void>;
}

export function createHostExtension(
  context: HostExtensionContext<ServiceRequest, ServiceReply>,
): HostExtensionInstance;
```

host extension 可以：

- 注册和移除宿主事件监听器；
- 调用 `service.send()`；
- 为 workflow 提供已声明 Capability 的实现；
- 持有 DOM、socket、resolver map 等宿主对象；
- 在宿主卸载时请求 service stop。

host extension 不可以：

- 修改已编译 graph 或绕过 hard validation；
- 隐藏本应作为 node/nodeset 出现的业务主流；
- 直接读写 workflow 内部 carry、inbox 或 envelope；
- 伪造 receipt 已结算状态；
- 通过模块级 setter 将一个宿主实例泄漏给其他 service 实例。

### Capability 仍是副作用真源

host extension 不应替代 Capability descriptor。如果 workflow 需要读取存储或提交状态，仍必须由显式 node 声明并调用对应 Capability。

错误示例：

```text
start → empty process node → end

host extension 在后台完成所有业务读写
```

正确示例：

```text
receive
  → normalize
  → decide
  → calculate
  → commit node --uses--> host storage Capability
  → reply
```

host extension 只实现事件源和 Capability 后端，图上仍能看见业务顺序与副作用位置。

## 内核与项目扩展的责任边界

| 能力 | VibeFlow 核心 | 项目 host extension / plugin |
| --- | --- | --- |
| 长期运行 | service workflow 的状态机与 AOT | 决定何时启动 |
| 无界循环 | yield、sync-step、cancel 硬规则 | 提供实际事件源 |
| 消息端口 | ID、Schema、receipt、有界队列 | 外部事件到 request 的转换 |
| 是否等待 | 提供 receipt | 宿主回调选择 await 或 detached |
| 状态 | 显式 service carry | 持有不可 JSON 化的宿主对象 |
| 停止 | stop/cancel/finally 语义 | pagehide、socket close 等停止来源 |
| 超时 | 可取消的通用 wait/timeout | 业务超时值和超时后策略 |
| 副作用 | Capability 契约、图上位置和校验 | 具体宿主 API 实现 |
| 观测 | 逐消息 trace 与错误关联 | 日志、UI 提示或外部监控 sink |
| 质量 | finding 扩展点与不可放宽的硬规则 | 领域命名、拓扑和注释策略 |

## 同步入口的边界

某些宿主回调要求立即同步返回值。service 消息端口本质上是异步的，不应伪装成同步 request/reply。

首版建议：

- 同步回调由 host extension 直接读取“最新已提交快照”；
- 同步回调不启动新的 service message 处理；
- 如果未来增加 `runWorkflowSync()`，必须保证所有 node 同步、无异步 Capability、无 detached task，并由构建期 fail closed。

`runWorkflowSync()` 对其他项目也有用，但不是 service workflow 首版的必要前置。

## 安全和硬规则

以下规则不应被 policy plugin 降级或豁免：

1. service loop 的所有可持续路径都必须到达可取消 yield point。
2. service 必须具有有界 pending queue 或显式 backpressure provider。
3. service 必须有可达的 stop/cancel 路径。
4. service 实例的 carry、receipt、trace 和 Capability wrapper 必须隔离。
5. stop/fatal error 时所有 accepted receipt 必须最终结算。
6. host extension 不能读写内部 envelope、inbox 或 carry。
7. node 仍不得直接 import 另一个 node。
8. base_lib 仍不得访问 Capability 或隐藏宿主 IO。
9. 取消不得被声称为事务回滚或强制终止。
10. host extension 中的业务主流隐藏行为应可由 policy/finding 扩展检查。

## 构建与产物

service workflow 应继续支持：

- `esm-module`；
- `single-esm`；
- `web-app`；
- browser/node target；
- `.d.ts`、source map 和 build manifest；
- 确定性构建和原子发布。

build manifest 建议新增：

```json
{
  "workflow_mode": "service",
  "service_abi_version": 1,
  "host_extensions": ["example.event_host"],
  "queue_policy": {"max_pending": 1024, "overflow": "reject"}
}
```

host extension 的 source、依赖、target API、external package 和模块顶层副作用应使用与 node/base_lib 相同级别的构建前与 bundling 后检查。host extension 允许宿主 API 和实例级可变状态，但不允许无声明的跨 service 全局状态。

## 架构文档与审查图

`ARCHITECTURE.jsonc` 和 expanded SVG 应显示：

- workflow mode；
- service input/reply contract；
- service loop body；
- yield point；
- queue/backpressure policy；
- shutdown/finally nodeset；
- 已启用 host extension 及其提供的 Capability；
- 哪些 node 读写哪些 Capability；
- service carry 的 data schema；
- liveness finding 的准确 source location。

审查图不需要把每次无界迭代展开。应将 service body 作为可展开 nodeset，并在外层用专用 service-loop 语义标记其重复执行。

## 错误码建议

构建/校验期：

```text
SERVICE.CONFIG.INVALID
SERVICE.PORT.SCHEMA_MISSING
SERVICE.PORT.REPLY_UNREACHABLE
SERVICE.QUEUE.UNBOUNDED
SERVICE.LIVENESS.NO_YIELD_PATH
SERVICE.LIVENESS.UNBOUNDED_SYNC_PATH
SERVICE.LIFECYCLE.NOT_CANCELLABLE
SERVICE.LIFECYCLE.FINALLY_UNREACHABLE
HOST_EXTENSION.DESCRIPTOR.INVALID
HOST_EXTENSION.TARGET_INCOMPATIBLE
HOST_EXTENSION.CAPABILITY_UNDECLARED
HOST_EXTENSION.IMPORT_FORBIDDEN
```

运行期：

```text
SERVICE.NOT_RUNNING
SERVICE.QUEUE.FULL
SERVICE.MESSAGE.FAILED
SERVICE.MESSAGE.CANCELLED
SERVICE.RECEIPT.DOUBLE_SETTLE
SERVICE.SYNC_STEP_LIMIT
SERVICE.SHUTDOWN_TIMEOUT
SERVICE.HOST_EXTENSION_FAILED
```

所有错误应保留 workflow ID、service instance ID、message ID、node/block path 和 `cause`，适用时再包含 host extension ID。

## 向后兼容与渐进交付

### 兼容原则

- 现有 workflow 默认 `mode: "finite"`；
- 现有 `runWorkflow()` ABI 不变；
- 现有 `vibeflow.loop.while` 仍为有界 loop；
- 现有 Python RuntimePlugin 和 policy/compiler plugin ABI 不变；
- service ABI 和 host extension descriptor 独立版本化；
- 有限 workflow 不得引用仅 service 可用的系统类型。

### 建议实施阶段

#### 阶段 1：内部 Service Plan

- 在语言无关 plan 中增加 workflow mode、service port、queue、shutdown 和 finally。
- 增加 service 专用 health/liveness 检查。
- 更新 architecture document 和 Mermaid/SVG。

#### 阶段 2：JS/TS AOT Service ABI

- 生成 `startWorkflowService()`、handle、receipt 和 service-local state。
- 实现队列上限、逐消息 Schema 校验、trace 和错误关联。
- 实现 cooperative stop、finally 和 shutdown timeout。

#### 阶段 3：Host Extension

- 增加 descriptor/registry、AOT 导入、target 检查和 manifest 登记。
- 提供最小 DOM 事件或 Node `EventEmitter` 示例，不引入特定业务宿主。
- 验证多个 service 实例和 host extension 实例完全隔离。

#### 阶段 4：开发体验

- 生成稳定 `.d.ts` 和 source map。
- 为 service workflow 增加 inspect/review 输出。
- 增加可选的宿主扩展测试 harness。
- 再评估 `runWorkflowSync()`、更丰富的 backpressure 和事务 effect metadata。

## 验收测试

### 核心行为

1. service 启动后 `startWorkflowService()` 立即返回 handle，不等待 service 停止。
2. 顺序发送两条消息时，两个 receipt 与自己的 reply/error 准确关联。
3. 并发启动两个 service 实例时，carry、receipt、trace、Capability 和 host extension 状态互不污染。
4. queue 达到上限时，新 `send()` 以稳定 `SERVICE.QUEUE.FULL` 失败，旧消息不丢失。
5. `stop()` 为幂等，拒绝新消息，按配置结算 pending receipt，并在 cleanup 后结算 `done`。
6. node 或 Capability 忽略 signal 时，shutdown timeout 返回稳定错误，不声称已强制中止副作用。
7. 每条 trace 可定位 service instance、message 和 node/block path。

### 活性与负面用例

1. 无 yield point 的 service loop 构建失败。
2. 存在一条可持续执行且永远不到 yield 的分支时构建失败。
3. 没有 stop/cancel 路径的 service 构建失败。
4. 未声明队列上限或 backpressure provider 的 service 构建失败。
5. host extension 使用未声明 Capability、不兼容 target API 或禁止 import 时构建失败。
6. host extension 企图读取内部 runtime 模块时构建失败。
7. 现有有限 loop 仍无法省略停止条件和迭代上限。

### 宿主扩展用例

1. Node `EventEmitter` host extension 可把事件送入 service，并从 receipt 获得结果。
2. Browser `EventTarget` host extension 可在启动时注册、停止时移除监听器。
3. host extension 可实现已声明 Capability，但业务读写仍由图上显式 node 发起。
4. 同一个 AOT 模块先后启动两次时，第一个 host extension 实例的监听器和宿主状态不泄漏到第二个实例。

## 作为驱动用例的 ERA 集成

ERA 只是验证这些通用能力的一个用例，不是核心 API 的命名来源。

VibeFlow 核心不应知道：

- 酒馆事件名；
- 监听器 first/last 顺序；
- 生成栅栏；
- 消息楼层变量；
- 宏注册；
- UI 通知。

ERA host extension 负责：

```text
酒馆事件回调
  → service.send(ERA event)
  → 按事件目录选择立即返回或 await receipt
  → pagehide 时 service.stop()
```

ERA workflow 仍显式展示：

```text
receive event
  → collect batch
  → merge events
  → dispatch domain task
  → rollback/replay/calculate
  → commit through Tavern Capability
  → settle receipt
  → post-commit notification through Capability
```

同步宏和 Vue/Pinia UI 可以保留在 host extension/宿主层，不是 service workflow 首版的阻塞项。

## 开放问题

1. service input port 应作为顶层 workflow ABI，还是可被 nodeset 复用的系统 node？
2. service 首版是否只支持串行消费？建议是，并将并发留给后续显式 concurrency policy。
3. timeout 应由内核提供，还是作为带 `yield=true` metadata 的 clock Capability？
4. host extension 是由 workflow config 启用，还是只在应用入口中组装？
5. `finally` nodeset 可以访问哪些 carry 和 Capability？
6. fatal error 后是先结算 pending receipt 还是先运行 cleanup？建议先阻止新消息，标记 pending outcome，运行 cleanup，再 settle receipt 与 `done`。
7. service request/reply 是否必须为 JSON representation？建议首版保持 JSON，非 JSON 宿主对象由 host extension 持有。
8. policy/compiler plugin 如何对 host extension 进行额外领域检查，但不获得修改硬规则的权限？

## 结论

建议不向现有 `vibeflow.loop.while` 增加一个简单的 `infinite: true`。这会把运行模式、生命周期和活性问题隐藏在一个布尔开关后面。

更小且边界清晰的通用扩展是：

```text
service workflow
  + safe unbounded service loop
  + typed duplex message port
  + receipt and per-message trace
  + cooperative stop/finally
  + JS/TS AOT host extension
```

这组能力能让 VibeFlow 管理长期运行程序的真实业务流程，同时保持宿主适配的通用性、AOT 的静态性和现有有限 workflow 的安全约束。
