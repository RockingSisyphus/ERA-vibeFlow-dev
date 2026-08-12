# G1 中文化架构变更清单

本清单记录 2026-07-31 00:35 的中文化批次：该批次只修改可读元数据，不改变
当时已审核的工作流语义。后续新版内核与 planned Host Extension 登记属于另一项
明确的架构变更，见 `architecture-change-inventory.md`。

## 复用

| source | id/edge/hook | 当前职责 | 本轮处理 |
|---|---|---|---|
| `javascript_project/service/configs/era.service.jsonc` | 顶层 workflow、`service_loop` | 异步 ERA Service 入口 | 保持拓扑、loop 与 contract |
| `javascript_project/service/configs/nodesets/*.jsonc` | 11 个真实 nodeset | collection、batch、task、API 与发布流程 | 保持全部节点 ID、类型、边和分支条件 |
| `javascript_project/macro/configs/era.macro.jsonc` | Macro workflow | 同步宏解析入口 | 保持同步 ABI 与 safe-OR 合流 |
| `javascript_project/macro/configs/nodesets/replace_all.jsonc` | `era.macro.replace_all` | 宏扫描、取值、格式化与重建 | 保持节点与数据契约 |
| `project/**/manifests/**` | Data Schema、Capability | AOT 类型和宿主 ABI | 保持资源 ID、operation、字段名和 JSON Schema 约束 |

## 修改

| source | id/hook | 当前职责 | 计划变化 |
|---|---|---|---|
| `javascript_project/service/configs/**/*.jsonc` | 所有节点、nodeset、requires/provides | 架构图可读元数据 | `display_name` 与 `description` 统一为中文 |
| `javascript_project/macro/configs/**/*.jsonc` | 所有节点、nodeset、输入输出、requires/provides | 架构图可读元数据 | `display_name` 与 `description` 统一为中文 |
| `javascript_project/service/manifests/capabilities/*.jsonc` | 5 个 Capability | 宿主能力说明 | `display_name` 与 `description` 统一为中文 |
| `project/**/manifests/data/*.jsonc` | Data Schema | DTO 阅读说明 | 可读 `title`、`description` 统一为中文 |
| `project/**/README.md` | G1 边界说明 | 开发者文档 | 可读说明统一为中文 |
| 两个登记的 `ARCHITECTURE.jsonc` 与 expanded SVG | 正式审核产物 | 人工架构审核 | 通过真实 source 重新生成 |

## 删除

无。

## 新增

该中文化批次除本清单和审核记录外，不新增 node、edge、hook、type、
Capability、Port 或 Host Extension。

## 明确保留英文的机器 ABI

- `id`、`type_key`、`type_used`、`key`、`type`、`as`
- Port ID、Capability ID、operation ID
- JSON 字段名、Schema `$id`、枚举/API 固定字面量
- `when` 表达式、配置键、包名与源码路径

这些值参与运行时契约、构建或兼容性比较，翻译会造成破坏性 ABI 变化。
