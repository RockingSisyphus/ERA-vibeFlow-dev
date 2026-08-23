# ERA 命令层压缩器沙箱

这个示例目录用声明式 JSON 驱动真实
`@era/vibeflow-command-compaction` 引擎。它不是生产节点，也不模拟 Tavern。

每个 `cases/*.json` 用例都在三条独立路径执行：直接引擎、VibeFlow Node AOT 与 Browser AOT。
然后运行器执行两类比较：

1. 原始指令与当前起点的压缩候选重放，比较变量状态、函数库和定位诊断；
2. 把**首次生成的冻结压缩文本**放到每个 `variants` 的更早状态中，重新执行原始与冻结文本，
   再比较相同可观察结果。

第二步是本沙箱的关键：它能发现把 `b = a * 2` 错写成历史常数等“当前层正确、历史编辑后
错误”的压缩。

运行：

```bash
npm --prefix javascript_project/compaction run test:sandbox
```

现有用例覆盖跨变量快照、严格 Insert、模板、变量/函数 `$meta`、函数 Insert/Edit/Delete、
前向和嵌套调用、`@f` 的完整快照闭包、非法函数事务、Insert/Edit/Delete 链、混合直接赋值
与 `$expr`，以及 JSON/表达式错误不污染状态。
