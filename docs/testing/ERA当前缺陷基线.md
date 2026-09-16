# ERA 当前缺陷基线

## 2026-09-13 内存生命周期实施中的新增问题（尚未完成验收）

以下为新生命周期版本的当前证据，不改变后文历史问题各自的验收范围。

| 问题 | 模拟操作与错误表现 | 当前处置与证据边界 |
| --- | --- | --- |
| 重新生成的规划楼层为空 | 重新生成时旧AI楼层已撤除，prepare_stage_blocks读取空identity.mk，导致服务停止，后续模型请求失配 | 新源码改为存在实际身份才复用楼层，否则创建未来楼层；生产节点两项先失败，修复后阶段相关46项通过。Service16/app13真机ORCH010通过（st-run-20260913T13321446-a40d951f8782），当前全量待验收 |
| 报告展开状态丢失 | 刷新后点击规划报告已展开，随后宿主重绘将报告折叠，无法继续点击提示词页签 | 真实截图有展开后折叠；DOM回归先失败后通过，页面内按消息对象/MK保存展开状态。FORMAT012旧版本独立复验通过，不能排除综合时捕获的重绘问题；新源码FORMAT012同run通过，综合重绘路径仍需新全量覆盖 |
| 重开聊天后的结算采集失败 | STORE003点击重新结算后metadata采集返回Promise被GC | 原全量有采集错误，没有已确认的同时间ERA异常；独立255动作复验进行中，不据此认定变量处理已坏或已修复 |
| 手动重新结算残留旧操作 | 空结算仍保留上一轮settled变量和事务 | 从保留规划/正文重建候选，清除旧stageMemory；st-run-20260913T12500613-15588259321b的ORCH013和RPG均通过。模型请求前是否使用正确回退状态仍需核对 |

全量02为st-run-20260913T09591510-bb233c1a6a5f，413/422完整通过。取消规划与正文操作的新语义已按明确需求迁移测试：同时检查即时commit读回及取消后草稿丢弃；四模式各发送一次原操作序列，保留受保护写入的中间日志拒绝断言。当前7条复验中HOOK003/005、ORCH008、PARITY085已通过，不能拼接为新版本全量通过。

整体仍需关闭阶段JSON预校验顺序、普通导航/保存恢复、函数sync边界和当前分发物完整综合/细则验收；详情见[实施记录](../../reports/era-memory-lifecycle-review-20260913/执行备忘录.md)。


2026-09-10 后续验收：12 并发完整综合业务判定 413/413 passed；一条路径出现 Harness DOM 采集截断。采集器在独立仓库修复后，该路径单独复测 88/88 动作执行及捕获完整、业务通过。保留全量原始 partial 状态，不拼接为新全量通过；运行编号及范围见[变更清单](../../reports/era-four-ui-regression-change-list.md)。

2026-09-10 四项综合定向修复：旧初始化实例在stop后继续启动的问题已修复；三个UI组合补独立聊天，最终异步观察等待已接纳请求结算且不改业务oracle。独立run `st-run-20260909T23564786-8065bddea97b` 为4/4passed、281actions全部completed/complete、audit consistent/complete。详见[变更清单](../../reports/era-four-ui-regression-change-list.md)。这是四项定向结果，不代表最终同版本完整两层通过。


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

### 2026-09-09 全面审计：ERA-PROD-011（已获批修复，定向通过，范围验收中）

范围进展：独立编排专项`st-run-20260909T07325860-a9e305c2ffe9`为25/25，报告专项`st-run-20260909T07403725-44fad414fa60`为20/20，四RPG`st-run-20260909T07515879-a312d4229308`为4/4，分别passed、consistent/complete。均是当时12064749bytes bundle的独立证据，不是当前最终两层全量结果；下文“尚待编排专项”属于先前时间点。

快速初始化角色卡的正文结束后，首次变量解析可能缺少世界书变量操作规则，网络重试却恢复。
实际世界书激活与发送间被原生generation_ended清空深度注入，确认共享提示容器的生命周期重叠。
原独立025及只读探针严格失败；获批修复后新run `st-run-20260909T07272773-f7e99c1bf055` 的025为1/1passed、22动作、consistent/complete，真实首次辅助请求含世界书，两组网络重试messages分别相同。未删规则或放宽oracle；编排专项及最终全量尚待，暂不移入全面验收完成台账。
时序、源码及验收条件见 [辅助解析世界书注入竞态](ERA辅助解析世界书注入竞态.md)。

