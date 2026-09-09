# 初始化世界书在首次辅助解析中丢失

## 2026-09-09 获批修复的定向证据

独立run `st-run-20260909T07272773-f7e99c1bf055`（bundle12064749bytes）中，AGENT-ORCH-025的22动作全部completed，required passed，Artifact consistent/complete。原生结束事件07:28:15.680Z，辅助装配15.691Z，首次辅助prompt15.760Z；辅助请求2..5均保留11条消息和变量规则。Lab完整messages的2/3、4/5分别相同，证明两种网络重试均保留原输入。

实现由Service在原生message_received结算前等待绑定execution.id的完成事实；Host记录原生生命周期，不把Helper独立结束混入。结束后重新核对聊天、执行与当前楼层，再进入原辅助请求链。未增加固定延迟、自动补偿请求或复制世界书。当前只完成这一独立定向，编排专项与最终全量尚待；不能据此关闭所有相关验收项。

实际请求来源为本run路径actions.jsonl的generate-story/providerExchange，不是未保存请求正文的network.jsonl。原失败Artifact保持原样。

## 已确认的用户表现

在快速初始化的角色卡里关闭规划、开启变量解析，正文完成后首次辅助解析请求可能
缺少初始化世界书的变量操作规则；若首次请求发生网络错误，重试却会加入规则。
这违背“网络重试保持原提示，只有模型输出错误才加入纠错”的现有合同。
最终变量正确不能证明首次提示正确；固定回复模拟服务也不能证明真实模型不受影响。

## 独立运行证据

Pack `AGENT-ORCH-025` 初始化真实三楼变量/函数历史，依次执行正文、解析HTTP503、
错误操作、解析HTTP503、正确操作。保持同一公开输入和严格完整messages比较。

- 首次：`st-run-20260908T19283082-2fe1a380a38a`，该项失败，其余四项通过。
- 独立：`st-run-20260908T19323726-75fab00881ce`，1条22actions，同一失败。
- 被动事件探针：`st-run-20260908T19401761-0ca108c1364c`，1条22actions，同一失败。

三份Artifact各自terminal、required结果完整、consistent/complete，不拼接为通过。
根目录在测试工具链 `本地运行资料/live/artifacts-v4`；探针证据为
`paths/AGENT-ORCH-025/actions.jsonl` 的 `observe-agent.result.worldInfoTimeline`，
请求为 `generate-story.providerExchange.exchanges`。

## 探针时间线（Unix毫秒）

| 时刻 | 原生事件/实际请求 | 变量规则 |
| --- | --- | --- |
| 1788896461749 | 正文message_received | 原生customDepthWI_0_0存在 |
| 1788896461860 | 辅助解析GENERATION_AFTER_COMMANDS | 原生深度注入仍存在 |
| 1788896461864 | world_info_activated | 本次世界书确实返回variable_rule |
| 1788896461874 | 原生generation_ended | 深度注入清空 |
| 1788896461929 | 辅助generate_after_data | 无规则、无深度注入 |
| 1788896461972 | Lab收到首次解析（HTTP503） | 无规则，10messages |
| 1788896462078 | 重试world_info_activated | 再次返回规则 |
| 1788896462115 | 重试generate_after_data | Helper customDepthWI-0-0存在 |
| 1788896462182 | Lab收到第二解析 | 有规则，11messages |

后两次含纠错请求的messages完全一致，未传入网络报错。被动探针仅记录事件及存在标志，
无等待、无请求改写，未改变ERA产品或Helper/ST文件。

## 源码与归因

- 实际ST源拷贝 `/home/example/projects/SillyTavern/public/script.js`：
  原生成功流程保存聊天后调用unblockGeneration（约5514）；后者调用flushWIInjections
  （约5644），按customDepthWI前缀删除全部注入（约5625）。此拷贝不是Git仓库，
  不虚构提交号，实际版本以该run的runtime manifest为准。
- ERA `app/src/ERA变量框架/service/agent-tavern-host.ts::generateAuxiliaryJson` 每次调用
  Helper generateRaw；变量解析可在message_received后的服务任务中先于宿主收尾开始。
- Helper参考 `src/function/generate/dataProcessor.ts`：读取worldInfo、清理旧注入、设置
  customDepthWI；`generateRaw.ts`再从共享extensionPrompts按name取深度内容。
  参考源不冒称当前运行版本；实际事件与请求独立证明本次规则曾激活、却在发送前丢失。

确认根因域：原生正文收尾与ERA辅助请求共享世界书注入容器，两个阶段生命周期重叠。
不是世界书不存在、概率未命中或网络诊断污染。不能通过删初始化世界书、剔除比较字段
或固定延迟使测试通过。

## 后续修复边界（未批准、未实施）

复用现有生成周期及事件调度，明确将正文候选接收与宿主真正结束分开；辅助解析的宿主
提示装配应在对应原生周期已完成收尾后开始，并处理结束事件已经发生的情况。
不新增第二条工作流或全局队列，不阻塞原生message_received等待自身generation_ended。
需在VibeFlow planned审核中检查正常/流式/取消/失败及手动重生成路径，明确批准后实施。
同时保留规划阶段、网络重试与自动纠错输入的既有合同。

验收须包含本例完整初始化世界书、无网络错误的首次解析规则、网络失败相同messages、
错误答案纠错、真实预设、多阶段RPG及最终两层全量；不能仅让第一个失败请求和重试
都缺规则而满足相等。
