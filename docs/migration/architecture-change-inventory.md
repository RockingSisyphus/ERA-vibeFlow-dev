# G1 架构变更清单

本清单是对登记 demo workflow 的整体重构批准范围，并记录用户明确授权的
VibeFlow 可信分发包升级。未列出的业务节点、边、nodeset 调用层级和宿主职责
保持不变。

## 复用

| source | id/hook | 当前职责 | 计划 |
|---|---|---|---|
| `kernel/` | kernel distribution | VibeFlow 运行、校验和 AOT 构建内核 | 仅从可信分发包原样成组同步，禁止手工修改或解包 |
| `run.py` | CLI launcher | 校验 kernel 完整性并启动 CLI | 原样复用 |
| `kernel/docs/` | public contracts | Node、config、nodeset、AOT、Host Extension 规范 | 作为实现唯一内核依据 |
| 冻结源 tag | UI、纯算法、测试 | 现有 ERA 行为和应用 | 机械接管到 `app/`，作为差分 oracle |

## 修改

| source | id/hook | 当前职责 | 计划变化 |
|---|---|---|---|
| `vibeflow_config.jsonc` | workspace roots | 只登记 `project` | 改为 `era-service → javascript_project/service`、`era-macro → javascript_project/macro` |
| `kernel/vibeflow-kernel.zip`、`kernel/MANIFEST.sha256`、8 份 `kernel/docs/*` 与 5 个受保护 sandbox 文件 | VibeFlow 0.7.0 分发内容 | 旧生成批次不支持 workflow 级 planned Host Extension | 从 `/home/example/projects/VibeFlow/vibeflow_distribution` 精确同步到 2026-07-30 17:36:36 UTC 生成批次 |
| `AGENTS.md`、`README.md` | 项目开发指引与分发说明 | 旧 Host Extension 选择规则 | 同步 planned plugin/Host Extension 规则和分发身份说明 |
| `docs/ERA基于VibeFlow的整体重构计划.md` | migration plan | 概念计划 | 更新为已冻结基线和 G1 实施状态 |
| `app/` build entry | legacy Webpack entry | 旧 ERA 完整入口 | G1 只接管并标记 test-only；G7/G8 才切换生产入口 |
| `javascript_project/service/configs/era.service.jsonc` | `host_extensions[era.tavern.service_host]` | 仅通过说明文档保留未来边界 | 以中文元数据、browser target、Port、五类 Capability 和资源限制登记为 planned |
| `javascript_project/service/vibeflow_project.jsonc`、`javascript_project/macro/vibeflow_project.jsonc` | `javascript.host_extensions` | 旧 project 级兼容选择 | 删除兼容字段，改由各 workflow 顶层明确选择 |
| `javascript_project/macro/configs/era.macro.jsonc` | `host_extensions` | 依赖旧 project 级空列表表达隔离 | 顶层显式登记空列表，保持同步 Macro 无宿主扩展 |

## 删除

| source | node/edge/resource id | 当前职责 | 删除理由 |
|---|---|---|---|
| `project/configs/main.jsonc` | `start`, `seed`, `add`, `output`, `end` | demo 算术主线 | 与 ERA 业务无关，由两个真实 root 取代 |
| `project/configs/main.jsonc` | `start→seed→add→output→end` | demo 控制边 | 与 ERA 业务无关 |
| `project/registry.py`、`project/nodes/` | `demo.start`, `demo.seed`, `demo.add`, `demo.output`, `demo.end` | Python demo registry/node | JS/TS AOT 迁移不使用 Python registry |
| `project/base_lib/` | `math_tools` | demo 算术 helper | 与 ERA 无关 |
| `project/plugins/` | `project_policy` | demo policy plugin | 与 ERA 无关 |
| `project/ARCHITECTURE.jsonc` | demo document | demo 确定性架构视图 | 由两个 root 各自的 canonical 文档替代 |
| 两个 `vibeflow_project.jsonc` | `javascript.host_extensions` | 旧兼容启用列表 | 新内核下删除，避免 workflow 选择来源不明确 |

## 新增

| source | id/hook | 计划职责 |
|---|---|---|
| `javascript_project/service/configs/era.service.jsonc` | `era.service` | async 永久服务 workflow |
| `javascript_project/service/configs/nodesets/*.jsonc` | `era.service.*`, `era.events.*`, `era.tasks.*`, `era.task.*` | iteration、planner、step dispatch 和领域任务 planned 边界 |
| `javascript_project/service/manifests/data/**`、`manifests/capabilities/**` | service Data Schema、Capability | Tavern service DTO 与宿主操作契约 |
| `javascript_project/service/configs/era.service.jsonc` | `era.tavern.service_host` planned resource | 在正式图中审查宿主职责、target、Port、Capability 和配置边界；不打包、不启动、不提供真实能力 |
| `docs/migration/kernel-upgrade-manifest.json` | trusted distribution identity | 固定新旧分发生成时间、来源路径和完整 SHA-256 |
| `javascript_project/macro/configs/era.macro.jsonc` | `era.macro` | sync 宏 workflow |
| `javascript_project/macro/configs/nodesets/*.jsonc` | `era.macro.*` | 宏解析 planned 边界 |
| `javascript_project/macro/manifests/**` | macro Data Schema | 同步 ABI |
| `packages/era-contracts/` | `@era/vibeflow-contracts` | 后续 G2 实现的 DTO/codec 唯一来源 |
| `reports/*.expanded.svg` | G1 review artifacts | 人工架构审核 |

## 保持不变的硬边界

- G1 只创建 planned 架构，不写业务实现 TypeScript。
- planned 调用点和 body 使用 `planned_behavior: "transparent"` 的最小审查语义，
  使 flow health 能验证 start/end 连通性；它仍不可运行，也不是 `python_stub`。
- `requires`/`provides` 不替代显式 edge。
- Macro 无 Host Extension、Capability、Port 或异步节点。
- Service Host 不包含 CRUD、同步、合并或回滚业务规则。
- planned `era.tavern.service_host` 只进入 Architecture/SVG，不进入 bundle、
  生命周期或 Capability provider；G1 不伪造 descriptor/factory。
- 人工批准后为同一 ID 新增真实 descriptor 与 TypeScript factory，并将
  workflow 使用项切换为 `implemented`。
- 定向 rollback 仍属于 sync 分支，不新增生产 `era.task.rollback`。
- 正式 review 后停止，等待用户下一条明确批准。
