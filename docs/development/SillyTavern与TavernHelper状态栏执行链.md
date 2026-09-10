# SillyTavern 与 Tavern Helper 状态栏执行链

> 调查日期：2026-09-03
>
> 用途：还原 ERA 状态栏的宿主执行顺序；本文不是产品修复方案。

## 1. 版本与证据等级

| 组件 | 调查版本 |
| --- | --- |
| ERA-vibeFlow | `099115b344e3f47c7997ecc8aeb73b59a00b81e7` |
| SillyTavern reference | `8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8` / `1.18.0` |
| Tavern Helper reference | `4dd4b873f191accb5dd933089ddf36b846458585` / `4.9.3` |

本文对结论使用三种标记：

- **源码事实**：当前参考版本的代码直接表达了该行为。
- **运行事实**：真实 Artifact 记录了对应事件或结果。
- **推断**：与源码、Artifact 都一致，但当前日志没有暴露某个内部瞬时点。

## 2. SillyTavern 消息与事件链

### 2.1 事件不是“统一阶段”，而是注册顺序队列

**源码事实**：`eventSource.on` 把监听器追加到数组；`makeFirst`/
`makeLast` 可重排一个监听器。`emit` 在发射时复制数组，然后按当时顺序
逐个 `await`。因此：

1. 单次 `emit` 内的 listener 是顺序执行的；
2. 但 ERA、Tavern Helper 与其他扩展谁先注册仍会改变先后；
3. listener 若只是把真正任务入队后立即返回，`emit` 等待的只是“入队”，
   不是后台业务结算。

源码：

- [`references/SillyTavern/public/lib/eventemitter.js`](../../references/SillyTavern/public/lib/eventemitter.js)
  第 45–107、130–158 行。

### 2.2 首楼创建

**源码事实**：`getChatResult()` 在新聊天中创建主开场白后，会先打印聊天，
再依次发出 `MESSAGE_RECEIVED(0, "first_message")` 与
`CHARACTER_MESSAGE_RENDERED(0, "first_message")`。源码位于
[`references/SillyTavern/public/script.js`](../../references/SillyTavern/public/script.js)
第 7625–7648 行。

这两个事件证明“消息已接收/已渲染”，不证明 ERA Sidecar 已完成该楼的
同步与快照发布。

### 2.3 生成、Continue 与 Swipe

**源码事实**：`saveReply()` 对新消息、Continue 和 Swipe 都是先发
`MESSAGE_RECEIVED`，再创建/替换显示 DOM，然后发
`CHARACTER_MESSAGE_RENDERED`。关键分支位于
[`references/SillyTavern/public/script.js`](../../references/SillyTavern/public/script.js)
第 6583–6724 行。

### 2.4 编辑

**源码事实**：保存消息编辑时，SillyTavern 先更新 raw message 并发
`MESSAGE_EDITED(messageId)`，然后重绘 `.mes_text`，最后发
`MESSAGE_UPDATED(messageId)`。源码位于
[`references/SillyTavern/public/script.js`](../../references/SillyTavern/public/script.js)
第 8337–8372 行。

这解释了“编辑一次后状态栏恢复”的表面现象：编辑链确实同时触发了
ERA 重算与 Tavern Helper iframe 重建，新 iframe 比首帧实例更晚读取状态。

### 2.5 删除与 reload

**源码事实**：普通删除完成后，`MESSAGE_DELETED` 的参数是删除后的
`chat.length`，不是被删消息的稳定身份。`reloadCurrentChatUnsafe()` 清空 DOM 与
chat 数组，再重新读聊天并打印。源码位于
[`references/SillyTavern/public/script.js`](../../references/SillyTavern/public/script.js)
第 1584–1700 行。

结论：数组 `messageId` 在中间楼删除后会重排，不能单独充当永久楼层身份。

## 3. Tavern Helper 宏与 iframe 链

### 3.1 MacroLike 类型允许 messageId，消息渲染却没有传

**源码事实**：`MacroLikeContext` 含可选 `message_id`；Tavern Helper 自己的
“message variable”读取在上下文没有 messageId 时，会回退到最后一条含变量的
消息。源码位于
[`references/JS-Slash-Runner/src/function/macro_like.ts`](../../references/JS-Slash-Runner/src/function/macro_like.ts)
第 6–23 行。

但 `demacroOnRender()` 为消息替换宏时只传 `role`，不传已经能从
`.mes[mesid]` 获得的 messageId。源码位于
[`references/JS-Slash-Runner/src/panel/render/macro_like.ts`](../../references/JS-Slash-Runner/src/panel/render/macro_like.ts)
第 50–68 行。

