# ERA 产品问题台账

> 状态：当前开发入口  
> 建立日期：2026-08-13  
> 依据：ERA-Test-Pack 0.3.0 真实酒馆回归、ERA UI 专项回归及后续独立重测

## 1. 文档目的

本文登记当前测试发现的 ERA 产品问题，供后续逐项分析、修复和回归验证。

台账严格区分：

- **已确认**：已有完整执行证据，当前可以作为产品缺陷处理；
- **待独立复测**：旧 Artifact 仍显示异常，但可能受到异步结算时机或产品合同解释影响；
- **已解决或已排除**：不得继续计入当前产品缺陷。

历史 suite 的 `failed` 数量不能直接当成产品 bug 数量。ERA-Test-Pack 已确认并修复
多项 oracle、fixture 和证据路径问题；只有本台账列出的开放项进入后续产品修复范围。

## 2. 状态定义

| 状态        | 含义                                     | 后续动作                     |
| ----------- | ---------------------------------------- | ---------------------------- |
| `confirmed` | 产品行为与明确预期不符，且证据完整       | 分析根因、制定修复并定点回归 |
| `candidate` | 有真实异常证据，但尚未排除时序或合同歧义 | 先独立复测，不直接改产品     |
| `fixed`     | 已修改产品，并有对应验证证据             | 保留回归测试防止复发         |
| `excluded`  | 属于测试误判、明确设计边界或不支持功能   | 不修改产品                   |

## 3. 已确认的开放问题

### ERA-PROD-001：Swipe 后停止生成，变量停留在旧 Swipe

- 状态：`fixed`
- 优先级：P0
- 对应测试：`RUNTIME-COMBO-SWIPE-STOP-001`

用户操作：

1. 当前消息存在 swipe A 和 swipe B，变量当前对应 A；
2. 用户切换到 B；
3. 随即开始生成；
4. 用户停止生成。

预期行为：

- 最终变量应与当前显示的 B 一致；
- 停止生成后不应残留 busy、半结算或重复回退状态。

实际行为：

- 酒馆界面已经显示 B；
- ERA 变量仍停留在 A。

根因：切换到缺少 MK 的新 swipe 时，统一上下文准备在同步器运行前同时写入了消息 MK
和 `SelectedMks`。同步器因此看不到“旧 swipe MK → 新 swipe MK”的分歧，没有先撤销 A
再重放 B；停止生成只是让该错误没有被后续流程掩盖，并非停止事件本身漏结算。

修复策略：状态任务只预提交消息文本中的 MK，保留旧 `SelectedMks` 作为同步基线；同步
事务完成回滚与重放后一次性提交新状态、EditLogs 和新链。独立 `update-mk` 任务继续拥有
直接校准 `SelectedMks` 的职责，不增加 `generation_stopped` 补偿监听器。

完成条件：

- 定点测试稳定通过；
- 停止前后变量与最后有效 swipe 一致；
- 无 busy 残留、重复写入、重复结算和未处理异常；
- 普通发送、continue 和独立 regenerate 路径不回退。

修复验证：

- 修复后定点 run `st-run-20260813T08352096-8cbbf4fa833c`：1/1 passed；
- 完整回归 run `st-run-20260813T13040916-db3de24cd17c`：
  `RUNTIME-COMBO-SWIPE-STOP-001` passed；
- Swipe/删除同步候选 `SEM-SRC-006`、`SEM-SRC-010`、
  `UI-SWIPE-003/004/005/006/008` 全部 passed；
- Artifact consistent/complete，Pack 最终 `pnpm verify` 通过。

### ERA-PROD-002：非法消息 ID 和回滚 ID 未在 UI 本地拦截

- 状态：`confirmed`
- 优先级：P1
- 对应测试：
  - `ERA-UI-SNAPSHOT-MID-004`
  - `ERA-UI-SNAPSHOT-MID-006`
  - `ERA-UI-ACTION-ROLLBACK-004`

用户操作：

- 在“按消息 ID 查询”中输入小数 `1.5`；
- 在“按消息 ID 查询”中输入超出安全整数范围的 `9007199254740992`；
- 在“回滚到”输入框中输入小数 `1.5`。

预期行为：

- UI 当场提示输入非法；
- 不向 ERA Service 发送查询或回滚请求；
- 不改变当前快照和变量状态。

实际行为：

- UI 仍发送了 `era:getSnapshotAtMId` 或 `era:forceSync`；
- 非法请求进入 Service 后才产生诊断。

