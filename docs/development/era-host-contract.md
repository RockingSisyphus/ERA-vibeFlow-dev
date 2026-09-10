# ERA 宿主、Service、宏与 UI 合同

## 分层与唯一职责

```text
Tavern Helper / SillyTavern / ERA UI
  → app/src/ERA变量框架/service（受限 Host 投影）
  → javascript_project/service（异步业务规划、同步、回滚、提交）
  → 已提交 ERA snapshot
  → javascript_project/macro（同步替换计算）
  → registerMacroLike / ERA UI 观察结果
```

| 层                    | 可以做什么                                       | 不可以做什么                             |
| --------------------- | ------------------------------------------------ | ---------------------------------------- |
| Tavern adapter / Host | 监听、FIFO、receipt、Capability 副作用、资源清理 | 第二套 planner、按场景直接决定回滚       |
| VibeFlow Service      | 事件组合、任务规划、回滚/同步、业务状态提交      | DOM、`window`、直接 Tavern Helper 调用   |
| VibeFlow Macro        | 基于已提交快照同步计算替换文本                   | Promise、写入、Service 调用、状态同步    |
| UI                    | 展示、收集用户意图、显示结算后的状态             | 直接重建/写入 ERA 业务状态、复制同步逻辑 |

Sidecar 的身份检查、旧聊天迁移、冲突决策和迁移/独立/复制事务属于 Service 的
`era.sidecar.store` Nodeset。聊天变量只保存 `ERAMetaData.SidecarId`；ERA 状态只保存在
Sidecar V3 用户文件中。Tavern adapter/Host 只提供当前身份、聊天指针、原生 files、受限内存
快照与 UI 通知这几项技术能力；它不能自行决定 owner、迁移或变量恢复。宏只能读取身份匹配的
内存快照，快照缺失时必须为空，不能回退读取聊天变量。

## 启动期间停止

Host 在发布 runtime 后、等待 APP_READY 初始化回执前登记 pagehide。stop/pagehide 若在该等待期间发生，旧启动续体只等待原 stop 结算并返回停止实例，不再刷新设置、挂载宏/UI或重绑监听。主动停止不是启动失败；其余真实启动异常仍走原错误报告。新实例可在旧初始化续体返回前启动，旧续体不得影响新实例资源。

## 消息持久化完成边界

消息Capability先通过Helper更新指定正文，随后请求酒馆公开saveChat，并使用原生聊天读取接口
读回写入前固定的角色/聊天文件。比较本次原Swipe槽的正文/MK及ERA自有extra；原槽已不活动时读取该槽swipe_info.extra，而不是新候选的extra。
保存确认不要求用户仍选着原候选。读回后另用既有sourceBasis核对来源，将自身写入后的正文纳入依据：
原B已保存但当前已选C时保留真实确认计数，以sourceChanged结算，不向C发布B状态，也不误弹保存失败repair。
不另建聊天保存器、不复制未知字段、不增加保存队列或导航锁。Helper内存更新及saveChat
Promise返回都不单独表示已落盘，因为上游会吞保存错误。

Host返回内存已写、目标持久化是否确认及来源是否变化的事实；Service决定失败、repair及
Sidecar提交。未确认落盘不得发布成功快照；切聊后不向新聊天展示旧任务repair。
真实交错与失败注入结果以独立Artifact为准，不能用离线合同声称全部导航分支正确。

普通生成和Agent共用临时首次呈现意图。只有本次生成完成后的最终显示内容变化需要一次
affected render；单独补MK、API写入、历史回放和普通revision不因此重建iframe。
最终消息、Sidecar与来源确认后才呈现，呈现失败不回滚已经提交的业务状态。

## 生成 barrier

生成开始前，Host 必须等待对应 high-water sequence 之前全部被接受事件的 receipt 进入终态；随后宏
才可读取当前 committed snapshot。正常业务失败可以形成可定位的失败 receipt，不能把证据缺失或超时
伪装为已完成。详细的顺序与取消规则以
[`ERA事件调度与生成栅栏设计.md`](../../app/开发文档/ERA事件调度与生成栅栏设计.md) 为准。

