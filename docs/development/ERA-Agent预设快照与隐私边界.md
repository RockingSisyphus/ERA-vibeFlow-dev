# ERA Agent 预设快照与隐私边界

## 1. 角色卡中允许保存的内容

辅助阶段预设以脱敏快照保存，只保留有序提示词、必要的 in-chat prompt、通用采样设置和用于显示
的来源名称。运行时使用快照内容，不通过名称动态引用本机预设。

角色卡 Agent V2 还可保存阶段开关、重试次数、尝试顺序、模型来源、模型名、本机方案 ID 和名称
提示。这些内容用于跨设备说明“原卡期望哪个辅助配置”，但不提供访问作者服务的凭据。

## 2. 必须剔除的内容

预设捕获和角色卡导出不得包含：

- API URL、API 密钥、Authorization、代理和账号信息；
- Tavern Helper 或其他扩展的第三方脚本、正则脚本与私有配置；
- 无关扩展字段、浏览器存储、聊天或 Sidecar 数据；
- 本机连接方案库本身。

角色卡只保留自定义连接的 `profileId`、名称提示和模型名。导入到不存在该 ID 的设备时必须明确
显示“需要重新绑定”，不能静默降级到酒馆当前连接。

## 3. 本机方案存储与访问

OpenAI-compatible 连接方案保存在 ERA 的 SillyTavern extension settings 中。Host 在真正发出
辅助请求前才根据方案 ID 解析 URL 与密钥；VibeFlow 领域 DTO 只携带方案引用和模型名。

UI 和 Service 查询只返回方案 ID 和显示名称、API 地址、是否已有密钥及已加载的模型名，不会返回
密钥正文。尝试卡把新密码登记为页面实例级不透明 Host 引用；Service 命令、FIFO、settlement 和
Artifact 只接触引用 token，Host 在 upsert 或草稿模型枚举时解析并在回执结算后释放。编辑时留空
表示保留，清除需要显式操作。删除方案不会修改已经发布的角色卡，这些角色卡下次使用时会进入
“需要重新绑定”。

## 4. 日志、消息与测试证据

密钥不得出现在角色卡导出、消息、Sidecar、Agent 报告、Service result、console、trace、错误文本
或 ST-Test-Harness Artifact 中。ST-Response-Lab 只记录 provider alias、模型及 Authorization 是否
存在，不记录 Authorization 值。

错误诊断可以包含方案 ID、名称提示、provider alias、模型名和失败阶段，以便定位路由；不得拼接
请求头或原始秘密。模型返回内容按 Agent 报告的有界规则保存，但不应被当作可信指令重新执行。

## 5. 跨设备迁移检查

导出/导入 PNG、JSON 或 CharX 后应满足：

1. 开关、重试与脱敏预设快照保持一致；
2. API URL、密钥和本机方案库不存在；
3. 酒馆当前模型来源可直接使用；
4. 自定义方案来源在未重新绑定前明确不可用；
5. 重新绑定只修改本机角色卡配置引用，不恢复或猜测作者的密钥。
