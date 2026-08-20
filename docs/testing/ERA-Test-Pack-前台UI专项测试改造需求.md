# ERA 前台 UI 专项自动化测试工具链改造需求

> 状态：待架构审核
>
> 目标读者：`ERA-Test-Pack` 与 `ST-Test-Harness` 开发者
>
> 关联产品需求：[ERA前台UI测试需求.md](ERA前台UI测试需求.md)

## 1. 目标与结论

为当前 `ERA-vibeFlow/app/dist/ERA变量框架/index.js` 建立可重复执行的 ERA 前台 UI
专项自动化测试。测试必须在隔离的 SillyTavern / Tavern Helper sandbox 中运行，保存完整
Artifact，并将 recording 与业务 evaluation 分开报告。

`ERA-Test-Pack` 应成为此专项测试的领域实现载体，但本需求**不能只修改该仓库完成**：

- `ERA-Test-Pack` 负责被测 bundle 接入、ERA 专项 fixture、语义化 UI action、领域采集、
  专项 Test File / suite 与 Evaluator；
- `ST-Test-Harness` 负责浏览器 context profile（viewport 与触屏输入设备）的公开
  配置和 Artifact 记录；
- 不修改 ERA 产品业务逻辑；如需使用现有运行时 adapter 进行故障注入，只能在每条独立
  sandbox 内临时安装，并必须在 teardown 中恢复。

本需求不授权启动真实 SillyTavern、浏览器、Lab 或 ERA suite；实现完成后的真实验收须另行
明确授权。

## 2. 当前阻塞与改造原因

| 编号 | 现状 | 影响 | 所有者 |
| --- | --- | --- | --- |
| B1 | `era-test` 仅接受 Git 工作树的 `dist/ERA变量框架/index.js`，或由该 Git 工作树生成的 package。`ERA-vibeFlow` 当前不是 Git 工作树。 | 当前生产 bundle 不能成为受测输入。 | ERA-Test-Pack |
| B2 | ERA loader 仅接受旧 bundle 的固定 `OpenCC → Pinia` 静态 import 顺序；当前 bundle 为 `Pinia → OpenCC`。 | loader 会拒绝当前 bundle，无法执行 UI。 | ERA-Test-Pack |
| B3 | 现有 Pack 仅有面板开关与快照基础 action；快照、快捷操作、设置、生命周期、手机触屏适配、样式隔离均无专项语义 action 与 collector。 | 无法编写需求文档中的专项路径，也无法形成可审计证据。 | ERA-Test-Pack |
| B4 | canonical catalog 被锁定为 235 paths / 2,241 actions，且 suite 顺序与 hash 必须稳定。 | 不能把新专项路径直接加入既有 canonical catalog。 | ERA-Test-Pack |
| B5 | Harness 在 runtime 中固定使用 `1440×960`，Pack API 没有设置手机触屏 viewport、颜色方案、touch/pointer 的接口。 | 无法真实覆盖桌面基准与手机触屏竖横屏矩阵。 | ST-Test-Harness |

## 3. ERA-Test-Pack 改造需求

### 3.1 VibeFlow 被测件输入与安全边界

1. 新增一个受限的 VibeFlow bundle 输入模式，接受已构建的
   `app/dist/ERA变量框架/index.js`，并继续执行 canonical path、regular file、size 与
   SHA-256/bytes 校验。
2. 该模式不得降低现有 `--era-source` / `--era-package` 的 Git identity 校验；应使用
   显式 `inputKind` 或新的、版本化 under-test descriptor 区分来源。
3. bundle 原路径只能通过现有 trusted runtime asset 传入 resolver，不能写入 Project
   Config、Scenario、Artifact、stdout 或异常文本。
4. fixture 仍只允许声明式 patch；不得向 sandbox 写入任意脚本、绕过 Pack asset hash，或
   修改 ERA 产品源码 / dist。

### 3.2 Loader 兼容当前 bundle

1. 保持“只允许经审核的静态 imports、拒绝动态 import”的安全模型。
2. 将依赖解析改为按 specifier 匹配，而不是按 import 出现顺序匹配：只允许已锁定的
   OpenCC 1.4.1 与 Pinia 3.0.4，且每项恰好出现一次。
3. 新 loader 必须同时拒绝额外 import、重复 import、未知 URL、导出形状漂移和
   `import()`；不能以宽松正则接受任意 bundle。
4. loader contract test 必须覆盖旧顺序、当前顺序及全部拒绝路径。

### 3.3 专项 UI Pack API

新增 Pack-owned action、collector、completion contract 与 capture profile。Test File 不得
暴露 selector、任意脚本或事件名；DOM 定位只存在于 frozen browser pack 中，并采用稳定的
语义定位。

最低能力组如下：

| 能力组 | 必须支持的动作与观察 |
| --- | --- |
| 生命周期 | 读取 ERA mount/style/listener/global 数；触发 stop、重启/热重载；发送迟到 `writeDone` / `queryResult`；验证资源归零。 |
| 数据面板 | 打开/关闭；读取空态、元数据、SelectedMks、EditLogs、折叠状态、JSON 摘要与当前页签。 |
| 快照 | 选择 MK、输入并查询 message ID、切换纯净/完整页签、读取 loading/error；控制并验证乱序、重复、无关及超时结果。 |
| 快捷操作 | 点击 full/latest/rollback/init，输入 rollback ID；记录唯一 admission、receipt、settlement、toast 和变量/资源后果。 |
| 设置和主题 | 展开、读取、编辑、丢弃、保存；读取 busy、toast、持久化值、`era-settings-updated` 与 ERA 根内外 computed style。 |
| 触屏适配与隔离 | 手机触屏的 overflow、命中测试、样式和 DOM 所有权。 |

