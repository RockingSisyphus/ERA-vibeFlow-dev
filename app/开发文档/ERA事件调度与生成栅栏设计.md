# ERA 事件调度与生成栅栏设计

本文描述当前 VibeFlow Service 的事件调度与内存工作状态实现。迁移前的 `EventScheduler`/Ticket/Dispatcher
设计已归档到 `历史/ERA事件调度与生成栅栏设计-旧调度器.md`。

## 一致性目标

每次真实生成开始前，ERA 必须完成该生成事件 high-water sequence 之前已接受操作的状态应用。
普通同步在已知范围结束时保存；规划草稿随生成阶段保留在内存，最终随实际 AI 消息保存。
barrier 等待确定的序号范围，不等待整个队列清空，因此后到 UI/API 事件不会让
当前生成永久饥饿。

`MESSAGE_SWIPED` 等 detached 事件只负责同步入队；需要等待 ERA 状态的生成事件由 Host
保存 barrier receipt，并在对应来源全部进入终态后放行。dry-run 保持候选基线语义。

连续 Swipe 的保存确认与当前来源分别处理：本次 B 候选可以已落盘，同时用户已选择 C。
Host 读回 B 槽后按包含自身写入的 sourceBasis 核对当前来源；Service 沿现有 sourceChanged
分支保留真实写入计数，不发布 B 的旧状态、不向当前聊天误报保存 repair。后续 C 仍由既有 FIFO
调度。已写任务不是零写入 no-op；API/Agent 的未完成提交仍如实失败，不隐式重试。

## 当前分层

```text
Tavern / UI / era:* / timer
  → Service Host 单一 FIFO（eventId、sequence、receipt、host-ref）
  → era.service.in Port
  → collection.reduce 与 batch.plan
  → coverage validation
  → 有界 step loop
  → initialize / sync / api / update-mk
  → batch-result
  → 先结算 receipts，再按声明顺序启动 notifications
```

Service Host 只负责宿主投影、队列、资源生命周期和 Capability 执行；CRUD、同步、MK、
回滚、资源选择与通知决策必须留在 workflow/nodeset 中。Host 不得形成第二套业务调度器。

## 收集与规划

- 每个被接受事件获得单调递增 `sequence`，并且必须恰好结算一次。
- collection carry 只保存有界状态，不收集永久历史。
- planner 必须让每个来源 sequence 恰好覆盖一次；duplicate、missing 或越界使该批失败，
  服务本身继续运行。
- 动态步骤由内层 loop 显式执行，单批最多 128 steps。
- 普通业务和保存失败返回 typed DTO，保留可恢复状态；协议或 carry 损坏才升级 fatal。

## 生成 barrier

- barrier 的 high-water 只覆盖不晚于该生成事件的来源。
- detached swipe 与 generation 组合仍由 planner 决定，不在 Host 中写场景分支。
- watchdog 只告警，不自动放行；自动放行会破坏宏与变量的一致性。
- service 停止或页面卸载时，所有未结算 receipt 以 cancelled 终态收口。

## 提交与通知顺序

### 原生正文收尾后的辅助阶段

`MESSAGE_RECEIVED` 保持detached入队，不能为了辅助解析反过来等待Service receipt。
原生`GENERATION_ENDED`只由独立机械监听记录，不作为新的业务FIFO输入。Service准备
辅助解析时等待对应聊天/execution.id的原生收尾，再核对当前消息与Swipe；宿主同步
`flushWIInjections`完成后才进入辅助世界书装配。规划阶段不等待未来正文。

当前原生周期只保存一个完成Promise；Helper独立请求不释放它，明确停止、切聊或卸载
取消它。生成外的Helper消息使用非原生来源事实。实现与独立时序证据见
`docs/testing/ERA辅助解析世界书注入竞态.md`，无需固定延迟或额外重试。

### MK 准备与状态主链

- 统一任务上下文可以先为当前激活文本补齐 MK 和状态占位符，但同步、初始化和 API
  状态任务不得在领域同步前预先改写 `ERAMetaData.SelectedMks`。
- `SelectedMks` 是同步器识别旧消息链与当前消息链首个分歧的基线。状态任务必须保留旧链，
  由同步事务完成回滚、命令重放后随 `stat_data`、`EditLogs` 和新链一次性提交到 Sidecar V2
  状态；聊天变量仅保留 Sidecar 指针。
- `message_sent` 对应的独立 `update-mk` 任务不执行历史同步，因此仍由统一准备阶段提交其
  `SelectedMks` 校准。提交所有权按任务类型确定，不根据事件时序或生成停止状态猜测。

Tavern 生命周期任务的可观察顺序固定为：

```text
Capability 写入确认
  → task/batch 结果确定
  → 按 sequence 结算全部 receipt
  → Sidecar 成功提交后原子发布运行时快照
  → 释放执行锁
```

公共对象订阅者在批次保存完成后收到通知。`ERA.commit()` 每次调用形成一个独立操作请求，
变量、累计日志、scope 与待保存消息记录实际应用到内存后返回；返回不代表已落盘。
普通外部请求按 Service FIFO 进入同一块循环，200ms 防抖、最长2000ms合并保存。
消息内函数通过显式 `ERA.forCall(parameters)` 使用当前调用位置的块循环，避免等待外层
任务结束；参数校验、记录构造和块应用逻辑仍共用。没有 `apiWrite`、`writeDone` 或
`queryResult` 通知。已标 done 的函数不重跑，保存恢复重放普通操作记录。

`ERA.get()` 与宏读取已成功应用的内存快照；全局 `ERA.ready()` 等待批次保存边界。
函数上下文的 `ready()` 返回调用位置的当前状态。宿主只执行 Service 的
`write_working`、`commit_metadata.workingVersion` 和通知参数，不根据事件名另建变量处理规则。

## 取消与热重载

`pagehide` 时先停止接受新命令，再注销公共对象、macro/UI 入口，abort 永久 workflow，取消
receive/timer/receipt，等待 workflow 收口，最后停止 Host 与卸载 UI。监听器、Port
waiter、timer、host-ref 和 pending notification 必须归零；任何永久 workflow 的非预期
reject 都转为可见 fatal 状态。内存 scope 窗口与运行时快照同时清除，消息中的 `era_tx`
scope 标记继续作为下一实例的准入事实。

## 修改规则

### 单层显示事件不参与业务派发

单层模式在现有 Host 显示生命周期缩减可见消息窗口，通过优先的消息呈现监听和
`MORE_MESSAGES_LOADED` 通知 Helper 审计实际显示变化。该通知不是删除、编辑或生成
事件；窗口开启、关闭和审计本身不进入变量重算，不推进 Sidecar revision。
普通生成、Swipe、Continue、编辑和删除仍由原始酒馆事件决定业务任务。测试和宿主观察
必须区分真实 `chat` 数组与当前可见 DOM，不能从“一条显示消息”推断只有一楼历史。


新增或调整事件时，依次修改真实 Config/Nodeset、Data Schema、Node source 和合同测试，
再运行 VibeFlow review/validate/quality/build。所有可读名称和说明使用中文；`ERA` 公共对象 ABI、
持久化 Schema、scope 语义或结算顺序的变化必须单独审核。
