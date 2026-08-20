# ERA 前台 UI 专项测试需求

> 状态：专项验证完成
> 更新日期：2026-08-20
> 适用范围：`app/src/ERA变量框架/ui` 当前生产 UI，以及它与 ERA Service、Tavern 宿主之间的可观察交互

## 1. 文档目的

本文定义 ERA 前台 UI 应当具备的专项测试，不把“面板能够打开”当成完整 UI 验收。

## 本轮验证结果

- 功能专项：75/75 通过；Artifact `st-run-20260820T05524707-be90d18274b3`。
- 视觉与手机触屏专项：11/11 通过；Artifact `st-run-20260820T06071210-326e5870f210`。
- 生命周期与样式所有权：8 条单路径、单 worker 全部通过；Artifact 位于
  `reports/ui-special-20260820/artifacts/`。
- 最终 Artifact 均为 `consistent / complete`；本轮未运行两小时长稳。
每项功能均说明：如何从用户界面进入、如何操作、界面应出现什么结果，以及必要时
Service、公共事件和宿主状态应出现什么结果。

本文中的“预期”代表产品应达到的目标行为。若当前实现与预期不符，测试应如实失败并
登记缺陷，不能把现有缺陷反向写成正确规格。本文不要求也不触发两小时长稳；该测试只有
在用户以后直接、明确要求时才运行。

## 2. 审阅范围与组件意图

本需求基于对当前 21 个 UI 源文件的完整审阅，并结合 ERA Test Harness 的
`USAGE_GUIDE.md`、`CATALOG_DEVELOPMENT_GUIDE.md`、现有 ERA UI catalog 和
Playwright adapter 得出。

