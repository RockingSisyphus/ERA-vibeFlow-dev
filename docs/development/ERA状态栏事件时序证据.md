# ERA 状态栏事件时序证据

> 调查日期：2026-09-03
>
> 本文只保存真实运行时序与 Artifact 读数；源码解释和重构方案分别放在独立文档。

## 1. Artifact 基线

Artifact root：

`/home/example/projects/酒馆开发目录/测试工具链/本地运行资料/live/artifacts-v4`

| 用途 | run | path | 完整性 |
| --- | --- | --- | --- |
| 快速初始化首帧 | `st-run-20260903T05364823-155693fa3b24` | `STATUSBAR-EXAMPLE-037` | 1/1 recorded，audit consistent/complete，严格 evaluator failed |
| 首帧 integrated 对照 | `st-run-20260903T05384101-74435348014b` | `INT-STATUSBAR-01-G77DF05AC` | 1/1 recorded，audit consistent/complete，同组断言 failed |
| 多楼读取错位 | `st-run-20260902T08360947-c0523cb9813a` | `STATUSBAR-EXAMPLE-025` | 完整细则 run 中的严格产品 failure |
| 旧聊天 reload/重启 | `st-run-20260902T08360947-c0523cb9813a` | `STATUSBAR-EXAMPLE-034` | 完整细则 run 中的严格产品 failure |
| 消息前端 API 自激 | `st-run-20260824T08090481-f1c09178614c` | `ERA-API-LIFECYCLE-PROBE-001` | 1/1 complete，audit consistent/complete，有界复现当前缺陷 |
| 本轮统一调查 | `st-run-20260903T07250307-633d4b6a2209` | `era-statusbar-lifecycle-forensics` | 12/12 recorded，171 actions，audit consistent/complete；8 passed、4 个严格产品 finding |
| loader/context 可行性 | `st-run-20260903T10004306-6f12a86f4e5e` | `STATUSBAR-PROBE-001` | 1/1 recorded，14 actions，evaluation passed，audit consistent/complete；只证明接入机制可行 |

## 2. 快速初始化首帧

### 2.1 操作边界

`STATUSBAR-EXAMPLE-037` 只做以下用户链：

1. 记录初始聊天；
2. 打开 ERA 面板；
3. 点击真实“ERA 快速初始化”；
4. 直接观察首个状态栏 iframe；
5. 不编辑、不 reload、不开强制重载。

动作 `quick-initialize` 的时间范围为
`2026-09-03T05:37:07.479Z` 至 `05:37:09.747Z`。

### 2.2 事件时间线

| UTC 时间 | 证据 | 含义 |
| --- | --- | --- |
| `05:37:08.651` | console：点击快速初始化 | 用户刺激已发出 |
| `05:37:08.855` | `character_message_rendered` | 一次早期消息渲染 |
| `05:37:08.886` | bridge `character_message_rendered(0,"era-technical-projection")` | ERA 技术块投影又公告了显示事件 |
| `05:37:08.897` | `message_iframe_render_started` | 首个前端渲染已开始 |
| `05:37:08.899` | bridge `chat_id_changed` | 聊天身份事件与渲染交错 |
| `05:37:08.911` | bridge `message_received(0,"first_message")` | 初始化后首楼被宿主接收 |
| `05:37:08.911` | bridge `character_message_rendered(0,"first_message")` | 首楼显示事件 |
| `05:37:08.915` | `message_iframe_render_started` + `chatLoaded` | iframe 与聊天加载链并非单一串行阶段 |
| `05:37:08.917` | `message_iframe_render_started` | 同楼再次开始前端渲染 |
| `05:37:08.952` | bridge 第二次 `message_received(0,"first_message")` | 角色/聊天更新链又收到首楼 |
| `05:37:09.008–09.009` | `era-technical-projection` 和 `first_message` rendered | 投影与宿主渲染再交错 |
| `05:37:09.015–09.016` | 两次 `message_iframe_render_started` | 当前消息的 iframe 被重审计 |
| `05:37:09.203` | `message_iframe_render_ended` | 一个 iframe 实例完成 |
| `05:37:09.265–09.270` | rendered + `era-technical-projection` | 完成后仍有显示事件 |
| `05:37:09.277–09.280` | 两次 iframe render started | 同楼继续重建/重审计 |
| `05:37:09.432` | iframe render ended | 后一个实例完成 |
| `05:37:09.747` | click action finished | 快速初始化 UI 动作结束 |