### 2026-09-08 全面审计：ERA-PROD-010（获批修复已实施，全量验收中）

23:35补充：本轮新bundle导航owner `st-run-20260909T15334784-efc7dbf4370a` 已1/1passed、38动作、required通过、consistent/complete；下文“导航综合定向验证中”已完成。仍未完成最终同版本完整两层。

2026-09-09 连续Swipe关联修正已获新审核批准：保存原候选与核对当前来源分离，复用sourceBasis；B落盘后切到C不再误判保存失败，也不发布B旧状态。App verify457/457及确定性交错合同通过。新bundle12239966bytes的原始Overswipe `st-run-20260909T15285693-1565914cb76b` 独立1/1passed、22actions，UI-NAV-001 `st-run-20260909T15320580-0cc2cb3e5d09` 独立1/1passed、12actions，均consistent/complete。导航综合定向验证中；最终同版本两层全量尚未完成，不据局部成功关闭整个010。审核与修复记录见 [候选保存/来源分离](../../reports/era-swipe-persistence-separation-change-list.md)。

2026-09-09获批后已实现固定目标聊天保存与实际读回，Host只在原消息字段确认后报告已持久化；失败保留内存已写事实，不误发布Sidecar成功。原导航owner `st-run-20260909T10314001-6f29aa60ec05`独立1/1passed、38动作、consistent/complete，未插入手工flush。保存HTTP/网络故障 `st-run-20260909T11092759-d60c1e31a64c` 独立2/2passed、24动作、consistent/complete，公共Facade拒绝Promise、磁盘不含失败操作且revision不推进。尚需原生保存中导航边界及最终完整两层验收，不把局部通过写成全面关闭。

用户在新回复已完成ERA处理后立即切聊天或reload，返回后同一消息应保持MK、SelectedMks及日志身份。
实际导航综合路径可出现末楼MK重新分配，旧日志key保留并增加新key，虽然变量终值看起来正确。

已确认的切聊天证据：run `st-run-20260908T13203758-c9b36107f4c3`，owner
`INT-HOST-02-G863ECC07`的`runtime-coalesce-chat-switch-001--read-chat-return-persistence`：
1788873668770ms保存末楼时正文无MK；8780ms ERA才调用setChatMessages写入
`era_mk_1788873668658_e1i5pm7e`；返回原聊天的get响应（1788873670219ms）末楼仍无MK；
随后ERA写入新MK `era_mk_1788873670349_k1osb29o`。原消息/Sidecar前后capture和严格binding失败相互印证。

根因边界：ERA等待Helper的setChatMessages(refresh:none)，但该接口只登记1000ms debounce保存，
并不等待聊天实际落盘。同步/Sidecar完成不能证明消息正文持久化完成；切走前的新MK可能没有进入原聊天文件。
此证据不等同于009跨Swipe目标丢失，也不证明每个reload失败均已完成归因。

验收要求：消息真实持久化完成后再报告对应提交完成；快速切聊/reload后原消息MK、SelectedMks及变量/函数
日志一致；不依赖测试sleep、主动测试flush、重建iframe或强制重载。产品修复已获批实施，上述历史失败用于对照，不代表当前仍未修复。
详细时间线和源码入口见
[导航恢复逐项审计](</home/example/projects/酒馆开发目录/测试工具链/ERA-Test-Pack/docs/test-runs/2026-09-08-era-full-audit/导航恢复逐项审计.md>)。

### 2026-09-08 全面审计：ERA-PROD-009（获批修复已实施，关联验收中）

最新扩大验证：`st-run-20260909T09343166-a78138a01bb3`，era-runtime-all，27/27passed、422actions、27required通过、consistent/complete，bundle12235735bytes。下述Overswipe完整历史修复已在此专项通过；最终842/413两层尚未运行，不将局部结果扩写为全量修复完成。

2026-09-09后续独立审批已实施完整历史读取修复：`st-run-20260909T09314359-2a7db5898ea8` 单项1/1passed、22actions、consistent/complete。生成前revision8/messageId1、发送前实际prompt为`previous_floor`，不再重复退到楼0；新候选完成后revision9/messageId2。原009与历史读取根因分别修正，当前27项runtime扩大验证中，尚未完成最终两层全量。实现及审核见`reports/era-overswipe-history-range-change-list.md`；下述旧“须审核”描述为当时调查阶段。

