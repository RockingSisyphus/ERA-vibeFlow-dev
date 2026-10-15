# ERA 原生酒馆辅助 Root

本 root 与主 Service 合作，使用原生Node/Nodeset表达原Host及酒馆适配职责。先读vibeflow_project.jsonc及三个已登记Architecture，再沿source修改真实Config、SDK声明与Node。遵循根AGENTS、内核collaborative协议、开发总览和文档维护指南。

当前框架0.20.0、Workflow ABI v6。三入口为sync/async/runtime，最大展开深度3。实际可达Config已实施；部分已登记模块保留planned后缀，不能据文件名判断状态。历史审核和迁移脚本仅用于追溯，不是开发入口。

局部脚本只调用一次生成的runEra；不增加停止按钮、外部start/stop管理对象或图外调度。资源Node持有pagehide、原始IO、监听、计时与展示释放器，必须等待实际任务和异步finally完成；页面环境已被销毁不能声称异步JS仍完成清理。

任务控制仅runtime的launch、wait_any、stop_and_wait三处。TaskRef与context.tasks只属同次运行，不保存到Session，也不从Node返回后的回调使用context。0.20.0等待接口一次交付即回收，接收后移除对应引用，结果作为普通数据传递；不能再次等待或停止已消费引用。

分支、排序、重试、取消与结算须在真实流程中可见；共享库只承担数据转换和资源原语。机械生成器按同一接口声明生成固定AOT调用，不直接导入Node实现，不持有队列或资源策略。多个AOT入口传同实例资源对象，领域Service只收DTO。

Tavern API类型唯一参考app/@types。Service决定领域操作、历史和回退；辅助root执行明确请求，UI与宏不另建权威状态。生成屏障必须等待相应回执终态，告警不超时放行；宏只读已提交快照。

新结构依协同协议维护四类清单并先正式审核。更新Architecture和SVG只用VibeFlow命令，完成适用validate、quality、AOT和执行探针。集成探针位于app/tests/native-tavern，入口pnpm --dir app test:integration:tavern，先build:workflows。每次测试前使用long-running-task-monitor；真实业务综合→细则、失败复跑与审计按项目规程执行。稳定测试批次启动/恢复约10分钟检查、健康后约60分钟，无活跃作业时暂停；本轮era-6已经完成并暂停，后续按新任务的实际批次使用监控。

本 root 已完成主目录生产接入与VibeFlow 0.20.0独立沙箱验收：同最终bundle综合495/495、细则924分段覆盖通过，原partial与恢复结果分开报告。日常酒馆未单独联调；通用Harness高并行桥接超时具体来源仍未根治。验收结论与质量关注项见开发交接；历史运行附件已按用户要求删除，不再引用外部归档。后续产品或测试行为改变后，需重新对应必要验收。era-6本轮完成后暂停，不自动启动新工作。
