# ERA 历史产品问题台账

> 状态：历史修复与排除记录
>
> 建立日期：2026-08-13
>
> 依据：ERA-Test-Pack 0.3.0 真实酒馆回归、ERA UI 专项回归及后续独立重测

## 1. 文档目的

本文保存已经修复、排除或被新基线接管的问题历史。当前仍开放的缺陷、用户可见表现、
最新测试证据与修复验收条件统一维护在 [`ERA当前缺陷基线.md`](ERA当前缺陷基线.md)。

台账严格区分：

- **已确认**：已有完整执行证据，当前可以作为产品缺陷处理；
- **待独立复测**：旧 Artifact 仍显示异常，但可能受到异步结算时机或产品合同解释影响；
- **已解决或已排除**：不得继续计入当前产品缺陷。

历史 suite 的 `failed` 数量不能直接当成产品 bug 数量。ERA-Test-Pack 已确认并修复
多项 oracle、fixture 和证据路径问题；不得从本文的历史描述重新推导当前开放状态。

## 历史 bundle 完整回归快照（2026-08-20）

- Bundle SHA-256：`6c8fe7b370bee747ae76babb9ff17679041a4e5e4b21637973a873543e952e71`。
- 独立 run：`st-run-20260820T09422060-7133ecc3d902`，`era-regression-all` 372/372
  recording completed、372 个 required evaluation 均终态；370 passed、2 inconclusive、0 failed/error。
- Artifact audit：`consistent/complete`，issues=[]；Pack `pnpm verify` 也在 run 后通过。
- 当前未检出新的 ERA 产品断言失败。两个 Swipe→regenerate 路径因实际 event interval
  为 658.6ms/659.7ms、未满足 `<600ms` 覆盖前置条件而 inconclusive；两条 provider prompt
  均仍使用正确的 `previous_floor`，不升级为产品问题。

## 2. 状态定义

| 状态        | 含义                                     | 后续动作                     |
| ----------- | ---------------------------------------- | ---------------------------- |
| `confirmed` | 产品行为与明确预期不符，且证据完整       | 分析根因、制定修复并定点回归 |
| `candidate` | 有真实异常证据，但尚未排除时序或合同歧义 | 先独立复测，不直接改产品     |
| `fixed`     | 已修改产品，并有对应验证证据             | 保留回归测试防止复发         |
| `excluded`  | 属于测试误判、明确设计边界或不支持功能   | 不修改产品                   |

## 3. 历史已确认问题及处置

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

- 状态：`fixed`
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

根因：消息 ID 与回滚 ID 的 UI 校验只判断 `null` 和负数，而 Vue 的 `v-model.number`
只负责尽量把文本转换为数字，不能保证结果是整数或处于 JavaScript 安全整数范围内。
因此小数和超安全整数会被直接放入 Service payload。

修复：新增共享的 UI 消息 ID 守卫，只有运行时值满足 `typeof value === 'number'`、
`Number.isSafeInteger(value)` 且 `value >= 0` 时才允许构造查询或回滚请求；两个数字输入框
同时增加 `min=0` 和 `step=1` 改善浏览器交互，但不依赖 HTML 属性作为业务安全边界。

2026-08-14 使用修复后生产 bundle（SHA-256：
`4c8205e3f26aa2739c169831331fea73a363ecbd326cc8ced3da734df0ae99f7`）独立真实重测：

- `ERA-UI-SNAPSHOT-MID-004`：run `st-run-20260813T16585521-3ea42b8ff485`，passed，
  小数 `1.5` 产生 0 次 Service 调用；
- `ERA-UI-SNAPSHOT-MID-006`：run `st-run-20260813T16594905-b8d50a46d169`，passed，
  超安全整数产生 0 次 Service 调用；
- `ERA-UI-ACTION-ROLLBACK-004`：run `st-run-20260813T17004089-e2bfd5212559`，passed，
  小数 `1.5` 产生 0 次 Service 调用；
- 合法边界 `ERA-UI-SNAPSHOT-MID-001` 与 `ERA-UI-ACTION-ROLLBACK-001` 均 passed，
  ID `0` 各自精确提交 1 次正确 Service 调用；
- 五个 run 均为 recording completed、evaluation passed、Artifact audit consistent/complete。

产品门禁：app `pnpm verify` 全部通过，31 个测试文件、267/267 测试通过；production build
成功。最终结论：本问题已修复。

### ERA-PROD-003：关闭悬浮球后仍挂载 UI 和监听器（已排除）

- 状态：`excluded`
- 优先级：P0
- 对应测试：`ERA-UI-LIFE-002`

用户操作：

1. 将设置 `开启悬浮球` 设为 `false`；
2. 重新启动 ERA UI；
3. 检查悬浮球、挂载点和事件监听器。

预期行为：

- 禁用时不挂载悬浮球；
- 不遗留 ERA UI 的 DOM、样式容器或监听器。

旧测试观察：

- 悬浮球仍然可见；
- 观察到 1 个挂载实例和 15 个活动监听器。

