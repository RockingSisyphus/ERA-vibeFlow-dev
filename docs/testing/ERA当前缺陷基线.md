# ERA 当前缺陷基线

> 状态：当前 ERA 开放缺陷的唯一权威入口
>
> 基线日期：2026-09-03
>
> 证据范围：ERA-Test-Pack 真实 SillyTavern 细则、综合回归、用户人工审核与隔离生命周期探针

## 1. 使用规则

本文只登记仍可复现、尚未完成产品修复验收的 ERA 缺陷。测试系统缺陷、已经修复的
产品问题、明确不支持的功能和只有旧 Artifact 的候选，不进入“当前缺陷”计数。

其他文档的职责固定为：

- [`ERA产品问题台账.md`](ERA产品问题台账.md) 保存历史问题的修复与排除记录；
- [`../development/ERA-API-生命周期与幂等策略调查.md`](../development/ERA-API-生命周期与幂等策略调查.md)
  保存 API 自激问题的机制、实验方法和候选修复设计；
- ERA-Test-Pack 的 `docs/test-runs/**` 保存各次运行当时的原始事实，不回写为当前状态；
- 当前缺陷是否仍然开放、多个表现是否属于同一根因、下一次修复的验收条件，只在本文维护。

截至本基线，ERA 有 **3 个开放根因域、5 种用户可见表现**。

## 2. 开放缺陷总览

| ID | 根因域 | 优先级 | 已确认的用户可见表现 | 当前状态 |
| --- | --- | --- | --- | --- |
| `ERA-PROD-005` | 状态栏楼层身份、快照就绪与 iframe 生命周期 | P0 | 快速初始化首帧为空；新聊天多楼错位；旧聊天恢复失败 | confirmed |
| `ERA-PROD-006` | 消息前端 ERA 写 API 缺少业务 effect/因果幂等身份 | P0 | iframe 回写消息后自我重建并重复执行写操作 | confirmed |
| `ERA-PROD-007` | 删空聊天后的 Sidecar 终态未与空消息历史收敛 | P1 | 消息已经删至零条，Sidecar 仍保留 `era_demo` | confirmed |

## 3. ERA-PROD-005：状态栏读取与恢复时序

### 3.1 公开语义

状态栏中的读取方式不是同义接口：

- `{{ERA:path}}` 和 `{{ERA-withmeta:path}}` 应显示状态栏所在消息楼层的快照；
- `ERA.history.atMessage(currentMessageId)` 应返回所在楼层的变量、函数、MK 和消息身份；
- `ERA.get()` 和 `ERA.subscribe()` 应显示当前活动分支的最新状态，即使调用它们的是历史楼状态栏。

测试不能用 `ERA.get()` 的最新值证明历史宏正确，也不能用 history API 替代普通宏。

### 3.2 表现 A：快速初始化首帧读取为空

用户操作：在只有纯净角色首楼的聊天中点击“ERA 快速初始化”，不编辑消息、不 reload、
不开启强制重载，直接查看首次创建的示例状态栏。

预期行为：第一个 `readyState=complete` 的状态栏 iframe 就应显示
`era_demo.player.hp=12`；宏、withmeta、get、subscribe 和 history 分别满足上述公开语义。

实际行为：严格自动测试观察到 iframe 已完成加载，`ERA.get()` 与 `ERA.subscribe()` 已读到
HP `12`，但普通宏和 withmeta 宏为空，`ERA.history.atMessage()` 的 HP 为 `undefined`。
只要编辑消息或刷新显示使 iframe 重建，后创建的实例通常就能读取正确状态。

正式证据：

- detail `STATUSBAR-EXAMPLE-037`，run `st-run-20260903T05364823-155693fa3b24`；
- integrated owner `INT-STATUSBAR-01-G77DF05AC`，run
  `st-run-20260903T05384101-74435348014b`；
- 两个 run 均为 1/1 完整录制、7 actions、Artifact audit `consistent/complete`，required
  evaluator 均因同一组宏/history 严格断言失败。

这组自动证据取代早期仅来自用户人工审核的 `ERA-CAND-004` 候选状态；该表现现已确认。

### 3.3 表现 B：新聊天多楼状态栏错位

用户操作：快速初始化后连续生成多楼，让首楼、中间楼和最新楼的 HP 分别为 `12`、`14`、
`16`，然后查看三个状态栏。

预期行为：三个楼层的宏/history 分别显示 `12/14/16`，三个楼层中的 get/subscribe 都显示
当前活动分支最新值 `16`。

实际行为：`STATUSBAR-EXAMPLE-025` 中首楼宏为空且 history 初始化为
`ERA_STATE_NOT_READY`，最新楼宏仍停留在上一楼的 `14`；同一现场的 `ERA.get()` 能正确显示
最新值 `16`，中间楼 history 也能正确显示 `14`。因此问题不是整个 ERA 状态丢失，而是不同
状态栏实例在不同就绪时点取得了不一致的楼层投影。

### 3.4 表现 C：旧聊天 reload 或重启后状态栏恢复失败

用户操作：在已有多楼聊天中 reload 页面，或真正重启 SillyTavern 后重新进入同一聊天。

预期行为：每个旧消息楼层都重新创建且完成状态栏投影，宏/history 保持各楼历史值，
get/subscribe 显示最新活动状态。

实际行为：可能只恢复一个本应为三个的 iframe；已出现的 iframe 也可能尚未具备 ERA 状态。
宏可能为空或保留 `{{ERA:...}}` 字面量，`ERA.get()` 可显示 `[undefined]`，history 可返回
`ERA_STATE_NOT_READY`。同一次运行仍能读取原消息和最新 Sidecar，因此这不是聊天数据丢失。