**结论**：Tavern Helper 这一版丢掉了消息宏求值的楼层上下文。这是
ERA 历史宏错位的一个直接成因，但不是唯一根因：ERA 当前宏回调自身也忽略
context，而且显示层没有按楼层身份调用既有日志回放能力的接口。

### 3.2 宏替换与 iframe 创建共享同一块 DOM

**源码事实**：`demacroOnRender()` 会先删除 `.TH-render > iframe`，然后用
`.html()` 替换整个 `.mes_text`。注释已记录某些设备在首次进入角色时会发生
“渲染前端→替换助手宏→再渲染前端”。同一文件第 65–68 行。

Tavern Helper 监听 `chatLoaded`、`CHARACTER_MESSAGE_RENDERED`、
`USER_MESSAGE_RENDERED`、`MESSAGE_UPDATED` 与 `MESSAGE_SWIPED`，事件到来后重做宏替换。
同一文件第 121–137 行。

### 3.3 MESSAGE_UPDATED/Swipe 会丢弃旧 runtime 并新建 reload memo

**源码事实**：消息 iframe runtime 记录 `message_id`、`reload_memo` 与 DOM elements。
`chatLoaded` 重建全部 runtime；`MESSAGE_UPDATED`/
`MESSAGE_SWIPED` 会先从 runtime 数组剔除该 messageId，再审计并创建新的
`reload_memo`。源码位于
[`references/JS-Slash-Runner/src/store/iframe_runtimes/message.ts`](../../references/JS-Slash-Runner/src/store/iframe_runtimes/message.ts)
第 6–68、111–147 行。

因此，“一条消息”与“一个 iframe 实例”不是同一生命周期。同一楼保持不变时，
它内部的加载脚本仍可因一次 DOM 更新而重新执行。

### 3.4 `setChatMessages` 的 refresh 影响重建

**源码事实**：Tavern Helper `setChatMessages` 的默认 refresh 是 `affected`，
会对受影响消息调用 `refreshOneMessage`。显式 `refresh="none"` 仅改 raw chat；
显示更新分支会清空 `.mes_text` 并重新 `messageFormatting`。源码位于
[`references/JS-Slash-Runner/src/function/chat_message.ts`](../../references/JS-Slash-Runner/src/function/chat_message.ts)
第 212–321、568–609 行。

## 4. ERA 当前执行链

### 4.1 快速初始化在业务同步完成前就可触发显示链

**源码事实**：当当前聊天仍是未编辑的主开场白，ERA 快速初始化会：

1. 更新当前 `chat[0].mes`；
2. 发 `MESSAGE_RECEIVED(0, "first_message")`；
3. `clearChat()` 后 `printMessages()`；
4. 发 `CHARACTER_MESSAGE_RENDERED(0, "first_message")`；
5. 保存聊天。

源码：
[`app/src/ERA变量框架/service/character-greeting-adapter.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/service/character-greeting-adapter.ts)
第 95–152 行。

ERA 的普通 Tavern 事件 listener 只把任务入队；除 generation barrier 外，不向
SillyTavern 返回等待业务结算的 Promise。源码：
[`app/src/ERA变量框架/service/tavern-adapter.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/service/tavern-adapter.ts)
第 225–278 行。

**推断**：快速初始化的 iframe 可在同一楼的 Sidecar 重算与快照发布前被创建。
真实事件已证明两条链交错；但当前 ERA events collector 没有公开 Sidecar publish 的
精确瞬时点，因此发布瞬间只能被前后 snapshot 夹住，不写成一个未实测的毫秒时间。

### 4.2 ERA 只发布单个 active Sidecar 快照

**源码事实**：`sidecar-runtime-snapshot.ts` 只保存一个当前聊天 `active`，
其中有最新 `statData/statFunc/eraMeta/revision`；历史状态依靠日志逆向恢复。问题不是没有
永久保存每楼快照，而是显示层没有按 messageId/MK 调用这套回放能力的身份与就绪合同。
源码：
[`app/src/ERA变量框架/service/sidecar-runtime-snapshot.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/service/sidecar-runtime-snapshot.ts)
第 9–83 行。

### 4.3 宏回调忽略 context，DOM 刷新把同一最新值用到所有楼

**源码事实**：ERA `registerEraMacro()` 的回调参数写作 `_context`，求值时总是
`getEraData().stat`。源码：
[`app/src/ERA变量框架/macro/registration.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/macro/registration.ts)
第 39–47 行。