2026-08-14 根因复核：ERA-Test-Pack 的 Browser Pack 在顶层页面执行，却使用该上下文的
`getScriptId()` 写入 `boot.settings`；ERA bundle 则运行在角色卡 loader 脚本上下文，读取
loader 自己的 script ID。两者并非同一个脚本变量槽。因此旧测试显示的
`开启悬浮球=false` 只是 Driver 内部目标配置，ERA 实际读到空设置并采用默认值 `true`。

ERA 产品启动链本身已经在启动 UI 前刷新脚本设置，并在值严格等于 `false` 时直接返回
`mounted=false`。Pack 随后改为使用 loader controller 暴露的精确 `scriptId` 写入设置，立即
从同一变量槽回读并严格比对；任何作用域、写入或回读异常均以
`ERA_UI_DRIVER_PROTOCOL` 终止，不能再伪装为产品 failed。

2026-08-14 使用同一生产 bundle 独立真实重测：

- run：`st-run-20260813T16461099-9ded142a5daf`；
- recording：1/1 completed；evaluation：1/1 passed；
- `settingsTarget.verified=true`、`bootSettingsVerified=true`；
- 悬浮球计数 0、`mountCount=0`、`styleContainerCount=0`；
- `eraStorePresent=false`、`switchViewPresent=false`；
- 14 个活动 listener 均为 Service/macro 的公共 `era:*` 接口，旧样本多出的 UI
  `era:writeDone` listener 已消失，`staleListenerCount=0`；
- Artifact audit 为 `consistent/complete`，issues=[]。

最终结论：关闭悬浮球时 ERA 没有挂载 UI 自有 DOM、样式或 listener。旧 failed 完全由
Pack 写错脚本变量作用域造成，不属于 ERA 产品缺陷；ERA 源码和生产 bundle 无需修改。

### ERA-PROD-004：320px 宽手机上完整面板横向溢出

- 状态：`fixed`
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

修复前行为：

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

修复记录（2026-08-14）：

- 根因：旧 mount point、`.era-app-container` 和子级 fixed 定位重复争夺 viewport；同时
  `92vw`、面板/右栏 `min-width` 与窄屏高度规则互相冲突。SillyTavern 移动端的 body
  fixed 包含块还会让嵌套 fixed 悬浮球随页面滚动产生负坐标。
- 产品修复：mount point 成为唯一 fixed viewport 根，App 在其内铺满；桌面左右并排，
  992px 以下上下堆叠；左面板、右栏和 accordion 分别独立滚动；极窄屏内部控件允许
  收缩、换行或两行布局；删除未引用的旧 `ExpandedView.vue`。
- ERA 门禁：`pnpm verify` 通过，31 个测试文件、267/267 单测通过，质量基线 0 新增、
  0 恶化；production build 通过。
- ERA-Test-Pack：升级至 0.3.1，增加严格布局 subject、组件几何、命中和四级滚动终态
  证据；55/55 合同测试通过。
- 定点 run：`st-run-20260813T18531350-06afebbe9a06`，`ERA-UI-LAYOUT-009`
  recording/evaluation 均通过，Artifact `consistent/complete`。
- visual run：`st-run-20260813T18191762-a3b36d61f8a1`，18/18 recording 完成；12 条
  LAYOUT 与两条 ABOUT 全部 passed，4 条 ADAPT 仅因透明/渐变背景对比度无法自动证明
  而 inconclusive，0 failed。
- 最终 UI 全量 run：`st-run-20260813T18553243-3946bf8fb2f5`，101/101 recording
  completed、582 个 action 完整记录；evaluation 为 97 passed、4 inconclusive、0 failed。
  4 条 inconclusive 仍仅为 `ERA-UI-ADAPT-001`～`004` 的透明/渐变背景对比度不可证明；
  12 条 LAYOUT、`ABOUT-002` 及其余功能路径全部 passed。101 个 required evaluation
  均有终态，Artifact audit 为 `consistent/complete`、issues=[]。
- 最终 bundle SHA-256：`7b4fda393b816dd5d3c81372b7021719fb03231b8a62d84ce4ef1cc537dd72d4`。

当前仍开放的 `ERA-PROD-005` 已与首帧、多楼和旧聊天恢复三种表现统一归档到
[`ERA当前缺陷基线.md`](ERA当前缺陷基线.md)，不在历史台账重复维护。

## 4. 历史候选及处置

### ERA-CAND-001：JSON 相对数值更新

- 状态：`fixed`
- 优先级：P1
- 对应测试：`era-relative-update` 16 条专项路径

确认后的功能合同：

1. `VariableEdit` 、`updateByObject` 和 `updateByPath` 共享 `$inc/$mul/$div`
   JSON 终端运算对象；
2. `$inc` 的负数表示减法，`$div` 的除数不得为零；
3. 运算数、当前值和结果必须是有限数字，无效字段跳过但不影响合法兄弟字段；
4. `"+=2"`、`"-=2"`、`"*=2"`、`"/=2"` 明确保持普通字符串赋值，不建立兼容解析。

