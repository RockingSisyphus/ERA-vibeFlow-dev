# VibeFlow 0.13.1 升级变更清单

状态：`resolved_by_0.13.2`

范围：将项目内受保护的 VibeFlow 分发核心与文档系统从 0.11.1 精确更新为
`/home/example/projects/VibeFlow/dist/vibeflow-distribution` 提供的 0.13.1，
并完成既有两个 JavaScript AOT root 的描述符兼容迁移。此次升级不改变 ERA 业务
拓扑、公开事件、持久化 Schema 或 Macro ABI。

## 复用

| source | 对象 | 保持内容 |
|---|---|---|
| `vibeflow_config.jsonc` | `era-service`、`era-macro` 两个 root | root ID 与项目路径保持不变 |
| `javascript_project/service/configs/**` | Service workflow 与 nodeset | 现有 implemented/planned 状态、节点、边和中文元数据保持不变 |
| `javascript_project/macro/configs/**` | Macro workflow 与 nodeset | 同步入口、ABI 与业务拓扑保持不变 |
| 两个 root 的 `manifests/data/**` | 独立 Data Schema | 继续作为 Node 输出结构的唯一权威定义 |
| 两个 root 的实现源码与工具链 | TypeScript、package lock | 不因内核更新改写业务逻辑或依赖版本 |

## 修改

| source | 对象 | 精确变化 |
|---|---|---|
| `kernel/**`、`run.py`、`DISTRIBUTION.json` | 受保护分发文件 | 从可信 0.13.1 分发目录逐字节同步，不手工修补内核 |
| 根 `AGENTS.md`、`README.md` | 项目入口说明 | 保留 0.13.1 的任务路由规则，并改为指向 ERA 的两个真实 AOT root |
| `javascript_project/service/manifests/nodes/*.jsonc` | 76 个 Node descriptor | 删除 0.13.1 已废弃且会被 fail-closed 拒绝的 `contract.output_schema`；端口继续引用独立 Data Schema |
| `javascript_project/macro/manifests/nodes/*.jsonc` | 9 个 Node descriptor | 同上 |
| `javascript_project/{service,macro}/ARCHITECTURE.jsonc` | 登记架构文档 | 由 0.13.1 正式 `review` 确定性刷新 |
| `reports/era-*.expanded.svg` | 正式审核图 | 由 0.13.1 正式 `review` 重新生成，并检查 planned 原生样式 |

## 删除

| source | 对象 | 原因 |
|---|---|---|
| `kernel/docs/00_*.md` 至 `11_*.md` | 0.11.1 编号式长文档 | 由 0.13.1 任务路由式 `kernel/docs/user/**` 取代；删除来自可信分发同步，不是项目手工删改 |
| Node descriptor 的 `contract.output_schema` | 85 个旧字段 | 0.13.1 契约模型禁止 Node 覆盖输出结构；独立 Data Schema 已完整覆盖全部输出类型 |

## 新增

| source | 对象 | 职责 |
|---|---|---|
| `kernel/docs/user/**` | 快速开始、workflow、JS、Python、nodeset、集成、命令结果、协同 profile | 按任务和受众组织的规范文档系统 |
| `DISTRIBUTION.json` | `vibeflow.distribution.v2` 元数据 | 声明版本、development profile、agent protocol 与自动化能力 |
| 0.13.1 命令结果 | `result_code`、`validation_scope`、`checked`、`not_checked` | 明确区分内核已验证与未验证的业务维度 |
| `reports/kernel-upgrade/0.13.1/pre-upgrade/**` | 0.11.1 升级前备份 | 保存旧核心、manifest、入口文档及旧文档归档，支持审计与恢复 |

## 不变量与验证

- 只从可信分发目录同步受保护文件，`python run.py verify-kernel` 必须通过。
- Node descriptor 迁移前确认所有 `provides[].type` 均有独立 Data Schema。
- 两个正式 `review`、`validate` 与 `quality` 使用 0.13.1 当前代码重新执行。
- Service 审核图必须由内核原生展示 planned 节点，不添加 `【计划】` 名称前缀或手工 SVG。
- Service 仍处于人工架构审核门；核心升级不构成对 planned 业务实现的批准。

## 当前阻塞

0.13.1 的新契约继承路径在 ERA Service 的多层 nodeset registry 上出现无界式重复
解析。正式 `review` 与独立 `validate` 都停在
`compile_core → _resolve_effective_graph` 的递归调用中；正式 review 运行约 5 分 30 秒后
RSS 已增至 14,268,792 KiB，且 Architecture/SVG 均未发布新版本，因此已主动终止以防
实际 OOM。该问题不能通过恢复调用点旧 `requires/provides` 绕过，因为 0.13.1 会明确
拒绝重复契约。

Macro 的正式 review、quality 与 Browser ESM build 均已通过。0.13.1 源码内的 planned
样式回归测试也确认会生成 `plannedNode`、黄色填充和虚线边框；但 ERA Service 的真实
新 SVG 必须等内核修复递归解析问题后重新运行正式 review，旧 SVG 不作为 0.13.1 证据。

该阻塞已由可信 0.13.2 分发修复。0.13.2 下 Service 正式 review、validate 与 quality
均通过，新的 Architecture 和 expanded SVG 已发布；后续状态见
`vibeflow-0.13.2-upgrade-inventory.md`。