重新生成、swipe、编辑等场景的组合与回退目标属于 Service planner。修复此类问题应先补覆盖真实
事件序列的回归测试，再修改领域 planner；不在 macro、UI 或 adapter 增加延迟/重试型补丁。

## 托管状态栏生命周期

### 原生正文与辅助解析的收尾边界

`message_received` 只证明正文消息已到达，不证明酒馆共享世界书注入已清理。唯一
AgentGenerationSession在该来源的变量解析前调用内部`await_native_completion`；Host
按当前聊天与execution.id记录原生开始、结束及取消，只返回机械事实与等待后的当前上下文。
Service核对执行、消息及Swipe/正文仍对应本任务后，才启动原有辅助请求链。

原生结束监听不等待Service receipt，也不在同步事件回调里启动辅助装配；Promise续体在
宿主同步清理栈返回后继续。Helper独立生成的结束不能释放原生等待；生成外创建消息、
手动重新解析和Helper手动正文沿用各自完成事实，不等待不存在的原生周期。
停止、切聊天和卸载主动释放等待，不新增超时猜测、补偿重试或世界书副本。

快速初始化生成的 V2 状态栏由 Host 生命周期管理。每次 iframe 挂载时，Host 必须以 Helper
报告的 messageId、iframe 名称、父消息 DOM、当前 Swipe、消息 MK、`SelectedMks` 和
Sidecar 身份共同求证楼层；任何一项暂时未就绪时保持 loading，不得回退到最新楼状态。

托管状态栏由 Tavern Helper 原生渲染；ERA 同步安装 pending 楼层 Facade，等待 DOM、
身份和快照后，只解析自有宏绑定并解除 `data-era-statusbar-root` 的 hidden/inert。
作者依赖数据的脚本使用 `await ERA.ready()`，ERA 不复制模板、清空 body、移动 CSS
或重放脚本。规划与结算报告只对显示副本缩进和展开已知 response JSON，原消息保持不变。历史快照由
`era.snapshot.query` 按日志计算，不持久化逐楼完整状态。默认只激活最近 3 个含托管状态栏的
AI 楼层和一个通过原地占位栏按钮临时展开的楼层；范围外使用 placeholder、empty 或 hidden 合同。

iframe 内安装的局部 Facade 使 `ERA.get/ready/subscribe/commit` 自动采用所在楼语义，顶层
Facade 保持活动分支 latest 语义。状态栏 commit 的来源 messageId/MK/Swipe 由 Host 附加并由
Service 再核对，作者不能通过公开 options 伪造。Sidecar 更新后只向现有 iframe 推送新投影，
不得通过刷新消息或重建 iframe 更新状态栏。

挂载去重以当前 Document 为生命周期单位，而非可跨导航保留的 WindowProxy；iframe reload
必须同步重装 pending Facade。技术投影的显示失效只比较可见正文和报告，隐藏的 API 事务
追加不会使下一次 DOM mutation 重建消息。末个可见正文与隐藏 MK/事务之间新增的行尾换行
只作技术分隔，不参与显示失效；正文内部换行、Markdown 空格和报告内容仍参与比较。
报告可读性由独立纯格式器负责，不改变审计原文。

阶段查看器的执行记录属于页面 Host：按真实请求 ID 和聊天身份关联阶段输入与发送前消息，
忽略 native dry-run；缺少发送前事件时明确显示未采集，不用其他请求填补。完整提示词不进入
消息、角色卡或 Sidecar，reload 后释放；消息仍保存既有响应、诊断和函数结果。媒体显示副本
只保留结构与文本，二进制用占位符表示，不能反向修改真实模型请求。手动重生成共享 busy 状态，
保持禁用直到真实 receipt 结算；当前页面的旧执行记录只读，不恢复旧候选。

