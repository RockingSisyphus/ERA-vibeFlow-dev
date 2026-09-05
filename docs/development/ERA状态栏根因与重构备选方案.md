# ERA 状态栏根因与重构备选方案

> 调查结论日期：2026-09-03
>
> 2026-09-03 用户审阅修正：所有方案必须保留 ERA“最新状态＋完整变更记录”的持久化模型，
> 不得为每个聊天楼层长期保存完整变量快照。
>
> 2026-09-03 第二次审阅修正：最终实现不得要求修改 Tavern Helper；历史状态栏默认只显示
> 最近 3 个符合条件的 AI 楼层，不因滚动自动加载；范围外默认显示 ERA 占位界面，并允许
> 用户从 ERA UI 临时指定一个历史楼层显示。
>
> 状态：方案研究、VibeFlow planned review 与人工审核已完成；按楼状态栏实现已落地，正在进行最终真实回归验收

## 1. 修正后的核心结论

ERA 不长期保存每楼快照是正确设计。聊天可能达到数千甚至一万楼；若每次状态变化都复制
完整变量树，空间会接近“楼层数 × 状态大小”，违背 ERA 使用变更日志重建历史的初衷。

需要重构的不是持久化模型，而是**状态栏接入模型**：

1. 状态栏第一次显示得太早，ERA 的最新状态和变更日志可能尚未就绪；
2. 状态栏加载时没有可靠告诉 ERA“我属于哪一楼”；
3. ERA 因而只能使用全局最新状态，或让 history 在未就绪时失败；
4. 为补救显示而重画消息会销毁并重建 iframe，使加载脚本再次执行。

正确方向是：

```text
仍只持久化 latest state + complete edit/function logs
  + 状态栏加载时绑定楼层身份
  + 等待本轮同步就绪
  + 需要显示时按日志动态计算该楼快照
  + 仅对少量活跃状态栏做有界内存缓存
  + 数据更新不重建 iframe
```

## 2. 保持不变的持久化模型

磁盘和 Sidecar 中继续只保存：

- 当前活动分支最新的 `statData/statFunc/meta`；
- 完整 Variable/Function EditLog；
- SelectedMks、分支与回放所需身份；
- 当前 revision。

不新增：

- 每楼完整变量快照表；
- 每楼持久化状态栏副本；
- 第二份与 Sidecar 并列的业务真相；
- 随聊天长度线性增长的 iframe 状态缓存。

历史楼状态仍使用 ERA 现有思想：从最新状态和日志逆向恢复到目标 MK/messageId。重构只需
把这项能力变成显示链可以可靠调用的 `HistoricalStateResolver`。

## 3. 新的运行时模型

### 3.1 StatusbarIdentity

每个真实加载的状态栏实例必须先绑定：

```ts
type StatusbarIdentity = {
  chatId: string;
  branchId: string;
  messageId: number; // 当前数组位置，删除后可变化
  mk: string;        // 稳定业务身份
  iframeInstanceId: string;
};
```

messageId 用于定位当前宿主消息，MK 用于抵抗删楼、Swipe 和重排。两个都不能省略。

### 3.2 OnDemandHistoricalStateResolver

状态栏请求 message 20 时，ERA 才从当前 latest state 沿日志逆向计算到 message 20；
没有打开、没有进入显示范围的楼层不计算。

一次需要显示多个楼层时不做 N 次完整回放，而是把目标 MK 排序，在一次逆向遍历中依次
产生所需结果。例如默认范围内需要 97、98、99 三楼，只逆向扫描一次日志。

### 3.3 固定显示窗口与有界临时缓存

ERA UI 增加“历史状态栏显示范围”，默认 `3`。它表达的是：

- 初次载入聊天时，只激活最近三个包含 ERA 状态栏的 AI 楼层；
- 更早楼层不因滚动、进入视口或展开消息而自动加载；
- 范围外默认显示轻量 ERA 占位界面，作者状态栏代码不执行，也不计算历史快照；
- 用户可以把全局溢出行为改为 `placeholder`、`empty` 或 `hidden`，默认是 `placeholder`；
- 已激活结果在离开窗口后立即丢弃或按严格上限淘汰；
- 缓存按 `(chatId, branchId, MK, revision)` 失效；
- 历史编辑、Swipe、删除后，只失效受影响楼层及其后续结果。

