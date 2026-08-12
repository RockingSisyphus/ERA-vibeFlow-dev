# ERA 酒馆服务宿主

`era.tavern.service_host` 是浏览器端 Host Extension。工厂和模块导入只创建隔离
内存状态；只有 `start()` 才解析适配器并注册 Tavern listener，`stop()` 负责幂等
注销和清空队列、回执、定时器、宿主引用、通知任务及 Port 等待。

## 宿主适配器注入

生产应用应在 `createWorkflowHost()` 后、`host.start()` 前，把实现
`EraTavernHostAdapter` 的对象写入：

```ts
globalThis.__ERA_VIBEFLOW_SERVICE_ADAPTER__ = adapter;
```

workflow 的 Host Extension config 可用 `adapter_global_key` 改写键名。fake-host
单测也可直接把 `adapter` 放入 `createHostExtension(context)` 的 context；该测试
入口不会出现在 VibeFlow 生成的标准 context 中。

适配器的 `subscribe(listener)` 必须同步返回注销函数。listener 返回接纳结果：
成功结果包含单事件 `done` 回执和 `waitThrough()` 高水位屏障；容量或编码限制在
接纳前返回带稳定错误码的失败结果，不消耗 sequence。

## 生命周期诊断

直接测试 Host Extension 实例时可调用 `diagnostics.snapshot()`。快照只暴露计数
和 lifecycle 状态，不暴露事件参数或宿主对象，字段包括：

- `accepted`、`settled`
- `queueEvents`、`queueBytes`
- `pendingReceipts`
- `timers`
- `hostRefs`
- `notifications`
- `portWaiters`

`start()` 前这些资源必须全部为零；`stop()` 完成后也必须归零。

出站 `frameId` 的内容指纹使用 4096 项先进先出窗口：窗口内同 ID 同内容是
幂等 no-op，同 ID 异内容立即报协议冲突。Service Port 本身按 FIFO 交付，超过
该窗口的历史 frame 不属于可重放范围；固定上限避免永久工作流随运行时长增长。
