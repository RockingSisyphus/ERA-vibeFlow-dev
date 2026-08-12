# VibeFlow 0.13.2 升级变更清单

状态：`complete_approved_and_in_use`

范围：从可信发布目录将受保护 VibeFlow 核心从 0.13.1 更新至 0.13.2，验证多层
nodeset 契约解析修复，并重新生成两个登记 workflow 的正式审核产物。此次更新不改变
ERA 业务节点、edge、公开事件、持久化 Schema 或 Macro ABI。

## 复用

| source | 对象 | 保持内容 |
|---|---|---|
| `vibeflow_config.jsonc` | `era-service`、`era-macro` | 两个真实 JavaScript AOT root 不变 |
| `javascript_project/**/configs/**` | workflow 与 nodeset | 0.13.1 已完成的契约格式迁移和全部业务拓扑不变 |
| `javascript_project/**/manifests/**` | descriptor 与 Data Schema | 端口、中文语义及独立 Schema 不变 |
| `javascript_project/**/{nodes,base_lib,host_extensions}` | 业务实现 | 本轮不实施任何 planned 业务源码 |

## 修改

| source | 对象 | 精确变化 |
|---|---|---|
| `kernel/**`、`run.py`、`DISTRIBUTION.json` | 受保护分发文件 | 从可信 0.13.2 发布目录逐字节同步；不手工修改内核 |
| `README.md` | 项目版本入口 | 从 0.13.1 更新为 0.13.2 |
| `javascript_project/{service,macro}/ARCHITECTURE.jsonc` | 登记架构文档 | 使用 0.13.2 正式 review 确定性刷新 |
| `reports/era-{service,macro}.expanded.svg` | 正式审核图 | 使用 0.13.2 重新发布；Service planned 节点使用原生样式 |
| 迁移 TODO、备忘录与最终报告 | 阶段状态 | 升级当时从 `blocked_core_regression` 恢复为 `waiting_user_review`；后续已批准并投入使用 |

## 删除

无业务对象删除。0.13.1 的失控进程早已停止；本轮只解除其阻塞结论，不删除历史证据。

## 新增

| source | 对象 | 职责 |
|---|---|---|
| `reports/kernel-upgrade/0.13.2/pre-upgrade/**` | 0.13.1 升级前备份 | 保存核心、manifest、文档和项目入口身份 |
| `reports/kernel-upgrade/0.13.2/upgrade-report.json` | 机器可读升级报告 | 固定哈希、门禁和 planned SVG 审计结果 |
| `reports/kernel-upgrade/0.13.2/macro-build-probe/**` | Macro AOT 探针 | 证明 0.13.2 当前构建路径可用 |

## 核心修复与验证

- 0.13.2 将 `graph.nodesets` 正确作为共享符号表处理，用动态规划为 root 和每个
  nodeset 定义各解析一次，不再递归复制整个 registry。
- 实现契约查找由逐项扫描改为 `type_key → fact` 字典索引。
- Service 正式 review 约 12 秒完成并顶层 PASS；0.13.1 的持续增内存问题未复现。
- Service SVG 有 49 个 `plannedNode` 实例，49/49 显示
  `status: planned blocking`；样式包含 `#fef08a`、`#ca8a04` 和 `6 3` 虚线，
  `【计划】` 前缀数量为 0。
- Service/Macro review 与 quality PASS；Macro Browser ESM build PASS；
  `verify-kernel` PASS。
- 根据 collaborative profile，升级批次当时停在正式审核图发布后等待用户批准；用户
  随后已明确批准，planned 源码也已在后续 G9/G10 实施完成。
