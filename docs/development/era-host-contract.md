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

## 生成 barrier

生成开始前，Host 必须等待对应 high-water sequence 之前全部被接受事件的 receipt 进入终态；随后宏
才可读取当前 committed snapshot。正常业务失败可以形成可定位的失败 receipt，不能把证据缺失或超时
伪装为已完成。详细的顺序与取消规则以
[`ERA事件调度与生成栅栏设计.md`](../../app/开发文档/ERA事件调度与生成栅栏设计.md) 为准。

重新生成、swipe、编辑等场景的组合与回退目标属于 Service planner。修复此类问题应先补覆盖真实
事件序列的回归测试，再修改领域 planner；不在 macro、UI 或 adapter 增加延迟/重试型补丁。

## 托管状态栏生命周期

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
