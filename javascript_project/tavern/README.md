# ERA 原生酒馆辅助流程

`era-tavern`负责宿主通信、事件准入、FIFO、回执、通知、生成屏障和实例资源生命周期。领域规划、变量与历史状态权威保留在Service。当前工具链为VibeFlow 1.5.6，Workflow ABI v12。

| Config与命名入口 | 职责 | Architecture |
| --- | --- | --- |
| `configs/era.tavern.sync.jsonc`，原入口与`protocol` | 同步准入、即时操作、实际异步操作的同步前段与通信封装 | `ARCHITECTURE.sync.jsonc` |
| `configs/era.tavern.operation.jsonc`，`operation`与`protocol_operation` | 真实异步操作、回执、屏障和对应通信封装 | `ARCHITECTURE.operation.jsonc` |
| `configs/era.tavern.runtime.jsonc`，`runtime`与`protocol_runtime` | 持有当前局部脚本资源，运行Service与后台职责 | `ARCHITECTURE.runtime.jsonc` |
| `configs/era.tavern.parallel_reads.jsonc`，`protocol_parallel_reads` | 承接初始化和派发的独立并行读取 | `ARCHITECTURE.parallel_reads.jsonc` |

局部脚本只调用一次生成的`runEra`。所有调用显式选择`options.entry`；通信入口解包纯数据、恢复同实例资源并封装结果，不另建执行器或变量权威。原public入口保留数据合同，独立sync Config始终立即返回。

本机连接方案的保存、删除、清除密钥和角色正则启用共用原生设置保存等待：`saveSettingsDebounced`只安排宿主保存，实际成功的`SETTINGS_UPDATED`到达后，既有操作资源才结束；实例取消时释放监听。该通知沿用宿主的全局设置保存语义，不是每个连接方案的独立事务回执。没有收到通知时不提前报告已保存，不加固定延时或额外保存队列。

资源、Service、串行作者、通知终态和计时由普通职责分支运行，末尾独立all汇合。资源Node登记pagehide，拥有真实IO、监听、计时与展示释放器；停止等待实际任务及异步finally。作者按消息位置串行并与Service协作完成提交，不由外部请求的短期节点信号控制其生命周期。

技术内容呈现在启用节点中调用一个 App 资源入口，注册宿主排版钩子、楼侧报告及出站处理，交实例资源作用域统一释放。写入回读确认后仅通知同一模块更新相关楼报告。正常消息渲染与状态栏的挂载继续由宿主完成。

## Service与宿主事件协作

Service图在原InvokeSync前显式调用共用`era.workflow.yield_host_turn`，等待`era.workflow.scope.yield_turn`后原样交出当前请求。`protocol_resources/runtime.mjs`把该操作绑定到当前工作流的取消信号与当前Session clock，只等待一次宿主事件轮次；结束或取消均释放局部计时器和监听。实际同步调用、领域判断、消息依据检查与写入仍由原路径执行，不增加重试、队列或后台管理器。Macro、Tavern sync与公开同步Facade不经过这个挂起节点。

此结构已于2026-11-09在两份完整HTML图上获批并接入源码，执行验证状态见[任务记录](../../reports/era-overswipe-repair-20261106/TODO.md)；源码接入不表示真实业务验收通过。

原生候选的写入窗口在真实新生成开始时建立。收到该候选的回复时，事件入口先核对聊天、角色、候选周期和Swipe，再绑定实际楼号，继续使用同一窗口；普通生成完成不会被当成用户换了目标。编辑、删除、切换、取消、换聊天或不属于当前候选的接收事件仍使旧请求失效。写入前的消息正文、候选和聊天依据检查继续执行，不替用户切回旧候选，也不把被拒绝的提交报告为成功。

窗口分类由入口内的单一私有函数表达，候选核对使用顺序明确的保护条件；不在大型事件准备函数中继续堆叠分支。完整业务验收仍以对应候选包的真实用户路径与回归结果为准。

