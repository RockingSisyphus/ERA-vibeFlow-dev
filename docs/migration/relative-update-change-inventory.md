# ERA JSON 相对数值更新架构变更清单

状态：`validated`

基线：

- ERA-vibeFlow：`516f9d2b1459edc2de4867ff905214da8d82e2d7`
- ERA-Test-Pack：`25c95c6df828519c8d879c2668b130b66f3711d5`
- ERA 基线：VibeFlow structure/quality 通过，app 267/267 单元测试通过；ERA Quality
  保留 344 条已登记 finding，0 新增、0 恶化。
- Pack 基线：0.3.1 `pnpm verify` 通过，55/55 合同测试通过，catalog 263 paths、
  regression core 262 paths。

用户已明确批准 planned 审核图；已按获批边界实施 TypeScript、文档、产品测试与
ERA-Test-Pack 0.4.0，正在执行 implemented 架构更新与完整验收。

## 复用

| 对象 | 保留职责 |
| --- | --- |
| `era.task.sync` 与 `task_sync.plan_sync` | 继续作为 AI、公开写 API、full/latest/rollback 和历史重算共用的唯一同步入口 |
| `era.crud.engine` | 继续按消息内原始顺序执行 Insert/Edit/Delete，并生成可回滚 EditLog |
| `era.service.api_write_engine` | 继续只把 `updateByObject/updateByPath` 转成原始 `VariableEdit`，不解释运算 |
| `EraTaskResultV1.diagnostics` | 继续承载领域诊断、消息索引和事件 sequence，不增加公开事件或 wire 字段 |
| ERA-Test-Pack `era-behavior-contract` | 继续按 action ID 判断状态、receipt、事件、EditLog 与诊断 |

## 修改

| 对象 | planned 变化 |
| --- | --- |
| `task_sync.plan_sync` | 在现有端口和三分支拓扑内登记相对更新能力；不新增并行业务入口 |
| `task_initialize.plan_resources` | 在既有初始化规划入口登记 AI 世界书相对更新规则；不改变资源提交拓扑 |
| `era.crud.engine` | 在 `VariableEdit` 叶子赋值前统一识别 `$inc/$mul/$div`，计算具体结果并逐字段诊断失败 |
| `era.service.sync_engine` | 把 CRUD 路径诊断补充消息索引后并入现有同步计划 |
| `era.service.resource_planner` | 以 AI 友好的严格 JSON 示例说明三种操作和禁止的旧字符串表达式 |
| 公开说明与测试 | 移除 `"+=2"` 等旧字符串运算承诺，改为 JSON 操作对象并覆盖重算/回滚 |

## 删除

| 内容 | 原因 |
| --- | --- |
| 文档和测试中把 `"+=2"`、`"-=2"`、`"*=2"`、`"/=2"` 当成运算的约定 | 这些语法从未实现，也不建立兼容分支 |
| 为 AI 与 API 分别解析运算的候选方案 | 两条链最终均进入同一 `VariableEdit` CRUD，引入双实现会产生语义漂移 |
| 任意表达式、`$set`、`$sub`、引用、函数、字符串或数组运算 | 超出有限 JSON 数值操作合同，增加歧义和安全面 |

## 新增

| 对象 | 职责 |
| --- | --- |
| CRUD 内部纯相对更新解析结果 | 区分非操作、成功和带 code/path/message 的失败，不访问宿主或保存状态 |
| 四个诊断码 | `ERA_EDIT_OPERATOR_INVALID`、`ERA_EDIT_TARGET_NOT_NUMERIC`、`ERA_EDIT_DIVIDE_BY_ZERO`、`ERA_EDIT_RESULT_NON_FINITE` |
| Pack 0.4.0 `relative-update` catalog 与 suite | 16 条 AI/API/无效/历史路径及 required oracle，最终聚合进 `era-regression-all` |

## 审核不变量

- 公开 `era:*` 事件、payload 外壳、通知顺序和 `era-contracts` 1.4.0 ABI 不变。
- `$inc/$mul/$div` 仅在 `VariableEdit` 中作为恰好一个键的终端对象生效。
- 旧字符串表达式仍是普通字符串赋值；不做兼容识别。
- 不存在路径和 `$meta.updatable: false` 继续沿用现有不修改语义。
- 无效操作只跳过当前字段，合法兄弟字段继续执行；结果必须有可审计诊断。
- 运算读取实时当前值；EditLog 保存具体旧值/新值；重算保留原始操作意图。
- 不修改 ST-Harness，不在 Host、UI、Macro 或冻结旧实现中复制业务逻辑。
- planned 调用使用 blocking 行为；审核态不执行 production build。

## 正式审核证据

- Config 中 planned 定义同时覆盖运行时同步入口 `task_sync.plan_sync` 与 AI 规则初始化入口
  `task_initialize.plan_resources`；二者均保持原端口、分支和 blocking 行为，不新增运行时拓扑。
- `architecture`、`architecture --check`、`validate` 和正式 `review` 均为 `PASS`。
- Architecture 中共有 2 个 planned 定义：`task_initialize.plan_resources` 与
  `task_sync.plan_sync`。
- expanded review 中共有 5 个 planned 实例：初始化资源规划 1 个；共享同步规划因被
  4 条调用链复用而展开为 4 个。
- Architecture SHA-256：
  `cb5bef059ef4639242b737115dc5f5c7f5c38ca2d70e3e32880d5b73f46b713b`。
- expanded SVG SHA-256：
  `55087a414084d4faad99d80ac07306d410dd7465eb9a1f16bb489a6efba9426c`。
- 审核图：`reports/era-relative-update-planned.expanded.svg`。
- 2026-08-14：用户已明确批准审核图；两个调用已恢复为 implemented，且未新增
  运行时节点、端口或公开协议。

## 最终验证证据

- ERA architecture/check、validate、quality、implemented review、browser build、app
  `pnpm verify`（276/276）和 `test:integration` 通过；
- Pack 0.4.0 `pnpm verify`（58/58 contract tests）通过；
- 专项 run `st-run-20260814T04494864-02b2e33179cb` 的 16 条相对更新均 passed，Artifact
  `consistent/complete`；五条 AI/API/无效/full/Swipe 独立抽样也均 passed；
- 379-path 聚合回归 `st-run-20260814T05033257-2aca0d402bd4` recording 379/379 completed，
  379 个 required evaluation 全有终态，Artifact audit `consistent/complete`。16 条 REL
  均 passed；两条旧 oracle 假设 `API-BOUND-007`、`SEM-SRC-003` 经 Pack 修正后独立重测
  均 passed；
- production bundle SHA-256：
  `a15c154a3e7c84d532f03fb2996f11b05084b4be549aed28c741cee6da4fc983`。