该 action 中 bridge 事件范围是 sequence `12..20`，console range 是 `213..261`。

### 2.3 同一现场的状态不一致

`quick-initialize-after` snapshot 已记录：

- raw message 0 已包含完整 `era_demo` Insert、`StatusPlaceHolderImpl` 和新 MK；
- Sidecar `recordStatus="found"`；
- Sidecar revision `4`；
- `statData.era_demo.player.hp=12`；
- `SelectedMks[0]` 是新首楼 MK。

紧随其后的 `observe-statusbar-after-init` 记录了一个
`readyState="complete"` 的真实 iframe，但同屏结果是：

| 读取方式 | HP/状态 | revision/MK |
| --- | --- | --- |
| `{{ERA:era_demo.player.hp}}` | 空字符串 | 无楼层身份 |
| `{{ERA-withmeta:...}}` | 空字符串 | 无楼层身份 |
| `ERA.get()` | HP `12` | revision `4`，当前 MK |
| `ERA.subscribe()` | HP `12` | revision `4`，当前 MK |
| `ERA.history.atMessage(0)` | HP `undefined` | revision `3`，旧 MK |

**运行事实**：这不是“整个 ERA 还没有状态”。在相同状态栏里，get/subscribe 已读到
最新快照，但一次性宏结果为空，history UI 保留了更早就绪时的结果。

**边界**：当前 Artifact 没有 Sidecar publish 函数内部的纯诊断事件，所以不虚构它的
精确毫秒。事件与 snapshot 已足以证明“显示实例就绪”与“该楼业务快照就绪”
之间缺少统一合同。

## 3. 多楼错位与旧聊天恢复

### 3.1 新聊天三楼

`STATUSBAR-EXAMPLE-025` 把首楼、中间楼、最新楼的 HP 依次设为
`12/14/16`。严格目标是：

- 各楼 macro/history = `12/14/16`；
- 三楼 get/subscribe 都 = 当前最新 `16`。

实际：首楼 macro 为空、history 初始为 `ERA_STATE_NOT_READY`；最新楼 macro 仍为
上一楼 `14`；同一现场的 get 已是 `16`，中间楼 history 可为 `14`。

这证明楼层的业务历史并非全部丢失；失败是不同显示实例在不同就绪时点取得了
不同语义的快照。

### 3.2 reload 与真实 ST 重启

`STATUSBAR-EXAMPLE-034` 的已存聊天有三个应出现的状态栏。reload/重启后已观察到：

- 只恢复 `1/3` iframe；
- 宏为空或保留 `{{ERA:...}}` 字面量；
- get 可显示 `[undefined]`；
- history 可显示 `ERA_STATE_NOT_READY`；
- raw message 和最新 Sidecar 仍存在。

因此这是显示恢复/身份就绪失败，不是聊天文件被删除。

## 4. 消息前端 API 自激

有界探针 `ERA-API-LIFECYCLE-PROBE-001` 在每个 iframe instance 中只主动响应一次
`writeDone`，并把总写入数人为上限设为 3。

实际观察：

- 同一消息前端加载 5 次；
- 三个 iframe instance 各执行一次写入；
- raw message 出现 3 个重复 `<VariableEdit>`；
- Sidecar 计数 `0→1→2→3`；
- 三次 EditLog 都是有效状态变化，而不是 UI 假响应。

关键事件中，`era:updateByObject` 后紧跟的 `era:writeDone` 分别显示 count
`1`、`2`、`3`。这证明自激循环每轮都真实写聊天并结算 Sidecar。

该运行的 evaluator passed 表示“调查探针成功证明当前闭环”，不表示产品行为正确。

## 5. 空聊天终态

`UI-DEL-007` 已经通过真实宿主删除链记录：

- `afterMessageCount=0`；
- 首楼所携带的 `era_demo` 在当前消息历史中已不存在；
- Sidecar 仍保留完整 `era_demo`。

它与状态栏 iframe 时序不同：即使不渲染状态栏，ERA 当前的空历史同步仍会
保留旧 stat/meta。

