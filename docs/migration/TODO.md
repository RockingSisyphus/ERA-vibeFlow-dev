# ERA → VibeFlow 当前 TODO

Updated: 2026-08-09 CST

状态标记：`[ ]` 未完成，`[~]` 进行中，`[x]` 完成，`[-]` 仅在明确请求时执行。

## 当前结论

- [~] 发布状态：`BLOCKED_VALIDATION`。当前没有剩余已知 ERA 功能回退；尚需把两项
  Harness 修正合并到同一执行树，并重跑、审计完整 P2。
- [x] VibeFlow 0.13.2、Service/Macro 两个 AOT root、contracts 1.4.0 已实现。
- [x] 两个 workflow 的 `status: planned` 数量为 0。
- [x] 当前机器审计的业务 JSONC 可读字段为 1083/1083 含中文。
- [-] 两小时空闲长稳不是默认或隐含门禁。只有用户直接、明确要求后才允许启动。

## 已完成修正

- [x] `API-BOUND-011`：API 消息写入后读回严格消息投影，再进入共享同步。
- [x] `SEM-ERR-007`：`processingMk` 成为当前任务唯一 MK 权威，提交前校验空 MK。
- [x] `SEM-KEY-015`：统一安全 portable JSON codec，兼容保留键且不污染原型。
- [x] 三条路径的真实 Tavern 定点、P1 和历史 P2 均通过。
- [x] P1 semantics：150/150 passed，Artifact 结构审计零问题。
- [x] Harness Evaluator 已修正事件证据读取边界；历史 P2 的
  `API-SYNC-002`、`API-BOUND-003`、`API-COMBO-004` 只读重评均 passed。
- [x] 源 Harness 已支持 `alternateGreetings`；`UI-NAV-004` 真实单路径 4/4 动作完成，
  swipe 从 0 切换到 1，Artifact 审计完整。

## 尚需完成

- [ ] 将修正后的 `era-contract-v1` Evaluator 与 `alternateGreetings` fixture 能力同步到
  同一个 Harness 工作树。
- [ ] 在该统一工作树中运行 Harness 合同门禁。
- [ ] 使用 `workers=4` 重新执行 P2 234 路径；普通 path 失败继续执行。
- [ ] 审计新 Artifact：234 条均有终态，summary 与 path manifests 一致，所有 required
  evaluation passed。
- [ ] 仅在上述结果通过后更新 v1.1.0 release manifest 为 `READY`。

## 历史证据说明

历史 P2 Artifact `st-run-20260809T09235094-1751caf367cf` 的原始结果必须保留为
234/234 有终态、230 passed、3 failed、1 inconclusive。该数字描述修正 Harness 前的
原始评估，不是当前 ERA 功能结论。原始 TODO 与报告已移入 `docs/archive/`。