这里的“差值”按**包含 ERA 状态栏的 AI 回复序号**计算，不按原始 messageId 相减。用户消息、
系统消息和没有状态栏的 AI 消息不会无意间消耗显示名额。范围是明确的资源策略，不是正确性
门禁：范围内必须显示正确快照，范围外必须明确占位、空白或隐藏，绝不能展示最新楼或过期值。

ERA UI 另提供“显示指定楼层状态栏”：用户输入/选择某一 AI 楼层后，临时激活该楼，并保留
默认最近 3 楼。为保持资源上界，同一聊天同一时刻只保留一个指定楼层；指定另一楼时，前一
指定楼恢复为范围外表现。这个选择只属于当前页面实例，不写入 Sidecar 或角色卡。

缓存可以只保存模板实际请求的路径；只有调用“取得整楼状态”的 API 时才临时构造完整对象。
因此长期空间仍是：

```text
O(latest state + edit logs)
```

临时空间受活跃状态栏数量限制，而不是随聊天总楼数增长。

## 4. 正确的状态栏显示生命周期

### 4.1 首次显示

```text
SillyTavern 完成消息 DOM
  → ERA 识别带标记的状态栏代码块并先放入 ERA loader shell
  → loader 在消息 iframe 内读取 getCurrentMessageId()/window.name
  → ERA 用父级 .mes[mesid] 与 SelectedMks 交叉校验 messageId/MK
  → 绑定 chat + branch + messageId + MK + iframe instance
  → 先执行最近 3 楼/指定楼/显式强制的显示策略
  → 范围外直接显示占位、空白或隐藏，不启动作者状态栏
  → 等待 ERA 当前同步 revision 已覆盖该 MK
  → 按需计算该楼状态
  → 替换该状态栏中的全部 ERA 宏
  → 在 iframe 内注入绑定楼层的本地 ERA facade
  → 激活作者状态栏内容
  → 一次性显示状态栏
```

在完成前可以显示 skeleton，但不能先展示空值、字面宏或上一楼数据。

### 4.2 后续状态变化

变量或函数更新后，ERA 只重新计算仍活跃且受影响的状态栏，并把新值推给原 iframe。不得
调用 `refreshOneMessage()`、重写 `.mes_text` 或重新运行状态栏初始化脚本。

### 4.3 reload、旧聊天与切换

聊天加载后先恢复 latest state 和日志；ERA 只激活最近 3 个状态栏和一个用户指定楼层。
滚动不会改变集合。无需在 reload 时计算一万楼，也不会一次性执行一万个历史状态栏脚本。

## 5. 读取 API

### 5.1 `ERA.get()` 的上下文语义

保留非状态栏调用的现有含义：

```ts
ERA.get();       // ERA UI、全局脚本等处：当前活动分支最新状态
ERA.subscribe(); // 最新状态发布
```

状态栏 loader 会在自己的 iframe 内安装局部 facade。因此同一行作者代码在状态栏中自动变为
楼层语义，不要求作者查找或传入 messageId：

```ts
ERA.get();
// 状态栏内：返回该状态栏所在 AI 楼层的 statData/statFunc/MK/messageId/revision

ERA.get({ force: true });
// 已激活的状态栏内：忽略历史距离上限，立即按日志重建该楼快照

ERA.get({ overflow: 'empty' });
// 可覆盖全局 placeholder/empty/hidden 行为

ERA.subscribe(listener);
// 状态栏内：订阅该楼投影的变化；状态栏外仍订阅活动分支 latest
```

正式 JavaScript 语法使用 `ERA.get({ force: true })`，而不是 `ERA.get(force=true)`。后者是变量
赋值表达式，不是 JavaScript 的命名参数。

返回对象保持一个稳定形状，但状态扩展为：

```ts
status: 'ready' | 'loading' | 'out-of-range'
```

`out-of-range` 时变量、函数与日志视图为空，并携带明确的楼层、距离和溢出策略元数据；不能
把当前最新状态伪装成该楼状态。