2026-09-09获批后已让原始聊天/消息/Swipe依据贯穿提交链，并在实际写入/发布处核对。新独立run `st-run-20260909T08454059-93013d7c0d41` 中只观察到C→C、D→D，生成前后状态正确；原跨候选症状未再出现。同bundle运行时专项 `st-run-20260909T08500120-7be7aee2ee7a` 为27 recorded、422actions、26passed/1failed、consistent/complete，唯一失败仍是下述独立prompt空值。尚未完成最终两层全量，不能把包含失败的整项移入全通过台账。

残留prompt空值现已独立归因：`st-run-20260909T09035641-4ffcb277b63d` 的被动生成监听在generation_started结束后就读到revision8、messageId0、SelectedMks只有首楼，缺少楼1的previous_floor；发送前同值，最终Lab为空。ST macros.js:getLastMessageId默认跳过swipe_id超出swipes长度的待生成楼；Helper getChatMessages会展开此宏；ERA read_context用0-{{lastMessageId}}先少读一楼，previous-of-latest再减一，合计回退两楼。实际安装ST与参考版本原函数受控执行均得到macroLast1/actualLast2/ERA目标0。此为独立的历史读取/生成目标合同问题，非009跨候选写回根因；须另行planned审核，不将其冒称为宏格式化缺陷或用延迟修复。

用户连续从同一AI消息的候选A切到B、再切到C，ERA应分别处理对应候选，不能把B正文覆盖到C。
实际真实UI测试中，创建后的A/B/C正文均正确，但两次原生点击后C变成B。

调用级证据：`st-run-20260908T12420901-df6eb569bd78`的
`RUNTIME-COMBO-OVERSWIPE-001/read-swipe-writes`，time=1788871375969：
messageId2、当前swipeId2、activeText为C，实际请求写入带ERA MK的B正文。
该run独立1/1 recorded、22actions、required结果完整、audit consistent/complete，严格失败保留。

确认根因边界：普通同步提交将计划更新压缩为messageId/content，`commit_sync`发送
message_id/message，未固定目标Swipe；Helper按调用时当前swipe_id写入。因此B的迟到写回可覆盖C。
现有Agent候选身份核对不能覆盖这条普通同步路径。修复必须保留用户连续切换能力、稳定MK和原子提交，
不得仅用加长测试点击延迟遮蔽，也不能未经审核修改产品。

同一路径的生成prompt变量为空另行追踪，尚不宣称与009完全同根。
验收：连续切换后全部候选正文保留、当前状态对应C，跨候选写入不会发生；原生Overswipe新增D及相关
同步/Sidecar/状态栏用例独立通过。调查详情见
[Overswipe候选与提示词调查](</home/example/projects/酒馆开发目录/测试工具链/ERA-Test-Pack/docs/test-runs/2026-09-08-era-full-audit/Overswipe候选与提示词调查.md>)。

### 2026-09-08 全面审计：ERA-PROD-008（已修复并定向验收）

用户在“历史快照”中选择旧楼，再点击“函数库”，应看到该楼的函数参数和表达式。
修复前页签高亮切换正确，但内容区显示的是该楼的完整变量（含`$meta`），不是函数库。
这是展示路由错误，不是历史函数计算丢失：真实最新库仍为`g(x)=f(x)*4`，首楼历史目标为
`g(x)=f(x)*2`；切换页签没有改变消息、Sidecar、revision或函数库。

独立证据：`st-run-20260908T08190877-2d5f03ee8a9d`，`ERA-UI-MANAGE-026`，
`observe-workbench-history-variables`正确显示首楼变量hp=10；`observe-result`的
`snapshotPanel.activeTab="函数库"`，但`primitiveRows`仍是变量且不包含目标expr。
该run为28/28 recorded、27 passed/1 failed、449 actions、Artifact consistent/complete。
详细证据见
[工作台逐项审计](</home/example/projects/酒馆开发目录/测试工具链/ERA-Test-Pack/docs/test-runs/2026-09-08-era-full-audit/工作台逐项审计.md>)。

确认根因：`app/src/ERA变量框架/ui/template/TabSwitch.vue`只区分`pure`和`else`，
所有非pure选择都渲染`full`插槽；`SnapshotManager.vue`已提供`functions`插槽却不可达。
旧Pack只检查“函数库”文字，因此漏报。新的严格测试保留失败，不改为xfail/inconclusive。

