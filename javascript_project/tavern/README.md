# ERA 原生酒馆辅助流程

`era-tavern` 负责酒馆通信、事件准入、FIFO、回执、通知、生成屏障和资源生命周期；主 Service 保留领域规划、变量与历史状态权威。框架为 VibeFlow 0.20.0，Workflow ABI v6。

| 入口 | 职责 | Architecture |
|---|---|---|
| `configs/era.tavern.sync.jsonc` | 同步准入、结果帧、即时操作、实际异步操作的同步前段 | `ARCHITECTURE.sync.jsonc` |
| `configs/era.tavern.async.jsonc` | 接收、回执与屏障挂起、API结果确认及停止收尾 | `ARCHITECTURE.async.jsonc` |
| `configs/era.tavern.runtime.jsonc` | 持有当前局部脚本资源，受管运行主 Service 与后台工作 | `ARCHITECTURE.jsonc` |

角色卡局部脚本调用一次生成的 `runEra`。资源 Node 登记 pagehide，拥有实际 IO、监听、计时及展示释放器；停止须等待实际操作和异步清理完成。同步和异步入口共享同一实例资源，主 Service 只收可移植DTO。

后台图仅三个任务管理边界：启动、等待任一结果、停止并等待退出。普通 Node 与实际连边处理任务选择、结果、失败和回执。0.20.0等待结果一次交付即回收；已消费的引用随即从名单移除，不能再次控制。三个入口最大展开深度均3。

`bindings.jsonc` 提供58个操作的合同和固定调用配方，其中56个业务Capability操作、2个内置Port操作。登记的纯生成器产出 `generated/bindings.mjs`；接线只调用真实AOT与转交参数。接口表只保留当前调用合同，不维护旧适配文件路径。源码经SDK登记，共享工具限于数据与资源原语。

构建和验证：`pnpm --dir app build:workflows`，然后运行 `pnpm --dir app verify`、`pnpm --dir app test:integration:tavern`、G3/G4及适用生产构建。测试须遵循根AGENTS和回归规程。获批实现已同步主目录，实际最终构建与真实业务验收状态以[开发交接](../../docs/developer/交接说明.md)为准，不把离线探针当真实酒馆验收。