### 5.2 强制计算与强制创建必须分开

若范围外状态栏完全不启动，写在作者状态栏内部的代码自然不能先执行
`ERA.get({ force: true })` 来要求创建自己。为了既不运行一万个隐藏 iframe，又保留强制能力：

- `ERA.get({ force: true })`：让**已经激活**的状态栏绕过历史计算上限；
- ERA UI“显示指定楼层状态栏”：让用户显式激活某一范围外楼层；
- 作者若要求某个状态栏不受默认范围限制，在 ERA 状态栏根元素使用声明式
  `data-era-force-display="true"`。loader 在运行作者脚本前就能读取它。

不通过静态解析任意 JavaScript 猜测其中是否写了 `ERA.get({ force: true })`，也不为了发现
这个调用而预先执行所有范围外状态栏。两种做法都会重新引入性能或副作用问题。

### 5.3 宏与 API 共用同一楼层 resolver

普通 `{{ERA:path}}` 和 `{{ERA-withmeta:path}}` 也走同一个 resolver，所以宏与
状态栏内 `ERA.get()` 不会出现一边正确、一边 not-ready。ERA loader 在 iframe 内容可见前
解析宏；同步未就绪时整个状态栏保持 skeleton，而不是先把不存在路径替换为空。

状态栏内 `ERA.subscribe()` 也订阅同一个楼层投影。历史楼写入、后续重算或分支变化影响该楼
时，ERA 只向现有 iframe 推送新投影；状态栏外的订阅仍保持 latest 语义。

## 6. 写入 API 与防止自激

### 6.1 写入目标

状态栏内的本地 facade 同样把 `ERA.commit()` 绑定到该状态栏的 MK，再由 MK 定位当前
messageId：

```text
状态栏所在楼提交操作
  → 把 Variable/Function/era_tx 写进该 AI 消息
  → 从该消息开始顺序重算后续楼层
  → 提交 Sidecar latest state 和日志
  → 更新当前仍活跃的受影响状态栏
```

状态栏外 `ERA.commit()` 的兼容含义继续是 latest；状态栏内则明确采用所在楼语义。这一差异
由 ERA 注入的局部 facade 实现，不改变顶层全局 ERA 对象。

### 6.2 为什么不会循环

根因修复不是“看到相同 payload 就去重”，而是取消自激链中的重建：

```text
API 写入
  → Sidecar 和日志更新
  → 向现有 iframe 推送数据
  → iframe 仍是同一个 instance
  → load 脚本不会再次运行
```

两次用户点击会产生两次调用，仍然合法执行。只有宿主确实进行了 reload、Swipe 或编辑而
创建了新 iframe 时，加载脚本才属于新的真实 mount。若作者需要“每条消息只自动执行一次”，
可另提供显式 effect key；它不能用 payload hash 猜测。

## 7. ERA 自有的状态栏接入层

不要求修改 Tavern Helper。ERA 实现唯一 `StatusbarMountCoordinator`，由两部分组成：

1. **ERA loader shell**：快速初始化生成的状态栏正则输出带稳定 ERA 标记，并把作者内容放入
   尚未激活的模板中。loader 先取得楼层身份、等待状态和执行范围策略，再决定是否运行作者
   HTML/JavaScript。
2. **Host coordinator**：从 iframe 内已有 `getCurrentMessageId()` 和 `window.name` 取得候选
   messageId，再用父消息 `.mes[mesid]`、当前 chatId/branchId 和 SelectedMks 交叉校验并绑定
   MK。任何字段不一致时显示明确诊断，不回退到 latest。

已核实的 Tavern Helper 现状可被利用但无需修改：

- 消息 iframe 名称为 `TH-message--<messageId>--<index>`；
- iframe 内已有 `getCurrentMessageId()`；
- `message_iframe_render_started` 在 Vue mount 时携带 iframe 名称；
- `message_iframe_render_ended` 在 load 时发出。

ERA 不把上述事件当成“数据已就绪”。它们只用于身份核验和生命周期观测；真正的可见 barrier
由 ERA loader 自己控制。

