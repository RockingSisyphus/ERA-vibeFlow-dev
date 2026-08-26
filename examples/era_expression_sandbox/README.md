# ERA 函数表达式验算沙箱

这个示例用声明式 JSON fixture 对真实 `era-expression` root 做深度验算。它不是第二套表达式实现，也不接入 ERA Service、Sidecar、宏、API 或 Tavern。

运行：

```bash
npm --prefix javascript_project/expression run test:sandbox
```

运行器会在系统临时目录构建三份真实入口：直接表达式引擎、Node AOT 与 Browser AOT；每条用例都要求三者产出完全一致的状态、压缩候选和诊断。

## 用例格式

每个 JSON 用例包含函数库、层起始状态和有序操作：

```json
{
  "request": {
    "functionLibrary": {
      "twice": { "params": ["x"], "expr": "x*2" }
    },
    "initialState": { "a": 4, "answer": 0 },
    "operations": [
      { "path": "a", "expr": "a+1" },
      { "path": "answer", "expr": "twice(a)" }
    ]
  },
  "expect": {
    "status": "ok",
    "finalState": { "a": 5, "answer": 10 },
    "diagnostics": []
  }
}
```

`valid.json` 覆盖语法、路径、前向声明、函数体嵌套、调用参数嵌套、旧项目风格函数，以及所有已支持内建数学函数。`compaction.json` 额外断言规范 `$expr` 文本，并以引擎内部允许的 `@path` 重放压缩结果。`invalid.json` 覆盖解析、函数库、数值、微积分和输入形状错误；它们都必须保留操作前状态。

`random.json` 覆盖 `random()`、`random(seed)`、`random(seed,draw)`、自动序号连续传递、
嵌套骰点/技能检定、运行时失败后的槽位预留，以及缺少上下文、非法 draw 和随机函数微积分
目标的精确诊断。三入口同时比较最终状态、诊断、`randomDrawsConsumed` 和
`nextDrawOffset`。

表达式遵循标准指数优先级：`-2^2` 为 `-4`、`(-2)^2` 为 `4`、`2^-2` 为 `0.25`，且 `2^3^2` 为 `512`。函数必须继续以 `functionLibrary` JSON 定义；本 root 不支持在单条表达式中声明函数。

本沙箱验证独立纯引擎；ERA Service 另以消息 MK 提供 `sourceKey`，真实聊天生命周期与
历史重放由 ERA-Test-Pack 验收。
