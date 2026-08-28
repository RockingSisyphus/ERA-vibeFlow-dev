# ERA 三段式故事编排器设计与现行语义

> 状态：已完成统一 VibeFlow planned review、实现与真实酒馆专项验证。本文描述现行
> `AgentGenerationSession` 语义；不再把已实现能力写成候选方案。

## 1. 产品边界

ERA 提供一条有界的故事生成会话，而不是开放式、多轮 Agent：

```text
可选：规划模型产生故事计划和纯函数调用表
→ ERA 校验并执行函数
→ SillyTavern 使用用户当前故事预设、连接和模型生成正文
→ 可选：结算模型根据正文产生变量操作
→ ERA 校验、试应用并组合一条最终消息
```

角色卡拥有两个独立开关：`planning.enabled`（正文前规划与函数调用）和
`settlement.enabled`（正文后独立变量解析）。两者均关闭时严格走 ERA 原有生成路径，不增加
辅助请求、Agent 标签或请求次数。规划单开、结算单开和两者全开均受支持。正文阶段永远使用
酒馆当时启用的故事预设、连接和模型，ERA 不会切换或覆盖用户的全局故事配置。

## 2. 会话与生命周期

### 2.1 启动时冻结配置

一轮生成会话建立时，ERA 捕获聊天身份、revision、消息 MK、变量与函数快照，以及当时的
规划/结算开关、重试次数和尝试配置。生成进行中修改设置只影响下一轮，不产生半轮混用。

ERA 自己发起的辅助请求带有会话级重入保护，不会再次触发 Agent 会话。quiet、impersonate、
dry-run、嵌套辅助请求和群聊不进入三段式流程。停止生成、页面卸载或聊天切换会取消尚未提交
的阶段；已经落入消息或 Sidecar 的事实仍由现有同步链负责。

### 2.2 历史编辑与重放

用户编辑、删除或在中间插入历史消息时，ERA 沿用原有历史同步逻辑：回退到受影响边界前的
已提交快照，再从边界向后按消息顺序重放。规范 `<era_tx>` 参与重放；`<era_plan>`、
`<era_update>` 和 `<era_agent_error>` 只是审计/显示报告，不写业务状态。

历史重算不会重新请求规划、故事或结算模型，也不会重新掷骰。若历史正文改变，已有 Agent
证据可能失效，但状态结果只取修改后消息中实际存在的规范事务。

### 2.3 群聊

ERA Agent 明确不支持群聊。群聊继续使用默认生成和 ERA 同步；设置页显示“不支持群聊”并
禁用 Agent 配置与重试，不尝试推断应使用哪个群成员的角色卡配置。

## 3. 角色卡配置 V2

配置位于角色卡未知扩展字段 `data.extensions.era_agent`，随 PNG、JSON 和 CharX 的标准角色卡
导入导出迁移：

```ts
type EraAgentConfigurationV2 = {
  schemaVersion: "2";
  planning: StageConfiguration;
  settlement: StageConfiguration;
};

type StageConfiguration = {
  enabled: boolean;
  retryCount: number; // 0..16；默认 3
  attempts: AttemptProfile[];
};

type AttemptProfile = {
  preset: { source: "builtin" } | SanitizedPresetSnapshot;
  modelSource:
    | { kind: "tavern-current"; legacyModelOverride?: string }
    | {
        kind: "custom-profile";
        profileId: string;
        profileNameHint?: string;
        model?: string;
      };
};
```

旧卡或没有扩展字段时两个开关均关闭。V1 会在读取时迁移到 V2；旧 `model` 覆盖保留原执行
语义，用户显式切换来源后才采用新的模型来源结构。尝试次数多于 `attempts` 数量时复用最后一项。

### 3.1 预设来源

每个规划或结算尝试可选择 ERA 内建结构化提示、酒馆“当前正在使用”的预设（包括尚未另存的
当前修改），或酒馆已经导入的任意预设。

选择酒馆预设时，ERA 当场读取并保存脱敏快照。运行时使用嵌入快照，不依赖另一台设备存在
同名预设；`sourceName` 仅用于 UI 显示。重新捕获是显式操作，不会因本机同名预设变化而静默
改变已发布角色卡。

### 3.2 模型来源

每个尝试可选择 `tavern-current`（沿用酒馆当前连接与当前模型）或 `custom-profile`（引用 ERA
本机保存的 OpenAI-compatible 连接方案，并选择模型或手动填写模型名）。

正文阶段不读取这些辅助配置，始终保持酒馆原始故事配置。若角色卡引用的本机方案不存在，
该尝试产生精确诊断并按配置进入下一次尝试，绝不静默退回酒馆当前模型。

## 4. 本机连接方案与秘密

连接方案保存在 ERA 的 SillyTavern extension settings 中，包含方案名称、API 地址和密钥。
角色卡只保存不透明的 `profileId`、名称提示和模型名，因此导出到另一台设备后需要用户重新绑定。

Service/UI 列表只返回 ID、名称、地址和“是否已有密钥”，不会回传密钥正文。编辑时空密钥表示
保留旧值，清除密钥必须显式操作。模型列表通过 Tavern Helper 的 OpenAI-compatible 能力加载；
加载失败只显示错误，不覆盖当前已保存选择。

完整隐私边界见 [ERA-Agent预设快照与隐私边界.md](ERA-Agent预设快照与隐私边界.md)。

## 5. 规划、函数调用与随机

规划阶段要求严格 JSON：

```json
{
  "storyPlan": { "summary": "敌人袭击，角色尝试闪避" },
  "calls": [{ "function": "dice", "args": [1, 20], "purpose": "敏捷检定" }]
}
```

