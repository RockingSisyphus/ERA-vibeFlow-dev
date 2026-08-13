# ERA 事件调度与生成栅栏设计

本文描述当前 VibeFlow 0.13.2 生产实现。迁移前的 `EventScheduler`/Ticket/Dispatcher
设计已归档到 `历史/ERA事件调度与生成栅栏设计-旧调度器.md`。

## 一致性目标

每次真实生成开始前，ERA 必须结算该生成事件 high-water sequence 之前的全部已接受
事件。barrier 等待确定的序号范围，不等待整个队列清空，因此后到 UI/API 事件不会让
当前生成永久饥饿。

`MESSAGE_SWIPED` 等 detached 事件只负责同步入队；需要等待 ERA 状态的生成事件由 Host
保存 barrier receipt，并在对应来源全部进入终态后放行。dry-run 保持候选基线语义。

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
- 普通业务失败返回 typed DTO；部分/未知提交、协议或 carry 损坏才升级 fatal。

## 生成 barrier

- barrier 的 high-water 只覆盖不晚于该生成事件的来源。
- detached swipe 与 generation 组合仍由 planner 决定，不在 Host 中写场景分支。
- watchdog 只告警，不自动放行；自动放行会破坏宏与变量的一致性。
- service 停止或页面卸载时，所有未结算 receipt 以 cancelled 终态收口。

## 提交与通知顺序

### MK 准备与状态主链

- 统一任务上下文可以先为当前激活文本补齐 MK 和状态占位符，但同步、初始化和 API
  状态任务不得在领域同步前预先改写 `ERAMetaData.SelectedMks`。
- `SelectedMks` 是同步器识别旧消息链与当前消息链首个分歧的基线。状态任务必须保留旧链，
  由同步事务完成回滚、命令重放后随 `stat_data`、`EditLogs` 和新链一次性提交。
- `message_sent` 对应的独立 `update-mk` 任务不执行历史同步，因此仍由统一准备阶段提交其
  `SelectedMks` 校准。提交所有权按任务类型确定，不根据事件时序或生成停止状态猜测。

可观察顺序固定为：

```text
Capability 写入确认
  → task/batch 结果确定
  → 按 sequence 结算全部 receipt
  → 释放执行锁
  → 按声明顺序启动 apiWrite / writeDone / queryResult
```

通知使用隔离的 all-settled 语义。通知监听器可以重新进入 ERA，但新调用只能形成后续
事件，不能重入尚未完成的事务。副作用操作不自动重试。

## 取消与热重载

`pagehide` 时先停止接受新命令，再注销 macro/UI 入口，abort 永久 workflow，取消
receive/timer/receipt，等待 workflow 收口，最后停止 Host 与卸载 UI。监听器、Port
waiter、timer、host-ref 和 pending notification 必须归零；任何永久 workflow 的非预期
reject 都转为可见 fatal 状态。

## 修改规则

新增或调整事件时，依次修改真实 Config/Nodeset、Data Schema、Node source 和合同测试，
再运行 VibeFlow review/validate/quality/build。所有可读名称和说明使用中文；公开事件 ABI、
持久化 Schema 或通知顺序的变化必须单独审核。
