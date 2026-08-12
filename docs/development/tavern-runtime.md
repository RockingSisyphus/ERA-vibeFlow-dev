# Tavern Helper 与 SillyTavern 运行时入口

## 权威来源与优先级

1. 本仓 `app/@types/function/**`、`app/@types/iframe/**`：本地开发所依赖的接口签名、说明和
   可用 global 名称。
2. Tavern Helper 官方文档与对应上游发布说明：行为解释与更新候选。
3. 已连接的 SillyTavern 页面：当前启用扩展、真实版本和实际可调用 API 的最终证据。

类型声明是开发合同，不等于用户当前酒馆一定已安装相同能力。新增依赖或兼容性结论必须先检查
`getTavernHelperVersion()`、`getTavernVersion()` 或等价的实际运行时证据。

## ERA 的 API 选择

优先使用 Tavern Helper 高层 API，避免直接读写 SillyTavern 内部对象或依赖脆弱 DOM：

| 任务                      | 首选类型/接口                                                           | 避免                        |
| ------------------------- | ----------------------------------------------------------------------- | --------------------------- |
| 监听酒馆事件              | `iframe/event.d.ts`：`eventOn`、`eventMakeFirst`、`eventRemoveListener` | 自行 monkey-patch event bus |
| 聊天记录、swipe、消息写回 | `function/chat_message.d.ts`：`getChatMessages`、`setChatMessages`      | 直接修改 `SillyTavern.chat` |
| 变量                      | `function/variables.d.ts`：`getVariables`、`replaceVariables`           | 修改内部变量对象引用        |
| 世界书                    | `function/worldbook.d.ts`                                               | 手工改扩展私有缓存          |
| 已显示消息刷新            | `function/displayed_message.d.ts`：`refreshOneMessage`                  | 直接 patch 酒馆渲染管线     |
| ERA 宏                    | `function/macro_like.d.ts`：`registerMacroLike`                         | 在生成后异步替换 prompt     |

`exported.sillytavern.d.ts` 仅用于 Tavern Helper 未提供高层能力且任务明确需要时；这样做必须说明
原因、限制和回归测试。

## 真实联调

真实联调步骤、端口和本地/发布版隔离见
[`app/开发文档/Codex开发与酒馆实时联调指南.md`](../../app/开发文档/Codex开发与酒馆实时联调指南.md)。
切换脚本、重新生成消息、修改用户聊天数据均会影响实际会话，只有用户明确授权的任务才可执行。
