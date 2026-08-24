# ERA 公共对象 API

ERA 只发布一个全局对象，不再监听 `era:*` 写入、查询或 `writeDone` 事件。

```ts
await waitGlobalInitialized('ERA');
```

## 读取与订阅

```ts
const initial = ERA.get();
render(initial.statWithoutMeta);

const unsubscribe = ERA.subscribe(state => {
  render(state.statWithoutMeta);
});

$(window).on('pagehide', unsubscribe);
```

`get()` 始终同步返回当前身份对应的只读内存快照。Sidecar 尚未就绪或身份不匹配时，`status` 为
`loading` 且变量为空；不会读取聊天变量或上一聊天的数据。

## 即时写入

```ts
const receipt = await ERA.commit([
  { edit: { time: { $expr: 'time + 10' } } },
  { insert: { flags: { arrived: true } } },
]);
```

每次 `commit()` 都是一个独立 FIFO 任务。Promise 返回前，本次 `<era_tx>` 已写入当前最新 AI
消息、回读确认并同步到 Sidecar。操作按数组顺序执行，固定只允许：

- `insert`、`edit`、`delete`；
- `functionInsert`、`functionEdit`、`functionDelete`。

数学更新只使用 `$expr`。没有 `$inc/$sub/$mul/$div/$set`、路径快捷 API、批次会话或防抖合并。

## Scope

`scope` 只允许三种值；省略时为 `message`：

```ts
await ERA.commit([{ edit: { time: { $expr: 'time + 10' } } }]);
await ERA.commit([{ edit: { initialized: true } }], { scope: 'branch' });
await ERA.commit([{ edit: { clickCount: { $expr: 'clickCount + 1' } } }], { scope: 'always' });
```

- `message`：当前最新 AI 消息的本次生命周期窗口内可调用任意多次；后续编辑、iframe 重建或
  reload 打开新窗口后，若该消息已有 `s="m"` 事务，本窗口调用全部返回 `skipped`。新 AI 消息重新允许。
- `branch`：当前活动分支只结算一轮；切到不含 `s="b"` 的另一分支可再结算。
- `always`：每次调用都执行。

没有 `edit` scope、窗口 ID或业务 key。窗口变化发生在队列等待期间时，调用以
`ERA_API_WINDOW_CHANGED` 失败，不会写入旧消息。

每次调用都会先独立写成短事务：

```html
<era_tx s="m"><VariableEdit>{"time":{"$expr":"time+10"}}</VariableEdit></era_tx>
```

只有楼层封存时，现有安全压缩器才会合并相邻、同 scope 的事务；不同 scope 是硬边界。

## 同步与历史

```ts
await ERA.sync();
await ERA.sync({ mode: 'full' });
await ERA.sync({ rollbackTo: 12 });

const historical = await ERA.history.atMessage(12);
```

`history.atMessage()` 只读 Sidecar 当前快照及 EditLog，不写聊天。

## 已删除接口

测试期直接移除了旧 `eventEmit('era:*')` 写入/查询、`era:writeDone`、
`era:requestWriteDone`、`era:queryResult`、`era:apiWrite` 和外部 `era:forceSync`。旧脚本必须迁移到
`ERA.get/subscribe/commit/sync/history`。