修复方向为共用页签按当前key选择对应插槽，保留原有pure/full行为；不碰Service、消息、
Sidecar或宿主。用户于2026-09-08明确批准，本项已实施：共用组件按key选择同名插槽，
没有增加函数页签特判。App 53文件/392测试、verify/build/integration及Service适用检查通过。
新bundle上的单条复测`st-run-20260908T09023713-cc85a770a26a`为1/1 passed、
18 actions、required evaluation passed、Artifact consistent/complete。
关联综合`INT-UI-13-GFE02E703`在`st-run-20260908T09053266-a6622bad1960`记录1/1、76actions，
因MANAGE-023/025的g值及试运行断言失败，历史函数026未失败。反向诊断
`st-run-20260908T09074432-f728f36f630e`的021..027七条独立路径全部通过（112actions），
两个run均Artifact consistent/complete。综合共享周期存在前序函数修改污染，属于Pack组合问题，
不是历史函数修复失败。Pack随后隔离删除/批量修改及固定楼号历史周期，保留其他四项共享。
最终独立run `st-run-20260908T09163307-72f75673c3d3`，四条关联综合执行路径全部通过，
94actions、4 required evaluations passed、路径均completed、Artifact consistent/complete。
026对应owner为`INT-UI-13-G662C28AE`，执行原真实detail；其他四项共享owner为
`INT-UI-13-GB1C1E459`。本缺陷定向验收结案，不代表整个全面审计或最终全量已完成。
验收要求：真实旧楼变量与函数分别正确、最新函数仍独立正确、切页不写业务状态；
单条与对应综合owner独立通过后再结案。

| ID | 根因域 | 用户表现/能力缺口 | 优先级 |
| --- | --- | --- | --- |
| `ERA-PROD-005` | 楼层身份、按需历史解析与首帧就绪分裂 | 快速初始化首帧为空；新聊天多楼错位；旧聊天 reload/重启恢复错误 | P0 |
| `ERA-PROD-006` | 状态栏写入缺少来源楼层与 effect 身份 | 历史楼操作写到最新楼；iframe 重建后自动脚本重复写入 | P0 |
| `ERA-PROD-007` | 空消息历史被实现为保留旧状态的 no-op | 消息删至零条后 Sidecar 仍保留已删除首楼产生的状态 | P1 |

## 3. ERA-PROD-005：状态栏读取与恢复

### 2026-09 全面审计的当前边界

2026-09-09获批修复已加入默认模板代码围栏行边界与共用首次呈现意图：原生回复的消息/Sidecar提交和快照发布完成后才执行一次首次显示，不对普通API或后续revision重绘。`st-run-20260909T10291234-deda3c1777f1`的028独立1/1passed、18动作、consistent/complete；原Regenerate后无需编辑即显示楼4 HP18。扩大114专项`st-run-20260909T10333944-ad1397a07cfc`为111passed/3failed，四种RPG均通过。失败017取证过早已修并独立通过；两条外置reload/restart实际来自测试卡名称/文件名不一致导致Helper保存另一文件，修正普通fixture后`st-run-20260909T11313344-4980192d9816`为2/2passed、47动作、consistent/complete。名称不一致的真实卡仍存在上游兼容风险，见Pack本轮《角色脚本设置保存目标调查》。最终全量尚未结算，不据这些定向证据关闭整个005根因域。

本节下方2026-09-03的旧表现和根因是历史调查，不应理解为当前代码仍完全未实现按楼Facade。当前已有有限投影、按楼身份及原生作者HTML挂载；尚开放的真实显示失败至少分为两类：

- 相邻占位符：`st-run-20260908T22202515-48f5894b0502`中，原Swipe与原文不变保存均无目标iframe；仅插入换行后形成iframe。当前resource_planner的替换串直接以代码围栏开头，未保证行边界。详见Pack本轮`状态栏Swipe渲染边界调查.md`，不以换行对照冒充原测试通过。
- 原生Regenerate呈现：`st-run-20260909T02593394-fa6973a7c911`中原文已有合法换行，重生成后楼4无iframe，原文字节/MK不变编辑保存后恢复HP18。这不是已证实的相邻围栏问题。当前`present_finalized_floor`仅处理Agent候选，是源码候选根因，仍需对照当前bundle执行证据，不提前写成唯一原因。详见Pack`状态栏历史操作前提与数值审计.md`。

010消息未落盘造成旧聊天MK变化另行记录，不能将所有缺iframe都归因于显示或全部归因于保存。

### 用户应当看到

- `{{ERA:path}}` 与 `{{ERA-withmeta:path}}` 在状态栏第一次可见时就显示该状态栏所在
  AI 楼的快照；
- `ERA.get()` 在普通脚本和 ERA UI 中继续显示当前活动分支最新状态；在 ERA 状态栏中则
  自动显示该状态栏所在楼的变量、函数、MK 和 revision，不要求作者传 messageId；