每个 action 的 completed evidence 至少包含目标最终可见状态；涉及 Service 的 action 还必须
包含唯一 admission/receipt、最终 settlement，以及相关公共事件或宿主后果。点击本身不能
作为成功证据。

### 3.4 fixture 与故障注入

1. 新增 UI fixture，至少包含 5 条消息（含 ID `0`、用户与 AI）、最新/历史/null MK、
   两组 EditLogs、可区分的 `stat` / `statWithoutMeta`、历史快照与不存在查询场景。
2. fixture 必须包含默认设置、资源未初始化、资源已初始化与同名冲突的宿主状态。
3. 为 query、full/latest/rollback/init/save 提供可控的 admission rejected、pending、
   completed、ignored、failed、cancelled、Promise reject 和超时情形。
4. 可利用现有 `__ERA_VIBEFLOW_APP_RUNTIME__` 及其 adapter 的公开运行时句柄建立隔离的
   spy/fake，但必须：只作用于当前 path、记录每次调用、在 teardown 恢复原实现，并禁止
   伪造 UI 结果或直接改写聊天/变量以替代真实用户操作。

### 3.5 suite、catalog 与 Evaluator

1. 新增独立的专项 Test File V2 和以下 suite：
   `era-ui-smoke`、`era-ui-functional`、`era-ui-visual`、
   `era-ui-lifecycle`。
2. `era-test` 应能够安全 staging 这些 Pack 随附的 Test File；既有 canonical catalog 的
   235 paths、2,241 actions、suite ID、顺序和 hash 必须完全保持不变。
3. 每个专项 path 都要生成 before/after screenshot、结构化 DOM、browser observer
   （console/pageerror/unhandled rejection）、ERA event window、Service evidence 和相关
   Tavern 状态快照。
4. 新增显式 Evaluator，按 [ERA前台UI测试需求.md](ERA前台UI测试需求.md) 的 P0/P1
   expected 判断 Artifact。Evaluator 只能读取冻结 Artifact，不得读取产品源码、Project
   Config 或网络。
5. 普通 path 失败后，scheduler 必须继续执行其他已选路径；最终 summary 分开列出
   recording status、evaluation status、稳定错误码和 evidence references。

## 4. ST-Test-Harness 改造需求

Harness 必须将 browser context profile 作为显式、受 schema 校验且可审计的输入。最低字段：

- `viewport`: `{ width, height }`；
- `colorScheme`: `light | dark`；
- `hasTouch` / pointer profile。

要求：

1. profile 可被 Test File / suite 显式选择，不能由 Pack browser code 私自伪造浏览器环境；
2. profile 写入 normalized project、Scenario 和 path Artifact；
3. point target 时保持“精确 viewport、DPR、scroll、`elementFromPoint()`”复核与单 worker
   限制；
4. 支持桌面基准 `1440×900`，以及手机触屏 `375×812`、`320×568` 与对应横屏；每类至少有
   亮/暗代表路径；
5. 不改变默认路径当前的 `1440×960` 行为，除非 path 显式声明 profile。

## 5. 验收标准

实现完成后，以下条件必须同时满足：

1. 当前 VibeFlow bundle 可被 `era-test` 以锁定身份加载，且 loader 对未批准的 import
   形状 fail closed。
2. 五个专项 suite 都可被显式选择；既有 canonical catalog 的 `catalog:check` 仍报告
   `235 / 2241 / 150 / 138`，两个锁定 hash 不变。
3. P0/P1 的每个功能均有明确专项 path；每条已选择路径都有完整终态 Artifact。
4. Service 相关路径能区分 admission rejected、各 settlement、Promise reject 与 timeout；
   每个用户动作至多对应一个 receipt。
5. 视觉路径在桌面基准与手机触屏竖横屏、亮/暗环境中运行，Artifact 记录实际 profile 与截图。
6. stop/热重载后，ERA 自有 DOM、监听器、样式和全局句柄归零；宿主范围外的 computed style
   不变。
7. Pack 离线门禁通过：`format:check`、`typecheck`、`build`、`catalog:check`、
   `test:contract`、`verify:baseline`；Harness 改动通过其自身完整离线门禁。
8. 未获真实验收授权前，交付报告必须明确“真实 ST/浏览器/ERA suite 未运行”。

## 6. 非目标与约束

- 不修改 ERA 产品业务逻辑或生产 bundle 来让测试通过；产品与规格不符时，测试应失败并
  留下证据。
- 不把 selector、CSS/XPath、任意 JavaScript、任意事件名或业务 oracle 写入 Test File JSONC。
- 不读取旧 Artifact 进行新旧比较；正确性仅来自本专项需求的显式 expected 和冻结 Evaluator。
- 不执行两小时长稳；除非后续单独、明确授权。
- 不用 toast、点击成功或 Harness action completed 代替业务成功证据。
- 不实现或验收键盘、焦点、ARIA、读屏、浏览器缩放、reduced-motion 或 WCAG 对比度兼容。
