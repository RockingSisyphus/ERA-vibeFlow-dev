# ERA 原生酒馆辅助 Root

本 root 与主 Service 合作，使用原生Node/Nodeset表达原Host及酒馆适配职责。先读vibeflow_project.jsonc及两份已登记Architecture，再沿source修改真实Config、SDK声明与Node。遵循根AGENTS、内核collaborative协议、开发总览和文档维护指南。

当前工具链1.3.8、Workflow ABI v10，sync由独立Config构建；async Config包含operation与runtime两个命名入口，调用必须显式选择entry。资源、主Service、作者、通知终态和计时由五条普通职责分支运行，末尾独立all汇合；作者按消息顺序串行，与Service协作完成提交。当前执行证据及剩余整治见开发交接，历史0.20.0成绩不能用于新版验收。

局部脚本只调用一次生成的runEra；不增加停止按钮、外部start/stop管理对象或图外调度。资源Node持有pagehide、原始IO、监听、计时与展示释放器，必须等待实际任务和异步finally完成；页面环境已被销毁不能声称异步JS仍完成清理。

旧任务控制API、tasks数组监督与第二套停止流程已经退役。资源Node拥有实际Promise及释放器；通知由发送节点同步发起，完成事实进入通知Loop，未结束的原始回调和异步finally都须等待。Service已经接收的通知及作者上下文归实例所有，不继承发起节点返回时自动取消的短期信号。

分支、排序、重试、取消与结算须在真实流程中可见；共享库只承担数据转换和资源原语。机械生成器按同一接口声明生成固定AOT调用，不直接导入Node实现，不持有队列或资源策略。不同入口调用显式传递同实例资源对象，领域Service只收DTO。

Tavern API类型唯一参考app/@types。Service决定领域操作、历史和回退；辅助root执行明确请求，UI与宏不另建权威状态。生成屏障必须等待相应回执终态，告警不超时放行；宏只读已提交快照。

新结构依协同协议维护四类清单并先正式审核。更新Architecture和正式HTML快照只用VibeFlow命令，完成适用validate、quality、AOT和执行探针。集成探针位于app/tests/native-tavern，入口pnpm --dir app test:integration:tavern，先build:workflows。每次测试前使用long-running-task-monitor；真实业务综合→细则、失败复跑与审计按项目规程执行。稳定测试批次启动/恢复约10分钟检查、健康后约60分钟，无活跃作业时暂停；复用匹配的本聊天心跳，具体运行状态只记录在任务文档。