- `ERA.subscribe()` 在普通脚本中保持当前活动分支最新状态语义，在状态栏局部 facade 中订阅
  该楼投影，以便 API 写入后不重建 iframe 即可实时更新；
- reload、切聊天/角色、真实重启、Swipe 和历史编辑后语义不变。

### 2026-09-03历史实际表现（不代表当前未实现按楼运行时）

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

此段为早期可行性调查。当前已实现按楼运行时与原生作者HTML挂载，具体尚待验收边界以上方本轮证据为准；不继续将旧“尚未实现”作为当前根因结论。

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

### 2026-09-08 修复与当前验收边界

Facade空同步拒绝已修复，独立run `st-run-20260908T06094079-12a3c8a8090d`
中SINGLE-FLOOR-005及API-SYNC-001..005共6/6 passed、95 actions、Artifact
consistent/complete。删除所有消息后的真实ERA.sync返回ready，revision=11，
statData/statFunc/EditLogs/FunctionEditLogs为空、SelectedMks=[]、mk/message_id=null；
随后仅新增用户消息仍无旧变量残留。

修复的是准备阶段及V2/V3内部上下文结构校验对api/state-sync的误拒绝，复用已有空历史
提交事务；空历史message-write/update-mk仍拒绝。App391/391通过。
本次未另外执行零消息reload/重新进入聊天矩阵；不能把本次定向证据扩展为所有历史验收
场景均已重测。已修复分支详见[历史台账](ERA产品问题台账.md)。以下为修复前诊断。

### 2026-09-08 复现：Facade 同步入口仍拒绝空历史

单层专项 `SINGLE-FLOOR-005` 在独立 run `st-run-20260908T03294968-5ce879a8e7a2`
中通过 Helper 数据 API 删除全部七条消息后，显式调用 `ERA.sync({mode:"full"})`。
`sync-empty` action 的真实 Facade 结果为 rejected：
`ERA_SYNC_READ_FAILED: 当前聊天没有可准备的消息。` 可见消息和 iframe 已为零，但
旧 `era_demo` 与七个 SelectedMks 仍在。不是通过延长等待可以解决的读取竞争。

当前源码已存在空历史同步提交分支；本次准确根因不是该分支仍返回 no-op，而是更早的
`dispatch_preparation.ts` 只允许 `dispatchClass="sync"` 的空历史进入，
`ERA.sync` 被 `event_planner.ts` 先分类为 `kind="api", intent="state-sync"`，
`facade_api_engine.ts` 转交同步时仍携带已失败的 dispatchContext。
此处应区分“同步空状态”与必须有目标消息的“写 API”，不能笼统放开所有 API 空上下文。
这些逻辑在单层模式修改前已存在；本次经独立planned审核批准后完成上述Service修复。

完整动作证据位于上述 Artifact 的 `paths/SINGLE-FLOOR-005/actions.jsonl`；本 run
17/17 recorded、528 actions、Artifact consistent/complete，但不是全部通过。

### 用户操作与实际表现

真实删除链已到达 `afterMessageCount=0`，但 Sidecar 仍保留完整 `era_demo`。这里确认的是
ERA 可到达的零消息终态，不扩大解释为所有 SillyTavern 版本都允许直接删除固定开场白。

### 已确认根因

早期调查版本在 `messages.length===0` 时返回 no-op并保留旧状态。当前版本已有空状态
提交，该分支不再是本次根因；2026-09-08的复现来自更早的Facade派发拒绝，见上文。

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


### 2026-09-14 全量03报告请求选择失败归因
全量03为417/422完整通过，剩余5条均由测试打开动作把已展开报告反向折叠造成。五条原始DOM证据均为open属性从存在变为缺失；请求记录在点击前可见。Pack已将两处重新打开动作改为读取真实open状态，仅关闭时点击summary，原业务断言和场景不变；263合同测试通过，五条原场景独立真机复验进行中。产品的宿主重绘保留展开状态修复保持。详见[根因与修复](../../reports/era-memory-lifecycle-review-20260913/报告选择框失败根因与修复.md)。

报告定向01 st-run-20260913T16321373-0d95eae0e7dc：普通/外置RPG两条完整通过；INTMULTI08推进到FORMAT022，两条单层RPG推进到最终旧报告查看，仍有同类重复toggle，已按before/after DOM证据修正后续打开动作。原变量/请求/提示词断言均保留；下一批五条整体复验待完成。
