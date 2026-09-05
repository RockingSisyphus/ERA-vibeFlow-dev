# ERA 当前缺陷基线

> 状态：当前 ERA 开放缺陷的唯一权威入口
>
> 基线日期：2026-09-03
>
> 证据版本：ERA `099115b344e3f47c7997ecc8aeb73b59a00b81e7`；统一调查 run
> `st-run-20260903T07250307-633d4b6a2209`；loader/context 可行性 run
> `st-run-20260903T10004306-6f12a86f4e5e`

## 1. 文档边界

本文只保留开放缺陷、用户表现、已确认根因、验收条件和调查入口，不重复事件全文或源码
摘录：

- [ERA 状态栏事件时序证据](../development/ERA%E7%8A%B6%E6%80%81%E6%A0%8F%E4%BA%8B%E4%BB%B6%E6%97%B6%E5%BA%8F%E8%AF%81%E6%8D%AE.md)：真实 run、逐动作时间线和实际值；
- [SillyTavern 与 Tavern Helper 状态栏执行链](../development/SillyTavern%E4%B8%8ETavernHelper%E7%8A%B6%E6%80%81%E6%A0%8F%E6%89%A7%E8%A1%8C%E9%93%BE.md)：宿主源码与 ERA 调用链；
- [ERA 状态栏根因与重构备选方案](../development/ERA%E7%8A%B6%E6%80%81%E6%A0%8F%E6%A0%B9%E5%9B%A0%E4%B8%8E%E9%87%8D%E6%9E%84%E5%A4%87%E9%80%89%E6%96%B9%E6%A1%88.md)：根因归并、ERA 自有接入层、固定显示窗口和按需历史方案；
- [ERA 产品问题台账](ERA%E4%BA%A7%E5%93%81%E9%97%AE%E9%A2%98%E5%8F%B0%E8%B4%A6.md)：已修复、已排除和历史问题；
- [ERA API 生命周期与幂等策略调查](../development/ERA-API-%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F%E4%B8%8E%E5%B9%82%E7%AD%89%E7%AD%96%E7%95%A5%E8%B0%83%E6%9F%A5.md)：早期自激探针和历史设计资料。

当前共有 **3 个开放根因域、6 种用户可见表现或作者能力缺口**。

## 2. 总览

| ID | 根因域 | 用户表现/能力缺口 | 优先级 |
| --- | --- | --- | --- |
| `ERA-PROD-005` | 楼层身份、按需历史解析与首帧就绪分裂 | 快速初始化首帧为空；新聊天多楼错位；旧聊天 reload/重启恢复错误 | P0 |
| `ERA-PROD-006` | 状态栏写入缺少来源楼层与 effect 身份 | 历史楼操作写到最新楼；iframe 重建后自动脚本重复写入 | P0 |
| `ERA-PROD-007` | 空消息历史被实现为保留旧状态的 no-op | 消息删至零条后 Sidecar 仍保留已删除首楼产生的状态 | P1 |

## 3. ERA-PROD-005：状态栏读取与恢复

### 用户应当看到

- `{{ERA:path}}` 与 `{{ERA-withmeta:path}}` 在状态栏第一次可见时就显示该状态栏所在
  AI 楼的快照；
- `ERA.get()` 在普通脚本和 ERA UI 中继续显示当前活动分支最新状态；在 ERA 状态栏中则
  自动显示该状态栏所在楼的变量、函数、MK 和 revision，不要求作者传 messageId；
- `ERA.subscribe()` 在普通脚本中保持当前活动分支最新状态语义，在状态栏局部 facade 中订阅
  该楼投影，以便 API 写入后不重建 iframe 即可实时更新；
- reload、切聊天/角色、真实重启、Swipe 和历史编辑后语义不变。

### 当前实际表现

- 快速初始化首个 iframe 已 complete 时，macro/withmeta 为空，history 尚未就绪，
  但 get/subscribe 已能读到 HP 12；
- 三楼应为 `12/14/16` 时，首楼宏为空，最新楼宏可停在 `14`，而三楼 get/subscribe
  都正确为最新 `16`；
- reload 或真实 ST 重启后可以恢复全部 iframe，但宏可能仍是字面量、history
  `ERA_STATE_NOT_READY`，最新楼 history 也可能没有快照。

### 已确认根因

- ERA 只有单个 latest active snapshot，显示层没有把现有日志回放能力包装成按楼、按需且有界的 resolver；
- ERA 宏忽略 context，宏刷新用同一个最新 snapshot 更新所有楼；
- Tavern Helper 当前消息宏渲染没有传 messageId；
- 业务快照 ready、消息 DOM ready 和 iframe ready 没有共同 barrier；
- 多个组件整体替换 `.mes_text`，导致楼层显示实例反复重建。

可行性探针已经证明 ERA 可用不可见 loader 将作者逻辑和首帧延后，并从 iframe 内取得楼层
身份；它尚未成为产品实现，因而不改变本缺陷的开放状态。