初步判断：消息 ID 与回滚 ID 的 UI 校验没有要求“非负安全整数”。三条失败应作为
同一个根因修复，而不是三个独立 bug。

完成条件：

- 小数、负数、空值、非数字和超过 `Number.MAX_SAFE_INTEGER` 的值均在 UI 本地拒绝；
- 上述输入产生 0 次 Service 调用；
- `0` 和有效安全整数仍能正常查询或回滚。

### ERA-PROD-003：关闭悬浮球后仍挂载 UI 和监听器

- 状态：`confirmed`
- 优先级：P0
- 对应测试：`ERA-UI-LIFE-002`

用户操作：

1. 将设置 `开启悬浮球` 设为 `false`；
2. 重新启动 ERA UI；
3. 检查悬浮球、挂载点和事件监听器。

预期行为：

- 禁用时不挂载悬浮球；
- 不遗留 ERA UI 的 DOM、样式容器或监听器。

实际行为：

- 悬浮球仍然可见；
- 观察到 1 个挂载实例和 15 个活动监听器。

完成条件：

- 禁用启动时悬浮球不可见且 UI 资源归零；
- 再次启用并完整启动后只挂载一个实例；
- stop、pagehide 和热重载生命周期测试不回退。

### ERA-PROD-004：320px 宽手机上完整面板横向溢出

- 状态：`confirmed`
- 优先级：P1
- 对应测试：
  - `ERA-UI-LAYOUT-009`（亮色）
  - `ERA-UI-LAYOUT-010`（暗色）

用户操作：

1. 使用 `320×568` 触屏 viewport；
2. 打开 ERA 完整面板；
3. 滚动面板并检查展开层边界。

预期行为：

- 面板完全位于 viewport 内；
- 内容可以纵向滚动；
- 不应出现横向溢出或左右裁切。

实际行为：

- 展开层左边界约为 `x=-9`；
- `clipped=true`；
- `horizontalOverflow=true`；
- 亮色与暗色主题均复现。

说明：这是完整 ERA 面板的布局问题，与已经修复的 `ABOUT-002` 触屏外链命中问题
不是同一问题。

完成条件：

- 两条 320px 亮暗主题路径均通过；
- `375×812`、`812×375` 触屏及桌面 viewport 不回退；
- 200% zoom 下仍能访问全部功能。

## 4. 待独立复测的产品候选

### ERA-CAND-001：`updateByPath` 运算表达式被保存为普通字符串

- 状态：`candidate`
- 优先级：P1
- 对应测试：`API-BOUND-007`

调用过程：

1. 通过公开 API 将目标值替换为数字 `7`；
2. 再对同一路径提交文档化运算表达式 `+=2`。

预期行为：最终值为数字 `9`。

实际行为：最终值为字符串 `"+=2"`。

待确认事项：需要先核对当前公开 API 合同是否仍承诺解释 `+=2` 一类表达式。若承诺，
这是产品解析问题；若现行设计只支持普通替换，则应同步修改文档和测试合同，而不是修改
ERA 实现。

确认条件：使用当前 Pack 和当前生产 bundle 独立重跑 `API-BOUND-007`，同时核对公开
接口文档与 action 的 `era:writeDone`、最终变量快照。

### ERA-CAND-002：Swipe 切换或删除后变量可能未完成同步

- 状态：`excluded`
- 优先级：P0
- 对应测试：
  - `SEM-SRC-006`
  - `SEM-SRC-010`
  - `UI-SWIPE-003`
  - `UI-SWIPE-004`
  - `UI-SWIPE-005`
  - `UI-SWIPE-006`
  - `UI-SWIPE-008`

真实操作与旧 Artifact 结果：

| 操作                       | 预期           | 实际       |
| -------------------------- | -------------- | ---------- |
| 从 swipe A 切换到 B        | 变量为 B       | 仍为 A     |
| 删除含变量指令的历史消息   | 对应变量被撤销 | 仍保留 A   |
| 删除当前首项 swipe         | 同步到新的 B   | 仍为 A     |
| 删除当前中间项 swipe       | 同步到 C       | 仍为 A     |
| 删除当前末项 swipe         | 同步到 B       | 仍为 A     |
| 删除当前项之前的 swipe     | 同步到 C       | 仍为 A     |
| A→B→C 并逐次查看变量管理器 | 最终为 C       | 最终仍为 A |

为何暂不直接定性：这些旧路径确认了酒馆原生 `message_swiped` 或
`message_swipe_deleted` 事件已出现，但动作完成屏障可能只等待了酒馆事件，没有可靠
证明 ERA 的异步同步已完成。异常既可能是产品漏同步，也可能是观察过早。

