# 三阶段订阅与观察记录

`ERA.generation.subscribe(listener, { stages? })` 订阅注册后成功完成的规划、正文和变量解析。返回函数用于注销；旧消息展示不会触发回调。

```ts
const unsubscribe = ERA.generation.subscribe(async event => {
  if (event.stage !== 'planning') return;
  // event.result.plan 和 functionResults 是本次成功阶段的只读最终结果。
  // 异步工作应响应 event.signal，取消后不要继续发起自己的副作用。
  if (event.signal.aborted) return;
  await ERA.commit([{ insert: { authorPrepared: true } }], { scope: 'always' });
}, { stages: ['planning'] });
```

| 阶段 | result | 等待结束后 |
| --- | --- | --- |
| planning | plan、functionResults | 读取最新变量，准备正文 |
| story | story | 读取最新变量，准备变量解析 |
| settlement | operations | 执行 AI 操作，经原同步链提交 |

变量阶段的回调提交先发生，随后 AI 操作可能覆盖同一变量。回调不能通过修改 `result` 替换 AI 输出。若回调已经提交变量，随后抛错，这次提交不撤销。

事件另含 `executionId`、`completionId`、`trigger`、`chatKey` 和 `signal`；有实际 AI 楼层时提供 `messageId`、`mk`、`swipeId`。初次规划尚无 AI 楼层时不填楼号。一次阶段失败后的自动纠错不发布成功事件；手动重新生成成功有新的完成身份。

订阅者按注册顺序等待，没有超时自动放行。回调抛错时提示并继续其他订阅者和后续阶段。取消、切聊、Swipe、停止 ERA，或卸载正在参与等待的托管 iframe，使旧交接失效。作者自己的异步任务不会被强制终止，必须自行使用 `signal`；已提交的数据不会自动回滚。

托管 iframe 的阶段事件表示当前生成会话。iframe 原有 `ERA.get/commit` 的楼层绑定规则仍然适用，不能把它当成顶层变量接口。iframe 卸载会注销它的阶段订阅。普通调用注销函数只退出该订阅；正在执行的回调收到取消信号。

## 生产执行路径

Service 原派发链 → Agent 生成 Nodeset 执行成功阶段 → `prepare_stage_handoff` 形成交接 → 原批次返回和 FIFO 释放 → Host 后置通知执行作者订阅 → 原 FIFO 收到 `era.agent.stage_continue` → 重新读取会话身份和变量 → 继续原生成/同步链。

等待不占用 FIFO，作者的 `await ERA.commit()` 因而可由同一个 Service 队列完成。Host 只持有等待和生命周期，恢复候选、请求准备及操作顺序仍由 Service 决定。

## 消息与页面记录

新消息保存最终结构化规划、正文所需函数结果、正文、最终有效指令及必要楼层标识，不再写入完整 `era_update` 报告。重试响应、诊断、提示词和完整过程只保留在页面内存中。旧格式消息按原内容读取，不批量重写。

所有聊天共享默认 32 MiB 观察记录估算预算。估算包含 UTF-16 内容、对象、索引及记录固定开销；这不是浏览器进程堆内存的精确上限。优先淘汰最旧已完成记录；单条超过预算不保留完整副本。当前请求和等待交接所需的业务上下文不会为观察预算而截断。作者脚本自行保存的数据不受 ERA 控制。

关闭页面或记录被淘汰后，查看器从消息读取最终成果，提示过程记录已释放。重新生成按现存最终成果恢复必要会话；历史过程不会被伪造恢复。