内存基线恢复保持原记录及其来源，不冒充对旧候选的写回。Service在恢复调用中单独传入本次派发的`expectedSourceBasis`，Tavern严格核对当前消息，再按同一聊天、Sidecar和预期版本更新内存；记录自身的`sourceBasis`仍供后续正文归属判断。

普通内存暂存使用Service已经声明的`nativeCandidate`待写归属：只有原来源仍处于生成中或预留位置、候选及非空生成周期相同、正文只在原前缀后追加时，才按当前正文核对这次内存操作。存入的计算基线和待写前缀不变，由Service沿已有规则合并后到达的回复；切换候选、取消、改写原前缀及其他消息变化仍拒绝。内存暂存不写宿主正文或文件，真实保存继续使用原精确来源检查，不把原生生成的正常推进当成外部改写，也不放行过期正文覆盖。

消息写入清单按 Tavern Helper 的两种读取形状取值：`include_swipes: true`仅用于候选正文及位置，原`extra`从默认的当前候选视图读取后与本次ERA字段合并。辅助流程仍一次调用原`setChatMessages`，随后沿原保存及回读核对链结算；不会因ERA附加字段更新而把原资料当空对象覆盖。

主服务读取和写入前来源核对共用同一消息投影：激活正文读取Helper默认当前消息视图，Swipe位置及候选存在事实读取`include_swipes: true`。Host在接收事件中已更新当前正文、但尚未回填候选数组时，不把数组空项当作正文；真正仍在数组末尾的原生预留位置继续投影为空，沿原规则暂存且不写入。聊天、角色、候选周期、Swipe及精确正文比较均保留。

## 构建与验收

Agent聊天上下文和原生生成收尾共用当前消息投影：正文及附加资料取Helper默认视图，候选索引及预留位置取完整视图。当前候选直接保存的`era_agent`优先于原生provider封套内的附加资料，避免重开聊天后丢掉已保存的周期；只向Service传递ERA标记，不传递provider元数据。原生预留位置仍为空，周期恢复及阶段选择继续由Service负责，不恢复历史请求。

`bindings.jsonc`及其SDK声明是宿主操作合同来源；机械生成器只转交明确操作与固定参数。源码资源经SDK登记，不手工修改generated。

正式单文件构建使用`pnpm --dir app release`，先重建共享包和工作流AOT再打包；固定工具链及Macro AOT核对要求见[开发总览](../../docs/developer/开发总览.md)。结构变更按协同协议review并更新Architecture，保留CONCERNS及真实失败。

本任务业务验收按用户最新要求使用本地隔离真实酒馆、官方Pack/Harness及公开用户操作，保持原事件、预算与断言。每次测试先使用long-running-task-monitor，由root本人启动、监督、独立审计并完成源码归因修复，不恢复云作业或委托Luna。原三路径和独立可见四步完成后，同最终包先走 497 路综合，再走 927 路细则；安全批次收齐后集中修复，定向通过再全量闭环。当前成绩以[交接说明](../../docs/developer/交接说明.md)为准，不将旧包或局部通过拼成整项验收。
## 原生生成来源

启动节点按事件目录的 `nativeType` 监听宿主信号，按 `type` 交给既有领域流程。ERA 的逻辑 `generation_started` 绑定到酒馆 `GENERATION_AFTER_COMMANDS`，名称保留宿主实际大小写并由本仓接口类型约束：酒馆更早的同名 started 信号也会出现在仅执行斜杠命令、没有回复及结束事件的路径中，不足以建立候选。现有高水位屏障、候选归属、取消、回信及统一保存流程保持同一路径，不增加补偿任务。外部酒馆事件和 ERA 公开 API 不变。

`ERA.ready()`先通过同一回执工作流等待调用时已经接收的工作，再检查快照与保存状态；不通过新同步事件制造“就绪”，也不把稍后到达的请求加入本次固定范围。普通读取不等待生成阶段交接、不消费生成失败记录。消息内函数的上下文接口仍读取当前执行位置，避免等待自身任务。