## 6. 强制重载对照

强制重载在 Sidecar 发布之后重建最近 N 楼的消息显示。这带来两个相反效果：

1. 对纯读状态栏，后创建 iframe 更可能赶上已发布 Sidecar，所以空值可能暂时消失；
2. 对 load 时调用写 API 的状态栏，每次重建都会重跑脚本，所以可放大自激。

它不保存楼层快照，不传递楼层上下文，也不保证重建次数，因而不能成为正确性机制。

## 7. 本轮统一调查 run

独立 suite `era-statusbar-lifecycle-forensics` 固定单 worker，共 12 条路径，覆盖：

- 快速初始化首帧与多楼；
- 编辑、Swipe、Regenerate、Continue、删除；
- 页面 reload、聊天/角色切换、真实 ST 重启；
- 状态栏加载时 message/branch/always 写入；
- 强制重载开/关与有界加载次数；
- 删除至零消息。

run `st-run-20260903T07250307-633d4b6a2209` 于
`2026-09-03T07:25:03.081Z` 开始、`07:35:23.823Z` 完成。其自身结果为：

- selected=recorded=`12/12`，全部 path `recordingStatus=completed`；
- 171 个 action 全部获得终态；12 个 required evaluation 全部有结果；
- 8 条 passed，4 条按严格产品合同 failed；
- audit `structuralStatus=consistent`、`recorderEvidenceStatus=complete`；
- 没有 execution、capture、Artifact、身份或基础设施失败。

失败路径与实际值：

| path | 严格目标 | 实际 | 归属 |
| --- | --- | --- | --- |
| `STATUSBAR-EXAMPLE-037` | 首个 iframe 的 macro/history 立即得到首楼 `12` | macro/withmeta 为空；get/subscribe=`12`；history 仍是旧 MK/revision 且 HP 空 | `ERA-PROD-005` 首帧就绪 |
| `STATUSBAR-EXAMPLE-025` | 三个 AI 楼 macro/history=`12/14/16` | message 0 macro 空/history not-ready；message 2=`14/14`；message 4 macro=`14`、history 无快照；三楼 get/subscribe 均=`16` | `ERA-PROD-005` 楼层投影 |
| `STATUSBAR-EXAMPLE-034` | reload 后三楼 macro/history=`12/14/16` | 三个 iframe 都恢复，但三楼 macro 都保留字面量，history 都 `ERA_STATE_NOT_READY`；get/subscribe 均=`16` | `ERA-PROD-005` 旧聊天恢复 |
| `UI-DEL-007` | 零消息后 Sidecar statData 为空 | `afterMessageCount=0`，Sidecar 仍保留 `era_demo` | `ERA-PROD-007` 空终态 |

其余 8 条路径均通过原有严格 oracle。这里的“通过”只表示对应 lifecycle 行为被正确
记录，并不反证首帧缺陷：例如 `STATUSBAR-EXAMPLE-019/020/023` 的初始观测也都看到
macro 空、history not-ready，但这些路径的行为义务是后续 Swipe、重渲染或 scope 路由。

### 7.1 历史状态栏写入的来源身份丢失

`STATUSBAR-EXAMPLE-023` 提供了一个比静态源码更直观的运行事实。强制重载后同时存在
message 0 与 message 2 的状态栏；message 0 的第二次 load 发出的三张 receipt 却都写明
`messageId=2`。两楼状态栏的 automatic count 最终相互汇总为
`message=4, branch=3, always=4`。

这与 `ERA.commit()` 当前“选最新 AI 消息”的实现一致，但不能满足状态栏作者的目标合同：
历史楼里的控件或加载脚本应默认把业务操作写回自己所在的 AI 消息。强制重载还让
message 0 与 message 2 的 `loadCounts` 都达到 2，直接证明它会增加脚本执行机会。

### 7.2 reload 与真实重启的对照

- `STATUSBAR-EXAMPLE-032`（页面 reload）和 `033`（真实重启 ST）各恢复 3/3 iframe；
  message 0 宏保留字面量、history not-ready，message 2 宏/history=`14`，最新
  message 4 宏仍=`14`、history 没有快照，而 get/subscribe 都为最新 `15`。