初步根因归并：七条候选很可能属于同一个“消息拓扑变化后的 ERA 同步/结算”问题，
不应直接登记成七个独立产品 bug。

确认条件：

- 使用 action-addressed ERA settlement 证据重新执行七条路径；
- 明确区分事件已发出、ERA 已接纳、同步已结算和最终变量已更新四个阶段；
- 若结算已完成但变量仍为 A，则升级为 `confirmed`；
- 若只是观察早于结算，则修正 Pack completion contract，并保留产品不变。

最终结论：ERA-PROD-001 修复后的完整独立回归中，上述七条路径全部 passed，未再复现
“最终仍为 A”。该候选不再作为当前开放产品问题；保留回归路径防止后续复发。

### ERA-CAND-003：切换已有 Swipe 后 regenerate 最终变量为空

- 状态：`candidate`
- 优先级：P0
- 对应测试：`UI-SWIPE-010`

用户操作：先准备 A/B/C 三个 Swipe，切换到已有 Swipe B，然后从酒馆真实菜单执行
regenerate；Response Lab 返回包含 `VariableEdit` 的完整非流式回复。

预期行为：生成完成后变量为 `{"ui_swipe":{"branch":"regenerated-after-b"}}`。

实际行为：`generation_started → message_received → generation_ended` 均已出现，provider
请求也正常完成，但最终 `stat_data={}`。

为何暂列候选：需独立复测，区分 ERA regenerate 同步/解析缺陷、消息来源规则与测试
fixture 语义；不得仅凭聚合 run 的单个样本直接修改核心逻辑。

## 5. 已解决或已排除项目

| 项目                              | 状态       | 结论                                                           |
| --------------------------------- | ---------- | -------------------------------------------------------------- |
| 重新生成请求在 ERA 回退变量前开始 | `fixed`    | 已在提交 `ad6a7c7` 中增加 regenerate barrier 并完成相关验证    |
| `ABOUT-002` 极窄触屏外链命中问题  | `fixed`    | 已修复右栏适配并单独重测通过                                   |
| 点号键显示为 `__DOT__`            | `excluded` | 这是内部持久化编码；公开事件和查询结果会还原正常键名           |
| 空字符串路径                      | `excluded` | 按当前 ERA 合同表示根对象，不是非法路径                        |
| 数组嵌套更新                      | `excluded` | ERA 明确不支持数组操作，不纳入产品缺陷                         |
| 第二开场白切换                    | `excluded` | `UI-NAV-004` 独立真实重测 passed                               |
| PNG 图片附件生成                  | `excluded` | `UI-GEN-013` 修正 Pack 证据路径后独立真实重测 passed           |
| WAV 音频附件生成                  | `excluded` | `UI-GEN-014` 修正 Pack 证据路径后独立真实重测 passed           |
| 旧回归中的其余 Pack failed        | `excluded` | 已确认属于 oracle、fixture、编码层级或证据路径问题，不修改 ERA |

## 6. 建议处理顺序

1. `ERA-CAND-003`：独立复测已有 Swipe 后 regenerate 的变量结算；
2. `ERA-PROD-003`：修复禁用状态和生命周期所有权；
3. `ERA-PROD-002`：统一消息 ID/回滚 ID 输入校验；
4. `ERA-PROD-004`：修复 320px 完整面板响应式布局；
5. `ERA-CAND-001`：核对公开 API 合同后决定修产品或修文档。

## 7. 修复记录要求

每个问题解决时应在对应条目追加：

- 根因；
- 修改文件和提交；
- 新增或更新的产品单元/集成测试；
- ERA-Test-Pack 定点真实 run ID；
- recording、evaluation 和 Artifact audit 结果；
- 是否影响其他 combo、API 或 UI 路径。

只有产品测试与真实酒馆定点测试均通过后，才能把 `confirmed` 改为 `fixed`。历史失败
Artifact 保留，不回写或删除。

## 8. 证据入口

- ERA-Test-Pack 0.3.0 最终报告：
  `/home/example/projects/酒馆开发目录/测试工具链/ERA-Test-Pack/docs/test-runs/2026-08-13-era-0.3-regression/最终报告.md`
- p2 完整 Artifact：
  `/home/example/projects/酒馆开发目录/测试工具链/本地运行资料/live/artifacts-v4/st-run-20260812T20091306-c825b6e813a7`
- UI 专项 Artifact：
  `/home/example/projects/酒馆开发目录/测试工具链/本地运行资料/live/artifacts-v4/st-run-20260812T21143063-fb11fc708cf3`