### 验收条件

- 首个 iframe 不经编辑、reload 或延迟碰运气即可读到正确楼层；
- 多楼与所有生命周期边界中，macro/history 和状态栏内 get/subscribe 按楼，状态栏外
  get/subscribe 按最新；
- 显示更新不重建整条消息或 iframe；
- 默认只显示最近 3 个带状态栏的 AI 楼层；滚动不激活更老楼层，范围外默认显示 ERA 占位，
  UI 可临时指定一个旧楼显示；
- 不依赖强制重载，旧角色卡宏仍兼容。

## 4. ERA-PROD-006：状态栏写入错位与自激

### 用户应当得到

- 状态栏中的简易写 API 默认写回状态栏所在 AI 消息；
- 历史楼写入后从该楼开始顺序重算后续楼；
- 写入结果实时显示，但显示更新不重新执行 load 脚本；
- 两次明确点击同一操作仍执行两次。

### 当前实际表现

- 历史 message 0 状态栏的 commit receipt 实际返回 `messageId=2`，即写到最新 AI 楼；
- 已有有界探针观察到一次 load 写入使 iframe 重建，5 次 load 产生 3 次真实消息写入，
  Sidecar 计数 `0→1→2→3`；
- 强制重载会增加 iframe load 数，从而放大自动脚本的执行机会。

### 已确认根因

- `ERA.commit()` 不携带来源楼层，Service 固定选择 latest；
- DOM 重建与业务 effect 没有分层；
- ERA 的 internal-message-write 识别只防 Service 同步重入，不能识别跨 iframe 的同一
  业务 effect；
- payload 相同不能用于去重，因为两次明确用户操作可能完全相同。

### 验收条件

- 由 ERA 在状态栏 iframe 内注入 context-bound facade，使 `ERA.get()`/`ERA.commit()` 自动使用
  所在楼身份；状态栏外仍保持现有 latest 语义；
- 默认最近 3 楼采用有界按需历史解析，范围外只有用户指定或声明式强制时才激活；
- 一次用户意图在 iframe 重建后不重放，两次用户意图仍结算两次；
- 历史楼写入目标、消息历史、Sidecar、日志和后续楼重算一致；
- 不以强制重载或测试加载预算作为产品修复。

## 5. ERA-PROD-007：空聊天 Sidecar 残留

### 用户操作与实际表现

真实删除链已到达 `afterMessageCount=0`，但 Sidecar 仍保留完整 `era_demo`。这里确认的是
ERA 可到达的零消息终态，不扩大解释为所有 SillyTavern 版本都允许直接删除固定开场白。

### 已确认根因

同步领域在 `messages.length===0` 时显式返回 no-op，并克隆旧 stat/statFunc/meta；因此
旧状态不会被结算为空。

### 验收条件

零消息、reload、full sync 和重新进入聊天后，Sidecar、stat、statFunc、SelectedMks、
EditLog 和 FunctionEditLog 同时为空，并生成可审计的 committed terminal receipt。

## 6. 强制重载的结论

强制重载不是修复。它只是稍后重建最近 N 楼，使纯读 iframe 偶尔赶上已发布状态；同时
它也会重跑 load 脚本，放大 `ERA-PROD-006`。后续重构必须删除该运行能力和消息数设置，
旧配置只作兼容读取后移除或忽略，不得改名继续承担定向重绘职责。

## 7. 统一调查结果

独立 run `st-run-20260903T07250307-633d4b6a2209` 固定 1 worker：

- 12/12 selected/recorded，171 actions，全部路径终态；
- required evaluations 12/12 有结果；
- 8 passed，4 个严格产品 finding；
- Artifact audit `consistent/complete`；
- 无测试执行或基础设施异常。

四个失败是 `STATUSBAR-EXAMPLE-037`、`025`、`034` 和 `UI-DEL-007`，分别对应
P005 首帧、多楼、旧聊天与 P007 空终态。P006 的错误路由由通过的 lifecycle 路径
`STATUSBAR-EXAMPLE-023` 中的真实 receipt 直接证明；“passed”只表示该路径原合同完成，
不表示新的作者体验合同已经满足。

## 8. 不属于当前开放缺陷

Swipe 停止生成、非法消息 ID、320px 溢出、多阶段技术块投影计数、关闭悬浮球、点号键、
PNG/WAV 等旧问题已修复或排除，见历史台账。综合层中曾出现但 detail diagnose 证明为
Pack 累计 oracle、共享状态或证据重绑定错误的失败，也不能登记为 ERA 产品缺陷。

修复完成后，只有独立产品测试、对应 detail、integrated owner 与 Artifact audit 全部闭环，
才能把条目从本文移入历史台账；不得用 xfail、inconclusive、改变公开语义或拼接 Artifact
获得“已修复”。