对应严格细则为 `STATUSBAR-EXAMPLE-034`，完整综合回归
`st-run-20260902T08360947-c0523cb9813a` 也保留了同一产品失败。

### 3.5 当前根因边界

三个表现共同指向“消息楼层身份、Sidecar/public snapshot 发布、同步宏求值和 Tavern Helper
消息 iframe 一次性启动”之间缺少统一就绪合同。现有证据已经足以确认产品行为错误，但尚未用
单一事件探针把所有宿主事件收窄成唯一先后序列，因此不能把某一个事件监听器提前或延后直接写成
已确认根因。

“强制重载功能”不是修复：它在较晚时点重建 iframe，所以能部分掩盖空值或错位；但重建也会
重新运行状态栏脚本，可能放大 `ERA-PROD-006`。用户不应为了获得正确首帧而必须编辑消息、
reload 或开启强制重载。

### 3.6 修复验收

- 快速初始化的首个 iframe 在任何人为刷新前即通过 `STATUSBAR-EXAMPLE-037`；
- 新聊天多楼、页面 reload、切回旧聊天和真实 SillyTavern 重启后，各楼宏/history 与
  get/subscribe 均满足各自语义；
- 修复不修改原消息、Sidecar 历史或活动分支选择；
- 不依赖通用强制重载，也不因定向重建重复执行状态栏业务写入；
- 细则、对应 integrated owner 和受影响状态栏专项均以独立 Artifact 通过。

## 4. ERA-PROD-006：消息前端写 API 自激重放

用户场景：角色作者在消息状态栏的加载脚本中调用 ERA 写 API，例如收到 `writeDone` 后把计数
加一。作者脚本在每个 iframe 实例中只主动调用一次。

实际链路：

```text
消息 iframe 加载
  → 状态栏调用 ERA 写 API
  → ERA 向末尾 AI 消息追加 Variable/Function 命令
  → Tavern Helper 因 MESSAGE_UPDATED 重建该消息 iframe
  → 新 iframe 再次运行加载脚本并再次写入
```

隔离探针 `st-run-20260824T08090481-f1c09178614c` 使用外部上限避免失控，仍观察到同一楼
iframe 加载 5 次、执行 3 次写入、消息中出现 3 个重复 `<VariableEdit>`，Sidecar 计数
`0→1→2→3`。没有探针上限时，当前 ERA 没有产品级自动停止条件。

这不是简单的 payload 重复：相同 payload 也可能代表两次合法调用。当前缺失的是可跨 iframe
重建保持的业务 effect key、调用策略和根因果周期身份。示例状态栏测试模式预占加载预算只保护
该测试示例，不修复用户自定义状态栏和通用 ERA API。

修复验收必须同时满足：

- 旧 API 继续保持“每次明确调用都执行”的兼容语义；
- 新的幂等/effect 合同能区分合法重复与同一因果周期的意外重放；
- API 回写引起的 iframe 重建不会把一次业务 effect 变成多次；
- message、branch、always、编辑、Swipe、reload 和 full replay 后的执行账本与消息历史一致。

详细机制和候选设计见
[`ERA-API-生命周期与幂等策略调查.md`](../development/ERA-API-生命周期与幂等策略调查.md)。

## 5. ERA-PROD-007：删空聊天后 Sidecar 残留

用户场景：快速初始化后，使用真实删除链把当前聊天删除至零条消息。承载初始化
`<VariableInsert>` 的首楼也已经不在当前消息历史中。

预期行为：ERA 根据空消息历史完成同步后，Sidecar 不再保留只能由已删除首楼产生的
`era_demo` 状态。

实际行为：`UI-DEL-007` 已记录 `afterMessageCount=0`，但 Sidecar 仍保留完整 `era_demo`。
该细则在独立复测和 294-owner 完整综合回归中均保持严格失败；同组其他删除测试均通过。

范围说明：不同 SillyTavern 版本或普通菜单未必允许用户直接删除固定主开场白。本缺陷确认的是
ERA-Test-Pack 已能通过真实宿主删除链到达的“零消息聊天”终态一致性，不把它扩大解释成所有常规
单楼删除都会残留。

修复验收：删除至零消息、reload、full sync 和重新进入聊天后，消息历史、SelectedMks、
EditLog、FunctionEditLog 与 Sidecar 同时收敛；普通删除、批量删除和保留首楼的路径不得回退。

## 6. 当前没有证据支持的额外缺陷

以下旧失败已修复或排除，不计入当前缺陷：

- Swipe 后停止生成仍停留旧 Swipe；
- 非法消息 ID/rollback ID 穿透 UI；
- 320px 移动端面板横向溢出；
- 多阶段技术块 DOM 投影计数为零；
- 关闭悬浮球仍挂载 UI；
- Swipe 删除不同步、Regenerate 后变量为空、点号键、PNG/WAV 生成等旧失败。

这些项目的历史原因和验证入口保留在 [`ERA产品问题台账.md`](ERA产品问题台账.md)。完整综合
回归中曾出现的 API、Insert/Edit/Delete、顺序、数组和消息来源 owner 失败，已由 detail diagnose
证明是 Pack 累计 oracle、共享状态或证据重绑定错误，不能列为 ERA 产品缺陷。

## 7. 后续维护

修复任一开放问题时，必须在本文记录根因、产品提交、受影响接口、定点细则、综合 owner、run ID、
required evaluation 和 Artifact audit。只有产品测试与真实酒馆测试都通过后，才能把条目移入
历史台账并从本文的开放总览删除；不得通过 xfail、inconclusive、改变公开语义或拼接多个 Artifact
获得“已修复”结论。