Sidecar 发布后，`refreshDisplayedEraMacros()` 遍历当前显示的所有消息，用同一个
最新 snapshot 重新解析每条 raw message，然后整体 `.html()` 替换显示。源码：
[`app/src/ERA变量框架/macro/dom-refresh.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/macro/dom-refresh.ts)
第 57–88 行。

这不是偶发缓存污染，而是现有代码明确没有表达“状态栏所在楼的快照”。

### 4.4 旧实现中技术块投影、宏刷新和强制重载都会重建 iframe

**源码事实**：

- 技术块投影用 `replaceChildren(fragment)` 替换整个 `.mes_text`，并额外公告一次
  rendered event：
  [`technical-block-projection.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/service/technical-block-projection.ts)
  第 231–271 行。
- 宏 DOM 刷新用 `.html(formatAsDisplayedMessage(...))` 替换消息：
  [`macro/dom-refresh.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/macro/dom-refresh.ts)
  第 63–76 行。
- 旧强制重载曾在每个 Sidecar revision 发布后，对最近 N 楼调用 `refreshOneMessage()`，
  然后再做 ERA 技术投影。该实现所在的 `presentation-refresh.ts` 已在按楼状态栏重构中删除，
  此处仅保留为根因历史证据。

因此旧强制重载能“偶尔修好”首帧，只是因为它把 iframe 延后重建到 Sidecar
更可能就绪的时刻。它没有修复楼层身份，也没有提供首帧就绪合同。

### 4.5 公共 API 的读与写语义

**源码事实**：

- `ERA.get()` 和 `subscribe()` 投影的是当前 `active` Sidecar 快照。
- `history.atMessage(id)` 要求 active snapshot 先就绪，然后从最新 EditLog/
  FunctionEditLog 逆向回放到指定 messageId；无 active snapshot 直接抛
  `ERA_STATE_NOT_READY`。
- `commit()` 的公开参数只有 operations 与 scope，不携带状态栏所在 messageId/MK。

源码：
[`app/src/ERA变量框架/service/public-api.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/service/public-api.ts)
第 94–159、246–319 行。

Service `buildAppend()` 明确选择 `latest.messageId`，向它追加 `<era_tx>` 并指定
`refresh: "none"`：
[`javascript_project/service/base_lib/facade_api_engine.ts`](../../javascript_project/service/base_lib/facade_api_engine.ts)
第 260–281 行。

**运行事实**：统一调查 run `st-run-20260903T07250307-633d4b6a2209` 的
`STATUSBAR-EXAMPLE-023` 同时显示 message 0 与 message 2 的状态栏。message 0 的
load 脚本产生的 always/message/branch 三张 receipt 全部返回 `messageId=2`。这把
“静态代码选择 latest”与“历史状态栏真实写到了最新楼”闭合成同一条证据链。

Host 写完 raw message 后会主动调 ERA 技术块投影；该投影又可公告 rendered event，
进而让 Tavern Helper 重做 iframe runtime。源码：
[`app/src/ERA变量框架/service/tavern-adapter.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/service/tavern-adapter.ts)
第 389–409 行。

### 4.6 内部消息写识别不是 iframe 业务 effect 身份

**源码事实**：ERA 用 `internalMessageWrites: Map<messageId, expectedText>` 吞掉自己写回导致的
`MESSAGE_UPDATED`，防止把自己的写当成用户编辑再入队。源码：
[`message-writer.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/service/message-writer.ts)
第 29–95 行，以及
[`tavern-adapter.ts`](../../app/src/ERA%E5%8F%98%E9%87%8F%E6%A1%86%E6%9E%B6/service/tavern-adapter.ts)
第 204–223 行。

这只能阻止 ERA Service 的同步重入，不能阻止 Tavern Helper 因 DOM/rendered event
重建 iframe，也不能识别新 iframe 里再次调用的 API 是同一业务意图的重放。

### 4.7 空聊天被显式实现为保留旧状态的 no-op

**源码事实**：`planEraSync()` 在 `messages.length === 0` 时返回
`status: "no-op"`/`committed: false`，并原样克隆 stat、statFunc 和 meta。
`prepareSyncWork()` 随后也返回无 payload 的 no-op。源码：

- [`javascript_project/service/base_lib/domain/sync_engine.ts`](../../javascript_project/service/base_lib/domain/sync_engine.ts)
  第 467–491 行；
- [`javascript_project/service/base_lib/sync_commit_policy.ts`](../../javascript_project/service/base_lib/sync_commit_policy.ts)
  第 474–507 行。

这是 `ERA-PROD-007` 的直接实现根因，不是 iframe 时序的偶发副作用。

## 5. 组合执行时序

### 5.1 快速初始化首帧