实现结果：运算只在共享 CRUD 引擎中解析；EditLog 保存具体旧值/新值；
full sync 和 Swipe 重算保留消息中的原始运算意图；无效运算通过四个
`ERA_EDIT_*` 诊断码进入既有任务结果。

修复验证（2026-08-14）：

- ERA 的 VibeFlow architecture/check、validate、quality、review、browser build，及 app
  `pnpm verify`（276/276 单测）和 `test:integration` 均通过；
- Pack 0.4.0 `pnpm verify` 通过（58/58 合同测试）；
- 专项 `era-relative-update` run `st-run-20260814T04494864-02b2e33179cb`：16/16
  recording completed、16/16 evaluation passed，Artifact `consistent/complete`；
- AI、API、无效诊断、full replay、Swipe 重算五条独立重测均 passed；
- 聚合 run `st-run-20260814T05033257-2aca0d402bd4`：379/379 recording completed、
  379 个 required evaluation 终态、Artifact `consistent/complete`。新增 16 条 REL 全部
  passed；初次运行的 `API-BOUND-007` 和 `SEM-SRC-003` 是旧字符串/用户消息的 Pack oracle
  遗留假设，已修正后分别以 `st-run-20260814T06434633-6a8b8f83c036` 和
  `st-run-20260814T06442328-a3b44b1be6b2` 独立通过，不属于产品问题；
- 最终 production bundle SHA-256：
  `a15c154a3e7c84d532f03fb2996f11b05084b4be549aed28c741cee6da4fc983`。

最终结论：JSON `$inc/$mul/$div` 相对更新及其无效输入、历史重算、API 和旧字符串边界
均已真实验证；该功能扩展不再是开放候选。

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

- 状态：`excluded`
- 优先级：P0
- 对应测试：`UI-SWIPE-010`

用户操作：先准备 A/B/C 三个 Swipe，切换到已有 Swipe B，然后从酒馆真实菜单执行
regenerate；Response Lab 返回包含 `VariableEdit` 的完整非流式回复。

预期行为：生成完成后变量为 `{"ui_swipe":{"branch":"regenerated-after-b"}}`。

实际行为：`generation_started → message_received → generation_ended` 均已出现，provider
请求也正常完成，但最终 `stat_data={}`。

最终结论：测试回复错误使用了“只改不增”的 `VariableEdit`，而 regenerate 栅栏已正确
回退旧回复状态，新回复上的 `ui_swipe.branch` 当时并不存在，因此 ERA 按合同跳过写入。
ERA-Test-Pack 已将回复改为 `VariableInsert` 并增加防回归合同。使用同一生产 bundle 的
独立真实 run `st-run-20260813T16243535-0bde25b9f463` 已 1/1 passed、14 个 action 完整，
Artifact audit 为 `consistent/complete`。该候选不属于产品缺陷。

`ERA-CAND-004` 已由 `STATUSBAR-EXAMPLE-037` 及其 integrated owner 的完整自动证据升级为
`ERA-PROD-005` 的已确认首帧表现，现行结论见 [`ERA当前缺陷基线.md`](ERA当前缺陷基线.md)。

## 5. 已解决或已排除项目

| 项目                              | 状态       | 结论                                                             |
| --------------------------------- | ---------- | ---------------------------------------------------------------- |
| 重新生成请求在 ERA 回退变量前开始 | `fixed`    | 已在提交 `ad6a7c7` 中增加 regenerate barrier 并完成相关验证      |
| 非法消息 ID 和回滚 ID 穿透 UI     | `fixed`    | 共享安全整数守卫；三条非法与两条 ID 0 路径真实重测 passed        |
| `ABOUT-002` 极窄触屏外链命中问题  | `fixed`    | 已修复右栏适配并单独重测通过                                     |
| 点号键显示为 `__DOT__`            | `excluded` | 这是内部持久化编码；公开事件和查询结果会还原正常键名             |
| 空字符串路径                      | `excluded` | 按当前 ERA 合同表示根对象，不是非法路径                          |
| 数组嵌套更新                      | `excluded` | ERA 明确不支持数组操作，不纳入产品缺陷                           |
| 第二开场白切换                    | `excluded` | `UI-NAV-004` 独立真实重测 passed                                 |
| PNG 图片附件生成                  | `excluded` | `UI-GEN-013` 修正 Pack 证据路径后独立真实重测 passed             |
| WAV 音频附件生成                  | `excluded` | `UI-GEN-014` 修正 Pack 证据路径后独立真实重测 passed             |
| 已有 Swipe 后 regenerate 变量为空 | `excluded` | 场景误用 `VariableEdit`；改为 `VariableInsert` 后真实重测 passed |
| 关闭悬浮球后仍挂载 UI             | `excluded` | Pack 修正脚本变量作用域并加强判定后独立真实重测 passed           |
| 旧回归中的其余 Pack failed        | `excluded` | 已确认属于 oracle、fixture、编码层级或证据路径问题，不修改 ERA   |

## 6. 当前处理顺序

开放问题的优先级和修复验收只在 [`ERA当前缺陷基线.md`](ERA当前缺陷基线.md) 维护。

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
