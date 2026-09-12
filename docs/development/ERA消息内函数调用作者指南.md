# 消息内函数调用：当前版本边界

本轮交付是逐块执行基础清理与既有能力修复。当前版本尚不提供消息内作者函数注册或自动执行 API。

- 普通 `<VariableInsert>`、`<VariableEdit>`、`<VariableDelete>` 及 JSON 纯函数操作按消息位置执行。
- `<EraFCall name="example" status="done"/>` 被跳过；done 是唯一已执行判据。
- 没有 done 的调用返回 `ERA_FCALL_NOT_IMPLEMENTED`，该消息的后续块停止。前面已成功保存的块仍保留，服务可继续处理后续正常请求。
- 旧 `EraFCallTx` 中的操作仍按普通操作重放，记录的位置、是否为空或 `applied` 属性均不能替代 done。
- 外置脚本及状态栏的 `ERA.get/ready/commit/history/sync/statusbar` 沿用公共 API。普通 commit 使用原有 message、branch、always 作用域，记录追加在目标消息末尾。

执行中的 `era_block` 是临时进度记录，完整处理该消息后由 ERA 清除。恢复依赖累计回退日志；旧中间产物信息不足时明确报告恢复问题，不猜测变量起点。

未来完整消息内函数能力的目标与设计见 [实施计划](ERA消息内函数调用实施计划.md)。酒馆原生工具调用和 ERA 原有 Agent 功能继续使用各自接口。
