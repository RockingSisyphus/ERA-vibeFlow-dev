# ERA 宿主、Service、宏与 UI 合同

## 分层与唯一职责

```text
Tavern Helper / SillyTavern / ERA UI
  → app/src/ERA变量框架/service（受限 Host 投影）
  → javascript_project/service（异步业务规划、同步、回滚、提交）
  → 已提交 ERA snapshot
  → javascript_project/macro（同步替换计算）
  → registerMacroLike / ERA UI 观察结果
```

| 层                    | 可以做什么                                       | 不可以做什么                             |
| --------------------- | ------------------------------------------------ | ---------------------------------------- |
| Tavern adapter / Host | 监听、FIFO、receipt、Capability 副作用、资源清理 | 第二套 planner、按场景直接决定回滚       |
| VibeFlow Service      | 事件组合、任务规划、回滚/同步、业务状态提交      | DOM、`window`、直接 Tavern Helper 调用   |
| VibeFlow Macro        | 基于已提交快照同步计算替换文本                   | Promise、写入、Service 调用、状态同步    |
| UI                    | 展示、收集用户意图、显示结算后的状态             | 直接重建/写入 ERA 业务状态、复制同步逻辑 |

Sidecar 的身份检查、旧聊天迁移、冲突决策和迁移/独立/复制事务属于 Service 的
`era.sidecar.store` Nodeset。聊天变量只保存 `ERAMetaData.SidecarId`；ERA 状态只保存在
Sidecar V2 用户文件中。Tavern adapter/Host 只提供当前身份、聊天指针、原生 files、受限内存
快照与 UI 通知这几项技术能力；它不能自行决定 owner、迁移或变量恢复。宏只能读取身份匹配的
内存快照，快照缺失时必须为空，不能回退读取聊天变量。

## 生成 barrier

生成开始前，Host 必须等待对应 high-water sequence 之前全部被接受事件的 receipt 进入终态；随后宏
才可读取当前 committed snapshot。正常业务失败可以形成可定位的失败 receipt，不能把证据缺失或超时
伪装为已完成。详细的顺序与取消规则以
[`ERA事件调度与生成栅栏设计.md`](../../app/开发文档/ERA事件调度与生成栅栏设计.md) 为准。

重新生成、swipe、编辑等场景的组合与回退目标属于 Service planner。修复此类问题应先补覆盖真实
事件序列的回归测试，再修改领域 planner；不在 macro、UI 或 adapter 增加延迟/重试型补丁。

## 公共 ABI

以下内容的变更须单独审查、更新文档并有合同测试：

- `era:*` 公开事件及 payload；
- `{{ERA:...}}`、`{{ERA-withmeta:...}}` 的宏语法和缺失值语义；
- 持久化的 `ERAMetaData`、MK、EditLogs 或设置结构；
- receipt 结算、写入确认、通知的可观察顺序；
- UI 公开操作及其成功/失败结果。

## 验证选择

代码/工作流改动先跑相应的 VibeFlow validate、quality、build 与 app 合同测试；需要证实浏览器行为时，
再运行 ERA-Test-Pack 或经授权的真实酒馆联调。结构检查通过不等于 ERA 产品行为通过，两者必须分开报告。