请求记录关联使用 Service 明确传入的 executionId、trigger、attemptIndex、intent 和
previousRequestId，不解析 ID 字符串或报告正文猜测来源。查看器以单一请求列表展示首次请求、
错误修正和无回复的请求重试；显式选择旧请求时，后续报告更新/重挂不强行切走。主动点击
重新生成才切向该新执行。选择本身与旧执行历史均限当前页面、聊天和楼层，不参与业务结算。

纠错正文由唯一 AgentGenerationSession 构造：只有模型输出校验失败才更新待修正回复的完整实际文本、
真实诊断与完整修正要求。请求/连接错误只进入报告，不进入提示词，也不覆盖已有纠错上下文；
同一 profile 下网络失败后再次发送的模型输入保持不变。校验通过后的 Host 错误不归因于模型。
实际上一请求记录与待修正答案分别维护，手动重新生成重置纠错上下文。
Host 只机械发送和采集，不截短纠错输入，也不根据显示报告重建请求。

捕获预设将阶段 user_input 放在连续尾部 assistant 提示之前。发送前仅将已捕获的普通 RolePrompt
按原顺序委托 Helper substitudeMacros 展开，PlaceholderPrompt 仍由 Helper/酒馆处理；不引入
第二套宏或预设解释器。采集的发送前消息才是实际请求证据，预设名称或捕获摘要不能替代它。

作者用法见 [ERA 托管状态栏作者指南](ERA%E6%89%98%E7%AE%A1%E7%8A%B6%E6%80%81%E6%A0%8F%E4%BD%9C%E8%80%85%E6%8C%87%E5%8D%97.md)。

## 单层显示窗口

角色卡扩展 `era_single_floor` 的开关由 Service 设置事务保存；Host 的单层控制器只拥有
聊天显示窗口，不修改消息数组、MK、Swipe 或 Sidecar。它在 Helper 显示审计之前选择最后
一个 AI 消息，移除其它消息 DOM。用户消息到达时保留原 AI iframe，不重新运行作者脚本。
Helper 公共渲染深度控件和 `MORE_MESSAGES_LOADED` 显示通知集中在薄适配层；不调用
Helper 私有运行实例修改接口。关闭模式恢复酒馆原生窗口，不展开全部历史。

隐藏楼层仍可由消息数据 API 和 ERA 历史查询访问；显示型 API 不能访问已卸载 DOM。
显示切换本身不得提交业务任务或推进 revision。旧楼脚本停止、表单丢失和恢复后脚本重跑
是显式合同，不建立后台保活或第二份界面快照。具体设置与证据见
[ERA 单层模式](ERA单层模式.md)。

## 公共 ABI

以下内容的变更须单独审查、更新文档并有合同测试：

- `ERA.get/subscribe/commit/sync/history` 公共对象及 receipt；
- `message`、`branch`、`always` scope 与消息中的 `<era_tx s="...">`；
- `{{ERA:...}}`、`{{ERA-withmeta:...}}` 的宏语法和缺失值语义；
- 持久化的 `ERAMetaData`、MK、EditLogs 或设置结构；
- receipt 结算、写入确认、通知的可观察顺序；
- UI 公开操作及其成功/失败结果。

## 验证选择

代码/工作流改动先跑相应的 VibeFlow validate、quality、build 与 app 合同测试；需要证实浏览器行为时，
再运行 ERA-Test-Pack 或经授权的真实酒馆联调。结构检查通过不等于 ERA 产品行为通过，两者必须分开报告。
# Overswipe 完整拓扑读取（2026-09-09，已批准实现，真实验证中）

完整消息上下文通过Helper公开`0--1`读取真实消息位置，不用会排除pending Swipe的`lastMessageId`宏确定列表长度。待生成末端Swipe保留真实messageId/swipeId并明确空正文，不读取前一个候选的正文作替身。该投影与提交来源核对共用；Service继续决定生成前回退目标，只回退一次且不提前补写被排除楼层。Agent最近64条提示词历史仍采用排除未生成候选的范围；显式latestMessage读取保持`-1`。详见`reports/era-overswipe-history-range-change-list.md`及保留的expanded审核图；真实验收状态以新独立Artifact为准。