诊断路径 `STATUSBAR-PROBE-001` 已在当前 Tavern Helper 4.9.3 上确认：

- loader shell 可以先挂载；即使 iframe 的原生 `load` 已完成，仍可保持文档不可见并阻止作者
  脚本执行，直到 ERA 状态、楼层身份和宏准备完成；因此实现目标应表述为“作者激活/首帧
  barrier”，而不是冻结浏览器的 iframe load；
- `getCurrentMessageId()`、`window.name` 与父 `.mes[mesid]` 在 message 0 上一致，ERA 可以在
  不修改 Tavern Helper 的情况下取得来源楼层；
- 当前 iframe 默认继承 `top.ERA`，共享 facade 无法仅凭调用本身区分状态栏内外；在 iframe
  内安装 ERA 局部 facade 后，状态栏调用可携带 `message-iframe + messageId`，顶层调用保持
  `top-window + messageId=null`。

planned review 前仍需补齐的边界是：

- reload、Swipe、Continue、编辑和删除后，iframe name、父 `.mes` 与 MK 的映射是否一致；
- 旧版快速初始化状态栏能否安全迁移成 loader shell；无法迁移的旧模板必须提示升级，不能
  静默使用 latest；
- 不同受支持 Tavern Helper 版本是否保持相同的身份入口。

探针若失败，回到 ERA 内部调整注入位置或模板包装方式；不以修改 Tavern Helper 作为后备
方案，也不叠加延迟、周期扫描或强制重载。

## 8. 空历史是独立的小修复

零消息历史不能继续 no-op。它应产生合法 terminal transaction：

```text
messages=[]
  → stat={}
  → statFunc={}
  → SelectedMks=[]
  → EditLog=[]
  → FunctionEditLog=[]
  → committed receipt + new revision
  → 释放所有状态栏绑定和临时缓存
```

这不要求建立任何每楼持久快照。

## 9. 删除强制重载

- 删除运行时强制重绘逻辑；
- 删除“强制重载功能”和“强制重载消息数”的 UI；
- 旧设置读取后忽略，并在下次保存时清除；
- 不把它改名成“自动刷新”或“定向刷新”；
- 状态栏显示范围是**固定激活窗口**，不是另一种消息重绘功能；
- “显示指定楼层状态栏”只负责首次激活/撤销一个历史状态栏，不用于状态变化后的刷新；
- 已激活状态栏的数据变化通过同一 iframe 的结构化更新完成，不重建整条消息或 iframe。

## 10. 实施与验收状态

mount/context 探针、唯一相关 workflow 与 Host Extension 四类变更清单、expanded planned SVG、
Architecture freshness、validate、review 和用户人工审核均已完成。产品实现已经改为本文件描述的
按楼身份绑定、按需历史计算、有界活动投影和原 iframe 推送，并删除强制重载链。

当前只剩真实浏览器回归、受影响专项、综合回归和最终文档结算；在这些证据完成前，不把本文件
中的设计状态直接等同于发布验收通过。

产品验收必须包含：首次 iframe、多楼、默认最近 3 个状态栏、滚动不激活旧楼、三种范围外
行为、UI 指定一个旧楼、声明式强制显示、`ERA.get({ force: true })`、reload、切聊天/角色、
真实 ST 重启、Swipe、Regenerate、Continue、历史编辑、删除、历史楼手动/自动写入、两次
相同用户点击、空历史，以及强制重载代码和 UI 已真正删除。

## 11. 证据入口

- [ERA 状态栏事件时序证据](ERA%E7%8A%B6%E6%80%81%E6%A0%8F%E4%BA%8B%E4%BB%B6%E6%97%B6%E5%BA%8F%E8%AF%81%E6%8D%AE.md)
- [SillyTavern 与 Tavern Helper 状态栏执行链](SillyTavern%E4%B8%8ETavernHelper%E7%8A%B6%E6%80%81%E6%A0%8F%E6%89%A7%E8%A1%8C%E9%93%BE.md)
- [ERA 当前缺陷基线](../testing/ERA%E5%BD%93%E5%89%8D%E7%BC%BA%E9%99%B7%E5%9F%BA%E7%BA%BF.md)
