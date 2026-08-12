# 计划中的酒馆能力

G1 descriptor 登记以下 Capability ID 与操作：

- `era.tavern.variables`: `read`, `commit`
- `era.tavern.messages`: `read_context`, `update_content`, `refresh`
- `era.tavern.worldbook`: `read`, `create`, `bind`, `replace_entries`
- `era.tavern.regex`: `read`, `upsert`
- `era.tavern.identity`: `read`

只有 `identity.read` 是 immediate；其他操作均为 suspend，并且必须遵守工作流
的 AbortSignal。descriptor 仅定义契约。planned
`era.tavern.service_host` 已在 Service workflow 中声明未来提供
`vibeflow.port` 和上述五类能力，但 planned 资源不会被视为真实 Capability
provider；人工批准后由同一 ID 的 implemented Host Extension 提供实现。