- `STATUSBAR-EXAMPLE-034` 的 reload 则让三个 iframe 的宏都保留字面量、history 全部
  not-ready，而 get/subscribe 仍正确为 `16`。

这修正了“旧聊天总是只恢复一个 iframe”的过度概括：**iframe 数量本身可以恢复完整，
但逐楼宏/history 是否就绪仍不稳定**。不同 run 的具体表象不同，共同不变量是没有
逐楼首帧正确性保证。

## 8. loader/context 可行性探针

`STATUSBAR-PROBE-001` 是诊断专用路径，不进入普通 detail、integrated 或回归通过率。它先通过
真实快速初始化创建状态栏资源，再在 message 0 的真实 Swipe 中放入
`<StatusPlaceHolderImpl/>`，最后临时把该角色卡的“ERA 状态栏模板”替换为测试 loader；teardown
会恢复原正则。

### 8.1 可阻停的边界

释放 gate 前的真实读数是：

- iframe `readyState="complete"`；
- 整个文档 `visibility="hidden"`；
- 作者逻辑 `authorRan=false`，展示值仍为 `__ERA_PROBE_PENDING__`；
- ERA 已通过 `waitGlobalInitialized('ERA')` 就绪，但测试 gate 尚未释放。

释放后才出现：`authorRan=true`、文档可见、展示值变为
`resolved:0:<当前 MK>`。因此不能声称 ERA 能冻结浏览器原生的 iframe 网络/load
生命周期；已经确认可行的是更有用的产品合同：**让一个不可见的 ERA loader shell 先挂载，
在楼层身份、ERA 状态和宏都准备好以前不执行作者状态栏代码、不产生首帧，准备好后再一次性
激活并显示。**

### 8.2 楼层身份

释放前，同一个 iframe 中三种独立来源一致：

- `getCurrentMessageId()` 返回 `0`；
- `window.name` 是 `TH-message--0--0`；
- 父页面最近的 `.mes[mesid]` 是 `0`。

这证明当前 Tavern Helper 运行环境允许 ERA 在不修改 Tavern Helper 的情况下，于状态栏内部
取得并交叉校验来源楼层。该单楼探针尚不能替代 reload、Swipe、Continue、编辑和删除后的
多生命周期映射验证。

### 8.3 状态栏内外 API 调用

探针还确认了一个关键限制：释放前 `iframe.window.ERA === top.ERA`。也就是说，现有共享
`ERA` facade 的函数体只在顶层执行，仅凭 JavaScript 调用本身无法知道调用者来自哪个 iframe。

探针随后在 iframe 内安装一个 ERA 自有的局部 facade。相同的 `ERA.get()` 调用因此得到：

- 状态栏内：`source="message-iframe"`、`messageId=0`、`frameName="TH-message--0--0"`；
- 顶层页面：`source="top-window"`、`messageId=null`。

事件顺序严格为 `loader-started → facade-ready → inside-get → author-ran → revealed →
outside-get`。因此，**当前共享 facade 不能自动区分来源；ERA 在 loader 中安装按 iframe 绑定的
局部 facade 后可以区分，并可把楼层身份附到 get/commit/subscribe 等调用上。**

## 9. 证据能支持与不能支持的结论

### 已支持

- 首帧宏为空和 history 未就绪是真实产品行为，不是截图时无意中提前观察。
- get/subscribe 的最新状态语义可与宏/history 的失败同时出现。
- 编辑/重建是另一次读取机会，不是修复原始首帧。
- API 自激的每一轮都是真实聊天写入和 Sidecar 结算。
- 强制重载不可靠，且能增加 iframe load 脚本的执行次数。
- 空聊天残留可在没有 iframe 的条件下独立存在。
- 历史状态栏发出的写操作当前会落到最新 AI 消息，而非来源状态栏所在消息。

### 不应越界推断

- 未打点 Sidecar publish 函数时，不声称它必然在某个 iframe event 前或后的
  某一毫秒发生。
- 单次恢复失败不能证明每次都只会恢复 `1/3` iframe；可确认的是当前没有
  稳定的逐楼就绪保证。
- 不把所有表现强行合并成一个根因；空历史 no-op 至少是独立的领域决策缺陷。