| 源码区域                                                                    | 当前意图                                                                         |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ui/index.ts`、`store.ts`、`utils/dom.ts`                                   | 挂载/卸载 Vue 与 Pinia，保存最后一次 `era:writeDone`，管理 DOM、样式和热重载资源 |
| `App.vue`、`FloatingBall.vue`、`RightRail.vue`                              | 右下悬浮球、展开视图、左右栏布局和视图切换                                       |
| `EraPanel.vue`、`MetaHeader.vue`、`OperationDetails.vue`                    | 最新 ERA 状态、消息元数据、SelectedMks 和 EditLogs 展示                          |
| `SnapshotManager.vue`                                                       | 按 MK 或消息 ID 查询历史快照，切换纯净/完整数据                                  |
| `ActionButtons.vue`                                                         | 完全重算、最后一楼重算、定向回滚和资源快速初始化                                 |
| `EraSettingsPanel.vue`、`ThemeManager.vue`                                  | 设置读取、编辑、保存、失败回滚和明暗主题                                         |
| `EraAccordion.vue`、`PrettyJsonViewer.vue`、`JsonNode.vue`、`TabSwitch.vue` | 折叠、JSON 树与页签等通用交互                                                    |
| `AboutEra.vue`                                                              | 作者、群号和外部链接                                                             |
| `ExpandedView.vue`、`processing/panel-data.ts`、`patch.ts`                  | 未进入当前生产依赖图的遗留实现，不作为现行用户功能                               |

专项 UI 由 `ERA-Test-Pack` 的受限 UI driver 和 `era-ui-*` suite 承载：catalog 只能
表达受限的语义动作、profile 和预期，不能携带 selector、任意脚本或任意事件名。Harness
为每条 path 保存截图、DOM、receipt、settlement、公共事件与宿主状态；Evaluator 只读取
冻结 Artifact，不读取旧 Artifact 或产品源码。

## 3. 测试口径

### 3.1 优先级

| 级别 | 含义                                                   |
| ---- | ------------------------------------------------------ |
| P0   | 用户主路径或数据安全路径；失败时 UI 不应进入发布候选   |
| P1   | 错误恢复、边界、生命周期和适配性；完整 UI 验收必须通过 |
| P2   | 视觉细节、交互适配和防御性场景；不得静默退化           |

### 3.2 自动化状态

| 标记     | 含义                                                     |
| -------- | -------------------------------------------------------- |
| 已有基础 | 现有 Harness action 可复用，但通常需要增加断言           |
| 需扩展   | 需要新增 ERA pack-owned action、collector 或 Evaluator   |
| 组件级   | 适合在 `app` 内使用浏览器 DOM 环境做快速隔离测试         |
| 已知缺口 | 理论预期合理，但当前源码预计不能通过；测试应保留失败证据 |

### 3.3 通用测试环境

- 使用隔离的 SillyTavern 1.18.0、Tavern Helper 4.8.19 和当前 ERA 生产 bundle。
- Harness 每条 path 使用独立 sandbox 和独立 loopback origin；普通 selector 驱动路径可用
  4 workers，并继续遵守“普通用例失败不停止其他用例”。
- 不读取旧 Artifact，不在运行时做新旧结果比较；正确性由本文和当前 catalog 的显式
  expected 判断。
- 交互边界固定为桌面鼠标主路径与手机触屏兼容；不验收键盘/读屏/ARIA、浏览器缩放、
  `prefers-reduced-motion` 或 WCAG 对比度。桌面只保留一个基准 viewport，跨设备适配
  只覆盖声明为触屏的手机 profile。
- 每个操作至少保存 before/after screenshot、DOM 摘要、console/pageerror、ERA
  入站 receipt、settlement、公共事件和相关变量快照。
- 视觉基准覆盖桌面 1440×900，以及手机触屏 375×812、320×568 和对应横屏；每类有
  亮色和暗色代表路径。

### 3.4 标准数据夹具

专门 UI fixture 应提供：

- 至少 5 条消息，消息 ID 包含 `0`，并同时有用户与 AI 消息；
- 可预测的 `SelectedMks`，其中包含最新 MK、历史 MK 和一个 null 位置；
- `stat` 与 `statWithoutMeta` 的差异可见，且包含对象、数组、空值、中文、长文本和
  `__proto__`、`constructor`、`prototype` 等安全保留键；
- 至少两组 EditLogs，操作顺序可核对；
- 一组可成功查询的历史快照、一组不存在的 MK/消息 ID；
- 默认设置、资源未初始化、资源已初始化和同名冲突四类宿主状态。

## 4. 功能测试需求

### 4.1 UI 启用、启动与停止

**用例：UI-LIFE-001～004（P0/P1，需扩展）**

前置状态：分别令脚本设置 `开启悬浮球=true` 与 `false`，并保证页面中没有旧 ERA
挂载点。

进入路径：整页加载或热重载 ERA；该功能没有面板内入口。

UI 操作：

1. 在 `true` 配置下加载页面；
2. 在 `false` 配置下重新加载页面；
3. 对启用状态连续执行 10 次 ERA 热重载；
4. 触发 pagehide/完整 stop，再发送迟到的 `era:writeDone` 与 `era:queryResult`。

预期结果：

- 启用时，页面中恰有一个 ERA 挂载点和一个悬浮球，并只注册一套事件监听器；
- 禁用时不挂载 UI，也不留下不可见的监听器和样式容器；
- 热重载前先清理旧实例，10 次后仍只有一套 DOM、样式、监听器和全局调试入口；
- stop 幂等，完成后挂载点、ERA 自有样式、`window.eraUiStore`、
  `window.eraUiSwitchView` 和监听器均归零；
- 迟到事件不得更新已卸载组件或产生 toast/pageerror；
- 通过外部设置把 `开启悬浮球` 从 false 改为 true 后，当前设计允许在下一次完整启动时
  生效，不要求未加载的 UI 自行热挂载。

### 4.2 悬浮球展示、打开与关闭

**用例：UI-BALL-001～005（P0/P1，已有基础 + 需扩展）**

前置状态：UI 已启用，当前视图为悬浮球。

进入路径：在酒馆页面右下角找到“ERA”悬浮球。

UI 操作：

1. 桌面端依次移入、移出、点击悬浮球；
2. 点击左侧面板右上角关闭按钮，再次点击悬浮球；
3. 在手机触屏 profile 下重复打开、关闭与主要控件操作。

预期结果：

- 悬浮球固定在右下安全区域，桌面闲置时弱化、hover 时清晰，手机触屏时保持足够
  可见且可命中；
- 单击只打开一个展开视图，显示左侧“ERA 数据面板”和右侧功能栏；
- 关闭后恢复同一个悬浮球，不创建第二套组件；再次打开时，未卸载组件的本地编辑状态
  可以保留；
- 背景中非 ERA 区域不能被透明容器无故拦截。

设计边界：ERA 前台仅支持鼠标与触屏交互；键盘聚焦、`button`/`dialog` ARIA 语义、
Enter/Space/Escape 操作和焦点返回均不属于本专项验收范围。

### 4.3 首屏状态与实时 `writeDone` 更新

**用例：UI-DATA-001～004（P0，需扩展）**

前置状态：聊天中已经存在可读取的 ERA 状态；另准备一个尚未产生状态的空聊天。

进入路径：加载 UI 后点击悬浮球。

UI 操作：

1. 在有既存状态的聊天中首次打开；
2. 在空聊天中首次打开；
3. 面板打开、关闭两种状态下分别产生一次新的 `era:writeDone`；
4. 快速连续产生两个合法 payload。

预期结果：

- 有既存状态时，UI 挂载后应主动请求/恢复最新 `writeDone`，首次打开即可显示当前状态；
- 真正没有状态时才显示“等待 era:writeDone 事件数据…”；
- 新事件应整体替换 Pinia 中的旧 payload，面板只显示最后一次数据；
- 面板关闭期间仍接收事件，重新打开显示最新数据；
- 非法 payload 被边界校验拒绝并留下诊断，不能把面板更新成半结构数据。

实现约束：UI 挂载后经既有 `era:requestWriteDone` 请求 Service 回放；回放不直接读取
聊天变量。stop 后的迟到回放或事件必须被实例会话隔离。

### 4.4 消息元数据与最新操作详情

**用例：UI-PANEL-DATA-001～006（P0/P1，需扩展）**

前置状态：面板已经收到标准 `writeDone` fixture。

进入路径：打开悬浮球面板；展开“最新消息元数据”和“ERA 最新操作详情”。

UI 操作：

1. 展开/收起两个折叠区；
2. 检查长 MK、消息 ID `0`、用户消息和 AI 消息；
3. 展开 SelectedMks 与 EditLogs 的多层节点；
4. 产生新的 `writeDone` 后复查。

预期结果：

- 元数据精确显示完整 MK、message_id 和“用户/AI”；长 MK 可在视觉上省略，但 title
  保留完整值；ID `0` 不得被当成空值；
- SelectedMks 的下标、null 位置和顺序保持不变；EditLogs 的 MK、操作顺序和字段值
  与事件 payload 深度相等；
- 保留键和 HTML/script 字符串只作为文本显示，不执行 HTML、不改变对象原型；
- 空数组显示 `[]`，空对象显示 `{}`，大内容在内部滚动，不撑破面板；
- 新事件到达后字段同步更新，不残留上一个 payload。

范围说明：`actions` 和 `consecutiveProcessingCount` 当前没有可视控件，不在现行 UI
验收范围；若未来展示，应建立新用例，而不是修改本用例含义。

### 4.5 折叠、JSON 树与纯净/完整页签

**用例：UI-COMP-001～010（P1/P2，组件级 + Harness 需扩展）**

前置状态：准备含原始值、空对象、空数组、深层对象、数组 null、长键和保留键的数据。

进入路径：在最新操作详情或快照区域进入 JSON 查看器。

UI 操作：

1. 用鼠标和手机触屏展开/收起父子节点；
2. 在“纯净状态数据”和“完整状态数据”之间往返切换；
3. 更新父 payload；

预期结果：

- 折叠按钮的箭头和文字与实际展开状态一致；多个折叠区互不影响；
- 对象、数组、字符串、数值、布尔和 null 使用正确括号与颜色，收起摘要分别显示
  `Object{n}` 与 `Array[n]`；
- `maxDepth` 只控制初始展开深度，用户仍可继续展开；
- 页签点击后只显示对应数据，父级更新后内容立即刷新；重复点击当前页签不触发查询或
  数据重置；
- 页签可通过鼠标和触屏切换，当前选择状态清晰可见；JSON 展开按钮可通过鼠标和触屏
  操作；
- 任意字符串都只能以文本方式呈现；循环或非 portable 宿主对象必须在 DTO 边界被拒绝，
  不能造成无限递归。

说明：本项不要求页签或 JSON 节点提供键盘、焦点或 ARIA 验收证据。

### 4.6 最新快照与 MK 列表

**用例：UI-SNAPSHOT-LATEST-001～006（P0/P1，已有基础 + 需扩展）**

前置状态：`writeDone` 含多个 SelectedMks、一个 null 位置、最新 `stat` 和
`statWithoutMeta`。

进入路径：打开面板，在左侧快照管理器查看“按消息密钥(MK)查看”。

UI 操作：

1. 不改变默认选项，检查最新快照；
2. 展开下拉列表并核对每一项；
3. 切换纯净/完整页签；
4. 在 MK 不变但 stat 改变的情况下产生新 `writeDone`。

预期结果：

- 列表按 SelectedMks 逆序展示，消息编号仍对应原数组索引；最新项带“(最新)”；
- null 位置显示“无MK”但不能作为可查询目标，选择它不得让内容无解释地消失；
- 默认显示最新纯净状态；完整页签显示含 `$meta` 的完整状态；
- 同一 MK 的新 payload 到达时也必须刷新内容并清理过时查询状态；
- 最新来源身份直接使用 `WriteDonePayload.is_user`，不得再次读取 Tavern 原始消息推断。

实现约束：null MK 只作为列表信息显示而不可查询；任何新的 `writeDone` payload（即使
MK 不变）都会回到最新快照。最新身份直接使用 `WriteDonePayload.is_user`，不二次读取
Tavern 消息。

### 4.7 按 MK 查询历史快照

**用例：UI-SNAPSHOT-MK-001～007（P0/P1，已有基础 + 需扩展）**

前置状态：列表中至少有一个有效历史 MK、一个不存在的 MK 场景。

进入路径：打开面板，展开 MK 下拉列表。

UI 操作：

1. 选择一个非最新、非空 MK；
2. 等待查询返回并切换纯净/完整页签；
3. 查询不存在的 MK；
4. 重新选择最新 MK；
5. 分别注入 admission rejected、failed/ignored/cancelled settlement、Promise reject
   和 accepted 后无结果超时。

预期结果：

- 每次选择只提交一次 `era:getSnapshotAtMk`，参数精确为 `{mk}`、source 为 `ui`；
- 查询期间显示“正在加载快照...”，成功后显示返回快照并同步选中返回 MK；
- 未找到时清除旧历史数据，显示含目标 MK 的“未找到”提示；
- 选择最新 MK 不发新查询，并立即恢复最新 payload；
- 拒绝、非 completed、reject 和超时都结束 loading、给出可理解错误，且用户可以再次查询；
- 只有匹配当前请求的 `era:queryResult` 能改变结果。

### 4.8 按消息 ID 查询历史快照

**用例：UI-SNAPSHOT-MID-001～009（P0/P1，需扩展）**

前置状态：准备存在的 ID `0`、普通 ID、已删除/不存在 ID 和超范围 ID。

进入路径：打开面板，在“按消息ID查看”输入框输入值。

UI 操作：

1. 输入有效 ID 后点击“查找”；
2. 依次输入 `0`、空值、负数、小数、NaN 文本、科学计数法和超出安全整数范围的值；
3. 查询不存在的 ID。

预期结果：

- 非负安全整数提交一次 `era:getSnapshotAtMId`，参数为 `{message_id}`；ID `0` 有效；
- 查询开始时取消 MK 选择、清除旧结果和错误；成功后显示快照并同步其 MK；
- 空值、负数、小数、非数字和非安全整数在 UI 本地被拒绝，不提交 Service，并显示
  “请输入有效的非负整数消息 ID”；
- 不存在时清除旧结果并显示含目标 ID 的未找到提示；
- 点击“查找”后才发起查询；输入本身不得意外发起查询。

实现状态：UI 已统一通过共享守卫校验非负安全整数；小数、NaN、空值和非安全整数不会
构造 Service 请求。

### 4.9 快照并发、迟到和无关响应

**用例：UI-SNAPSHOT-RACE-001～005（P0，需扩展）**

前置状态：测试 adapter 能控制多个查询的返回顺序。

进入路径：打开快照管理器。

UI 操作：

1. 先查 MK，立即改查消息 ID，让旧 MK 响应迟到；
2. 连续查询两个不同 ID，并逆序返回；
3. 当前查询期间发送其他脚本产生的无关 `era:queryResult`；
4. 对同一个 MK/ID 连续查询两次并逆序返回；
5. 查询期间产生新的 `writeDone`。

预期结果：

- 只有当前请求的结果可以结束当前 loading、修改 error 或覆盖快照；
- 迟到和无关结果被忽略并记录诊断，不得提前隐藏 loading；
- 同参数并发也必须有内部关联策略，旧响应不得覆盖新响应；
- 新 `writeDone` 后界面应明确回到最新状态，或明确保留历史查看模式，不能把新元数据与
  旧快照混合；本版目标统一为回到最新状态并取消旧查询。

实现约束：每次异键查询都有本地递增世代，只有当前世代、类型与规范化请求键同时匹配的
结果才可改变界面。公开 ABI 未提供 request ID，因此同键请求在未终态时不得重复入队。

### 4.10 完全重算与最后一楼重算

**用例：UI-ACTION-SYNC-001～010（P0/P1，需扩展）**

前置状态：准备可预测的错误变量状态、最新 AI 消息、最新用户消息和空聊天。

进入路径：打开面板，在右侧“快捷操作”找到“完全重算变量”或“重算最后一楼变量”。

UI 操作：

1. 点击“完全重算变量”；
2. 点击“重算最后一楼变量”；
3. 在最新为用户消息、空聊天、无 ERA 数据的消息下执行最后一楼重算；
4. 注入 Service 各类失败，并快速双击按钮。

预期结果：

- 完全重算只提交一次 `era:forceSync`，参数 `[{mode:'full'}]`；最后一楼只提交一次
  `era:forceSync`，参数 `[{mode:'latest'}]`；source 均为 `ui`；
- 控件在 pending 时显示忙碌并阻止同一操作重复提交；
- 只有 accepted 且 settlement `completed` 后显示成功 toast；后续 `writeDone` 更新
  左侧面板，最终变量与同步语义一致；
- admission rejected、failed、ignored、cancelled 或 Promise reject 均显示失败，不直接
  修改变量，不显示成功；
- 用户消息、空聊天等特殊语义由 Service 决定为 completed/no-op/failed，UI 只准确呈现
  结算，不自行伪造结果。

实现约束：所有快捷操作共享一个 busy 锁；只允许第一个动作入队，且仅 completed 能显示
成功。等待超过 30 秒后只恢复按钮与显示失败，不撤销已入队工作。

### 4.11 定向回滚

**用例：UI-ACTION-ROLLBACK-001～010（P0/P1，需扩展）**

前置状态：准备 ID `0`、历史有效 ID、最新 ID、已删除 ID 和超范围 ID。

进入路径：快捷操作中的“消息 ID”输入框和“回滚到”按钮。

UI 操作：

1. 输入各有效 ID 后点击按钮；
2. 输入空值、负数、小数、NaN 文本、科学计数法和超大整数；
3. 对不存在/已删除 ID 操作；
4. pending 期间快速双击。

预期结果：

- 只允许非负安全整数；有效值提交一次 `era:forceSync`，参数为
  `[{mode:'rollbackTo', message_id:<id>}]`；
- completed 后 toast 精确指出目标 ID，`writeDone` 和最终变量反映该楼处理完毕后的状态；
- 本地非法输入不提交 Service，只显示输入警告；
- 不存在、已删除或 Service 失败不改变已提交状态、不显示成功；
- pending 时同一按钮不重复提交。

实现状态：本地 ID 校验已覆盖非负安全整数；pending 期间的按钮防重入仍需按 4.10 的
统一 busy 规则验收。

### 4.12 ERA 快速初始化

**用例：UI-ACTION-INIT-001～008（P0/P1，需扩展）**

前置状态：分别准备新角色、资源已存在、同名非 ERA 资源、群聊、无角色和资源写入故障。

进入路径：快捷操作中的“ERA 快速初始化”。

UI 操作：

1. 在新角色上点击一次；
2. 在同一角色上再次点击；
3. 在已有/冲突/群聊/无角色场景点击；
4. 注入读写、取消和部分/未知提交故障。

预期结果：

- UI 只提交一次 `era.ui.initialize_resources`、空参数、source `ui`，不直接调用世界书
  或正则 API；
- completed 后才显示“初始化完成”；预期资源为隐藏正则、状态栏模板、变量操作规则和
  变量意图说明，具体命名与覆盖规则由 Service 现行契约决定；
- 重复初始化幂等，不增加重复世界书条目或正则；
- 冲突、无身份或失败场景显示明确失败，不把部分写入伪报为成功；未知/部分提交由
  Service 升级 fatal，UI 停止继续操作并展示服务不可用状态；
- pending 时按钮防重复。

### 4.13 设置读取、编辑与丢弃

**用例：UI-SETTINGS-001～012（P0/P1，需扩展 + 组件级）**

前置状态：默认设置已写入；另准备空设置和读取异常组件 fixture。

进入路径：展开右栏“ERA 设置”。

UI 操作：

1. 首次展开、收起后重开、点击“重新读取”；
2. 修改布尔、数字和字符串设置但不保存；
3. 点击“丢弃修改”；
4. 在组件级 synthetic fixture 中编辑对象、数组、null 和非法 JSON。

预期结果：

- 设置默认收起，箭头与实际展开状态一致；首次展开读取当前 settings；
- 显示 7 个可编辑项：尾部特殊符号、特殊符号值、黑夜模式、强制重载功能、强制重载
  消息数、繁体转简体和调试模式；`开启悬浮球` 不在已打开 UI 中出现；
- boolean、有限 number、string 分别使用开关、数字框、文本框，类型徽标正确；
- 未保存编辑只存在组件本地，不能提前改变脚本设置；关闭/重开面板时可保留，重新读取
  才以宿主已提交值覆盖；
- 丢弃后恢复宿主当前已提交值，不调用 Service 写入，并只给出一次明确的完成反馈；
- 空设置显示占位和 app_ready 提示，读取异常显示失败反馈；
- JSON 组件分支中，合法 JSON 显示有效，空白/非法 JSON 显示错误且保存前本地拒绝。

实现约束：丢弃只读取当前宿主设置并给出一次完成反馈；不提交 Service 写入。

### 4.14 设置保存、失败回滚与实时主题

**用例：UI-SETTINGS-SAVE-001～012、UI-THEME-001～006（P0/P1，需扩展）**

前置状态：分别以亮色和暗色启动，并可注入 Service 结算结果。

进入路径：展开“ERA 设置”，修改一个或多个值。

UI 操作：

1. 修改多个设置并点击“保存修改”；
2. 切换“开启黑夜模式”并保存；
3. 注入 schema error、admission rejected、failed/ignored/cancelled、Promise reject；
4. 保存期间快速重复点击；
5. 保存后重载页面复查持久化。

预期结果：

- 保存前先合并完整设置并通过 SettingsSchema；只提交一次
  `era.ui.update_settings`，参数为 `[{settings: nextSettings}]`、source 为 `ui`；
- 只有 completed 后更新本地基准并显示成功；重载后值仍存在；
- 主题只在 Host 提交成功并发出 `era-settings-updated` 后实时切换，失败保存不切换；
- 失败后 rows、简单编辑缓存、JSON buffer 和 JSON 校验状态全部恢复到保存前已提交值，并可
  直接修正后重试；脚本变量不得部分改变；
- pending 时保存按钮有忙碌状态并防止重复提交；
- 亮/暗主题下所有 ERA 控件可读，切换主题不得改变 ERA 根之外 Tavern 元素的 computed
  style。

实现约束：保存使用同一 receipt 等待工具和 busy 锁；失败或超时必须重建全部编辑缓存与
JSON 校验状态。主题变量只落在 ERA 根，只有已提交设置触发的 `era-settings-updated` 可切换主题。

### 4.15 关于 ERA 与外部链接

**用例：UI-ABOUT-001～004（P2，需扩展）**

前置状态：展开主界面。

进入路径：滚动右栏到底部“关于 ERA”。

UI 操作：

1. 核对作者和交流群信息；
2. 在鼠标和触屏 profile 下检查 GitHub、Discord 链接的可见性与命中区域；
3. 静态读取链接目标和安全属性，不触发或拦截外部导航。

预期结果：

- 显示作者“世界的山田”和群号 `1006127516`；
- 外链静态声明 `target="_blank"` 与 `rel="noopener noreferrer"`；本专项不实际打开新页；
- 链接文字清晰可见，鼠标和触屏均可命中；
- GitHub 应指向经产品确认的现行 ERA 公开主页。当前链接仍指向旧
  `ERA-EfficientRollbackArchitecture`，在确定新公开地址前只校验链接安全性，不把旧
  URL 固化为长期 expected。

### 4.16 响应式布局、滚动与视觉状态

**用例：UI-LAYOUT-001～012（P1/P2，已实现）**

前置状态：面板含长 JSON、长设置列表，分别使用亮/暗主题。

进入路径：打开悬浮球面板，并展开操作详情和设置。

UI 操作：

1. 在桌面基准 1440×900，以及触屏手机 375×812、320×568 与其横屏下截图；
2. 滚动展开层、左面板、右栏和长 accordion；
3. 在手机触屏 profile 下切换横竖屏并点击 ERA 外部页面控件。

预期结果：

- 大于 992px 时左右栏并排；992px 以下上下堆叠；手机上两个分区均保持在 viewport 内；
- 不出现横向不可达内容，关闭按钮、输入框和主要按钮始终可见可操作；
- 手机堆叠时展开层可移动到第二个分区，左面板、右栏和长 accordion 各自在所属区域内独立滚动，背景页面不跟随误滚；
- 悬浮球和展开层层级高于聊天内容但不覆盖 Tavern 的关键系统弹窗；
- 亮/暗主题截图中无文字截断、控件重叠、低对比和意外透明；
- ERA 透明父容器不阻断其外部区域的鼠标操作。

实现状态（2026-08-14）：旧 `min-width`、`92vw` 和双重 viewport 约束已移除。由于
SillyTavern 移动端 `body` 会形成特殊 fixed 包含块，ERA mount point 作为唯一 fixed viewport
根，`.era-app-container` 在根内绝对铺满；这可避免页面滚动后悬浮球和展开层整体偏移。
`ERA-UI-LAYOUT-001～012` 已在真实酒馆 visual/full suite 中全部通过。

### 4.17 手机触屏适配

**用例：UI-ADAPT-001～004（P2，已有基础 + 需扩展）**

前置状态：启用 375×812、320×568 及对应横屏的手机触屏 profile。

进入路径：使用手机触屏点击悬浮球并打开面板。

UI 操作：

1. 在竖屏与横屏下打开、关闭面板并操作主要控件；
2. 触控完整重算、最后一楼重算、回滚输入、设置编辑和快照查询的可点击区域；
3. 记录主要控件的裁切、溢出、命中测试、样式和截图证据。

预期结果：

- 手机触屏可完成主路径，触控区域不因竖横屏切换、滚动或安全区而失效；
- 不出现横向不可达内容，关闭、回滚输入、快捷操作、设置和快照查询均可触达。

说明：本项目不提供无障碍兼容验收；键盘导航、焦点管理、屏幕阅读器语义、ARIA、
`Escape` 关闭、浏览器缩放、reduced-motion 与 WCAG 对比度均不属于本项或其他 UI 专项的
验收范围。

### 4.18 Service 失败、忙碌与停止窗口的横切行为

**用例：UI-SERVICE-001～010（P0/P1，需扩展）**

前置状态：对 full/latest/rollback/init/save/query 统一提供可控 fake Host 或真实故障注入。

进入路径：从各功能对应按钮、输入框或下拉列表进入。

UI 操作：

1. 分别返回 admission rejected、长期 pending、completed、ignored、failed、cancelled 和
   Promise reject；
2. pending 时重复点击；
3. 请求 pending 时触发 UI stop/pagehide；
4. 卸载后让旧 Promise 迟到完成。

预期结果：

- 只有 completed 显示成功；其他结果显示稳定、可理解且不泄漏敏感数据的错误；
- 每次用户动作至多产生一个 receipt；pending 控件有 busy/disabled 状态；
- 普通失败不破坏面板、已提交设置和已显示快照，用户可重试；
- 停止窗口的新请求收到 `ERA_APP_SERVICE_UNAVAILABLE` 或等价 typed rejection；
- 卸载会取消/隔离 UI 等待，迟到 Promise 不访问 DOM、不 toast、不产生 unhandled rejection。

实现约束：命令和设置保存共用 receipt 等待语义；超时、拒绝、非 completed 与 reject 都不能
假装成功，且迟到结算不得覆盖后续用户操作的状态。

### 4.19 样式所有权、宿主隔离与 DOM 清理

**用例：UI-ISOLATION-001～008（P0/P1，需扩展）**

前置状态：记录 Tavern 关键元素的 computed style、head/style 数量和 body DOM 摘要。

进入路径：启动 UI、切换主题、打开/关闭、热重载、完整 stop。

UI 操作：

1. 每一步记录 ERA 根内外样式和 DOM；
2. 连续热重载 10 次；
3. 使用两个不同 script ID 的隔离实例做组件级所有权测试；
4. stop 后复查并触发迟到事件。

预期结果：

- ERA 只创建和删除自己拥有的挂载点与样式，不复制、修改或删除 Tavern/其他插件样式；
- 主题变量只在 ERA 根生效，根外 computed style 前后一致；
- 任意时刻只有一个当前实例的挂载点和样式容器；
- 不同 script ID 互不删除资源；stop 后 ERA 资源归零；
- 事件和样式容器数量不随热重载增长。

实现约束：宿主样式容器只承载 ERA script iframe 内由 Vue 生成的样式，并以 owner script ID
标记；停止时只删除同一 owner 的容器。主题变量只定义在 `.era-app-container`。

### 4.20 遗留代码不得回流生产

**用例：UI-LEGACY-001～003（P1，静态依赖检查）**

进入路径：无用户界面入口；通过生产依赖图和 bundle 审计执行。

检查操作：确认 `ExpandedView.vue`、`processing/panel-data.ts`、`ui/patch.ts` 不在生产
入口的可达依赖中。

预期结果：

- 当前展开界面只由 `App.vue` 组合 `EraPanel + RightRail`；
- 旧静态 HTML 生成器不得进入 `innerHTML` 路径；
- 旧强制刷新 patch 不得绕过 VibeFlow Service；
- 若后续决定删除这些文件，应先保留必要 oracle，再建立“生产 bundle 中无旧符号”的
  静态断言。

## 5. 需要补充的 Harness 能力

现有 `open-era`、`close-era`、`open-era-snapshots`、
`inspect-era-snapshot-detail` 可以保留。新增能力应归 `era` pack 所有，使用语义定位和
严格输入 schema，不把 selector 暴露给 catalog。至少需要：

| 能力组     | 需要表达的动作/观察                                                                   |
| ---------- | ------------------------------------------------------------------------------------- |
| 生命周期   | 读取 ERA mount/style/listener 数，触发 UI stop/热重载，检查迟到事件                   |
| 数据面板   | 读取空态、元数据、SelectedMks、EditLogs、当前页签和可见 JSON 摘要                     |
| 快照       | 选择指定 MK、按消息 ID 查询、切页签、控制 queryResult 顺序、读取 loading/error        |
| 快捷操作   | 点击 full/latest/rollback/init，输入 rollback ID，关联唯一 receipt/settlement/toast   |
| 设置       | 展开、重新读取、编辑各类型、丢弃、保存，读取 busy、toast、主题和持久化值              |
| 视觉与适配 | 设置桌面基准或手机触屏 viewport/pointer，读取裁切、命中、overflow 与 computed style |

每个 completed action 必须有专属 completion evidence；“点击成功”不能替代以下证据：

- 目标控件的最终可见状态；
- 精确一次 Service 入站与最终 settlement；
- 预期公共事件和变量/资源后果；
- 无 pageerror、unhandled rejection 和不允许的 ERA failure diagnostics。

## 6. 建议套件

| Suite               | 内容                                                                                    |                                并发建议 |
| ------------------- | --------------------------------------------------------------------------------------- | --------------------------------------: |
| `era-ui-smoke`      | 启动、悬浮球开关、首屏数据、主面板、一个快照查询、四个快捷操作成功路径、设置保存        |                                       4 |
| `era-ui-functional` | 本文全部 P0/P1 功能、输入边界、Service 失败和并发/迟到响应                              |                                       4 |
| `era-ui-visual`     | 桌面基准、手机触屏竖横屏、亮/暗主题、长内容、截图与 overflow                         | 4；point target 时按 Harness 规则降为 1 |
| `era-ui-lifecycle`  | 热重载、pagehide、stop、样式/监听器/DOM 所有权                                          |                                       1 |

普通 path 失败后仍继续执行其他 path；所有已选择路径都必须产生终态。最终 summary 将
recording 与 evaluation 分开，并列出每个失败功能、稳定错误码和 evidence refs。

## 7. 当前实现预计暴露的缺口

以下不是测试阻塞理由，而是应由新测试稳定捕获的首批问题：

1. UI 首屏回放、异键快照竞态、快捷操作 receipt 超时与样式所有权已进入本轮专项验证；
2. ~~320/375px 下 RightRail 的 400px 最小宽度可能溢出；~~ 已由 ERA-PROD-004 修复；最终
   run `st-run-20260813T18553243-3946bf8fb2f5` 完成 101/101 条 UI 路径，12 条 LAYOUT
   全部通过，Artifact 为 `consistent/complete`；
3. null MK 的信息展示、同键重复查询抑制和超范围 Service 返回仍须由专项路径确认；
4. 回滚与消息 ID 都必须严格限制为非负安全整数；
5. 命令、查询和保存的 busy、防重入与超时恢复必须由故障注入路径确认；
6. 丢弃设置的单 toast、保存失败后的 JSON 校验回滚与主题提交顺序必须由专项路径确认；
7. 宿主样式隔离必须通过 Tavern 输入框、按钮与独立插件元素的 computed style 前后比较确认；
9. 未使用的旧 `ExpandedView.vue` 已删除；其余遗留 bundle 特征继续由 4.20 审计防回归。

## 8. 验收完成条件

专门 UI 测试只有在以下条件同时满足时，才能称为“ERA 前台专项验收通过”：

- 每个 P0/P1 功能均有明确 path，所有选择路径均产生完整终态 Artifact；
- required evaluation 全部 passed；普通失败不会使剩余用例未执行；
- 所有用户操作都能对应到唯一 Service receipt 或明确的本地拒绝；
- UI 与最终变量、事件、世界书/正则后果一致，不以 toast 代替业务证据；
- 桌面基准、亮/暗主题以及手机触屏竖横屏主路径没有阻断性问题；
- stop/热重载后 DOM、监听器和 ERA 自有样式资源归零，宿主样式不变；
- Harness audit 对 path manifests、summary 和 evidence refs 报告零结构问题。

两小时空闲长稳不属于本文验收条件，除非用户另行直接、明确要求。