ERA 先校验完整调用表，再按原顺序执行。仅允许当前消息状态中的 `statFunc` 和 ERA 有限数值
内建函数；禁止 JavaScript、DOM、网络、Slash 命令和任何状态写入。单轮调用数量和输入规模
有界。调用失败不会留下部分变量状态。

确定性 `random()` 使用本轮消息 MK 和预分配 draw offset。重试故事或结算不会重新掷骰；重跑
规划会产生新的规划周期和随机区间。函数名、参数、结果与随机证据进入 `<era_plan>` 报告，保证
已有 Swipe 可解释、可重放。

## 6. 正文与变量结算

规划成功后，ERA 将故事计划和函数结果作为一次性 prompt 注入交给酒馆原生正文生成。正文仍
遵守角色卡、世界书、当前故事预设、预填充及供应商行为。

结算开启时，结算模型接收干净故事正文、故事生成前的变量/函数快照、可选计划与函数结果以及
ERA 操作合同。正文里模型自行生成的普通 ERA 标签或 `<era_tx>` 只保留为审计原文，不作为
写入者；结算模型返回的 operations 经严格解析、保护检查和试应用后，由 ERA 生成唯一规范
`<era_tx s="m">`。

结算关闭时，正文继续使用原有 ERA 标签解析语义。这样开关关闭的路径与现有 ERA 行为保持一致。

## 7. 消息格式与显示

一个成功 cycle 的权威正文按启用阶段组合：

```html
<era_plan>{规划尝试、调用表、结果与随机证据}</era_plan>
正式故事正文
<era_update>{结算尝试、诊断和最终操作或未结算状态}</era_update>
<era_tx s="m">最终变量操作</era_tx>
```

未开启的阶段不生成对应标签。Continue 在同一消息追加新的完整 cycle；Swipe 各自保存其活动
正文与轻量 `extra.era_agent` 索引。完整报告以正文为权威，`extra` 不重复保存大段模型原文。

ERA 为角色卡维护显示与提示清理正则：UI 中折叠计划、更新与错误报告；后续故事上下文剥离这些
报告，只保留正式故事。若角色卡本地正则被全局禁用，设置页显示“已配置但未激活”，本轮回退
默认 ERA 行为，避免报告污染后续上下文。

## 8. 重试与失败

- 每个辅助阶段最多执行 `retryCount + 1` 次；每次可使用不同预设、连接和模型。
- 规划重试耗尽时停止尚未发出的原生故事请求，并写入不可 Swipe 的 ERA 规划失败系统消息。
- 结算重试耗尽时保留故事，写入“变量未结算”报告，不伪造事务，允许从 UI 只重试结算。
- UI 对最新消息最新 cycle 提供“重跑规划”“重跑故事”“重跑变量结算”。
- 重跑规划会级联重新生成故事及结算；重跑故事复用最近计划与骰点，再重跑结算；重跑结算只
  处理当前故事。
- 不为中间历史楼层提供模型重跑按钮；历史修改由第 2.2 节的确定性同步链处理。

所有失败尝试及其脱敏诊断以有界报告保存。API 密钥、Authorization 和本机连接秘密不会进入消息、
Sidecar、角色卡导出、console、trace 或 Artifact。

## 9. 分层职责

| 层                  | 职责                                                         |
| ------------------- | ------------------------------------------------------------ |
| Tavern Helper       | 预设读取、OpenAI-compatible 请求、模型列表、取消和供应商兼容 |
| ERA Host            | 本机方案解析、秘密封装、聊天身份、消息写入与宿主事件         |
| VibeFlow Service    | 有界会话、配置冻结、重试路由、函数执行、结算和诊断           |
| Expression/statFunc | 确定性纯函数、random context 与数值合同                      |
| ERA UI              | 开关、预设捕获、连接方案、模型选择、状态和手动重试           |
| ST-Response-Lab     | 通用多 provider、多模型、有序响应模拟；不含 ERA 语义         |
| ST-Test-Harness     | 通用浏览器动作、复合请求序列、Artifact 与审计                |
| ERA-Test-Pack       | ERA 专属设置、编排、消息格式、parity 和安全 oracle           |

不改变 `ERA.commit/get/subscribe/sync/history` 公共 ABI，也不新增 Sidecar 密钥或连接字段。

## 10. 明确不支持

- 开放式或无限轮 Agent；
- 生成正文中途任意次数的工具递归；
- 模型直接写 ERA 状态或执行任意代码；
- 群聊 Agent；
- 让辅助配置改变正文阶段的故事预设或模型；
- 把 API 密钥或本机连接库嵌入角色卡；
- 编辑历史消息时重新请求模型。

## 11. 验证入口

ERA-Test-Pack 将 Agent 测试分为：

- `era-agent-settings-ui`：角色卡 V2、预设/模型/方案 UI、迁移、导入导出与秘密边界；
- `era-agent-orchestration`：四种开关组合、重试路由、函数、生命周期与实际 provider/model；
- `era-agent-message-format`：报告顺序、折叠、提示清理、Continue/Swipe/重放；
- `era-agent-parity`：与默认模式配对比较可见故事、状态、日志、Sidecar 和分支结果。

默认 ERA 测试不修改期望；完整发布验收仍由 `era-regression-all` 聚合。

## 12. 参考

- [ERA-Agent角色卡作者配置指南.md](ERA-Agent角色卡作者配置指南.md)
- [ERA-Agent预设快照与隐私边界.md](ERA-Agent预设快照与隐私边界.md)
- [era-host-contract.md](era-host-contract.md)
- [ERA事件调度与生成栅栏设计.md](../../app/开发文档/ERA事件调度与生成栅栏设计.md)
- `references/MagVarUpdate/`
- `references/EraHelper-all-in-one-solution-for-ERA-scripts/`
- `references/JS-Slash-Runner/`
- `references/SillyTavern/`