```text
用户点击快速初始化
  → ERA 更新角色主开场白和当前纯净首楼
  → SillyTavern 发 MESSAGE_RECEIVED / 打印聊天 / 发 CHARACTER_MESSAGE_RENDERED
  → Tavern Helper 替换宏并创建状态栏 iframe
  → ERA 的普通事件处理已入 FIFO，但该楼的 Sidecar commit/publish 不必已完成
  → 首个 iframe 可见，但它的一次性宏/history 读取可为空或 not-ready
  → Sidecar 稍后发布当前最新快照
```

前四步是源码和 Artifact 共同确认的事实；“Sidecar 在某一个具体毫秒发布”仍是被
前后 snapshot 界定的推断。

### 5.2 编辑后恢复的对照

```text
用户保存编辑
  → raw message 改变
  → MESSAGE_EDITED 使 ERA 从该楼重算
  → SillyTavern 重绘 .mes_text
  → MESSAGE_UPDATED
  → Tavern Helper 丢弃旧 runtime 并新建 iframe
  → 新 iframe 在较晚时点读到已发布状态
```

编辑不是修复；它只是同时触发“业务重算”和“显示重建”，偶然使后一个
iframe 落在就绪后。

### 5.3 状态栏加载时写 API

```text
iframe instance A load
  → 作者脚本调 ERA.commit()
  → ERA 选 latest assistant message 追加 <era_tx>
  → ERA 立即重算与提交 Sidecar
  → ERA 投影更新同一消息 DOM / 公告 rendered
  → Tavern Helper 丢弃 iframe A，创建 iframe B
  → iframe B 的 load 脚本再次调 ERA.commit()
```

ERA 对内部 `MESSAGE_UPDATED` 的吞掉不会中断这条显示层重建链。

## 6. 关键结论与未知项

### 6.1 已确认

- 现有读取链缺少“这个显示实例属于哪个聊天/分支/楼层/MK/revision”的统一上下文。
- Tavern Helper 消息宏调用未传 messageId，ERA 宏回调也忽略 context。
- ERA 显示刷新把同一最新快照应用到所有历史楼，没有在需要显示时按日志计算目标楼。
- 多条当前显示链都通过整体替换 DOM 达成，iframe 生命周期与业务状态发布没有就绪契约。
- `ERA.commit()` 既没有状态栏所在楼的默认目标，也没有跨 iframe 重建保持的业务 effect 身份。
- 空历史残留由显式 no-op 实现导致。
- 页面 reload、真实 ST 重启都可以恢复 3/3 iframe，但宏/history 仍可能不就绪；
  因而 iframe 数量恢复与楼层快照就绪是两个不同条件。
- `STATUSBAR-PROBE-001` 已在当前 Tavern Helper 运行环境确认：消息 iframe 内的
  `getCurrentMessageId()`、`window.name=TH-message--<messageId>--<index>` 与父 `.mes[mesid]`
  可以在 loader 阶段交叉验证；不需要修改 Tavern Helper 才能取得来源楼层。
- 同一探针也确认 iframe 默认继承的是共享顶层 `ERA` facade，
  `iframe.window.ERA === top.ERA`。共享函数本身无法反推调用 realm；要区分状态栏内外调用，
  必须由 ERA 在 iframe 内安装携带来源身份的局部 facade。
- 浏览器的 iframe `load` 可以先完成，但 ERA loader 仍可保持文档不可见并阻止作者逻辑执行，
  直到 ERA 状态和测试 gate 就绪。这是“作者激活/首帧 barrier”，不是冻结浏览器原生 load。

### 6.2 仍待验证

- 首帧失败时，每一个 iframe instance 精确绑定的 Sidecar revision 和 MK；现有
  collector 可夹住顺序，但未在 Sidecar publish 函数内打点。
- 当前单楼探针只确认了本项目使用的 Tavern Helper 4.9.3；仍需验证 reload、Swipe、Continue、
  编辑、删除以及未来 TH 版本中的三方楼层身份是否始终一致。
- 无整体消息重绘的情况下，不同状态栏 HTML 模板是否都能通过一个统一的增量通道安全更新。

## 7. 其他文档

- 真实 Artifact 事件时间线：[`ERA状态栏事件时序证据.md`](ERA%E7%8A%B6%E6%80%81%E6%A0%8F%E4%BA%8B%E4%BB%B6%E6%97%B6%E5%BA%8F%E8%AF%81%E6%8D%AE.md)。
- 开放缺陷：[`../testing/ERA当前缺陷基线.md`](../testing/ERA%E5%BD%93%E5%89%8D%E7%BC%BA%E9%99%B7%E5%9F%BA%E7%BA%BF.md)。
- 旧 API 自激专项：[`ERA-API-生命周期与幂等策略调查.md`](ERA-API-%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F%E4%B8%8E%E5%B9%82%E7%AD%89%E7%AD%96%E7%95%A5%E8%B0%83%E6%9F%A5.md)。
