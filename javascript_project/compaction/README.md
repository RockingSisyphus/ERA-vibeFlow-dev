# ERA 命令层安全压缩器

`@era/vibeflow-command-compaction` 是一个独立、纯同步的 VibeFlow JavaScript root。
它不读取或写入 Tavern、Sidecar、消息或 API；调用方必须显式提供一条消息的原文及该层
开始时的变量、函数状态。

当前 ERA Service 已通过 `era.command_compaction.apply_sealed_layers` 作为薄 Nodeset
调用它：Service 提供已封存 assistant 楼层候选、再用自身 CRUD 引擎复放确认，最后才把
已证明的文本更新和编辑日志交给既有 Sidecar 事务提交。压缩器本身仍不拥有任何宿主 I/O。

## 输入与输出

```ts
compactCommandLayer({
  content: "<VariableEdit>{\"a\":{\"$expr\":\"a+1\"}}</VariableEdit>",
  initialStatData: { a: 10 },
  initialStatFunc: {},
});
```

输出保留非 ERA 正文，并给出候选正文、原始重放后的 `finalStatData`、`finalStatFunc`、
诊断、未压缩理由，以及 `compacted`、`partial`、`unchanged` 或 `invalid` 状态。

它直接解析六种真实指令标签：`VariableInsert`、`VariableEdit`、`VariableDelete`、
`FunctionInsert`、`FunctionEdit` 和 `FunctionDelete`。`$expr`、`@path`、`@f(...)`、
函数调用图及数学函数均委托 `@era/vibeflow-expression`，不会复制表达式解释器。

请求可携带仅本次计算使用的 `randomContext: { sourceKey, drawOffset }`。直接或经
`statFunc` 间接调用 `random()`/`random(seed)` 的命令是局部硬边界：命令与顺序保持原样，
屏障两侧互不依赖的确定性区间仍可各自压缩。`random(seed,draw)` 不消耗自动序号，可作为
普通确定性表达式参与证明。等价校验同时比较最终状态、函数库、诊断和下一个抽取序号。

## 保守改写规则

压缩不是“把当前数值算出来再写回”。候选必须保留层起始依赖：

```text
a = a + 1
b = a * 2
a = a + 1
```

会得到等价的：

```json
{
  "a": { "$expr": "@a + 2" },
  "b": { "$expr": "(@a + 1) * 2" }
}
```

因此更早楼层把 `a` 从 10 改为 3 后，重放结果仍是 `a = 5`、`b = 8`，而不是把
`b` 固化成旧值 22。

当前可证明并会改写的区域是：

- 消息开头的、没有 `$meta`/模板/函数变更屏障的连续数值 `VariableEdit`；
- 相同路径纯直接数值赋值的连续 Edit，缩为最后一个**直接赋值**，不伪造 `$expr`；
- 相邻、无模板和元数据歧义的严格 `VariableInsert`，按 first-wins 语义合并。

以下场景当前明确保留原标签，而不是冒险缩短：Insert 后 Edit、任何 Delete、函数变更、
模板或 `$meta` 参与的区域、混合直接赋值与 `$expr`、有前序命令会改变层起始含义的 Edit、
以及任何有诊断的消息。这样例如 `Insert a=1; Edit a=11` 不会被错误改成只剩
`Insert a=11`。

所有候选都先从当前层起始状态进行真实重放；不一致会退回原文。示例沙箱还会把**冻结后的
候选**放入数值、对象、缺失、锁定、模板和函数库变化等更早起点中重放，防止只在当前样本
上成立的“常数折叠”。数值 `$expr` 合并依赖 ERA 本身的有限数值目标合同；当调用方无法
建立这个合同或出现保护/诊断，压缩器应保留原命令。

## 运行

```bash
npm --prefix javascript_project/compaction run typecheck
npm --prefix javascript_project/compaction run test
npm --prefix javascript_project/compaction run test:sandbox
npm --prefix javascript_project/compaction run test:workflow
```

`examples/era_command_compaction_sandbox` 的 JSON fixture 会同时执行直接引擎、Node AOT
和 Browser AOT，并对原文本与冻结压缩文本做重放对照。
