# ERA 函数表达式 Root

`era-expression` 是一个独立的 JavaScript VibeFlow root：它只实现有限数值表达式、可组合的自定义函数、顺序状态执行和消息层压缩原型。它不读取或修改 Tavern、ERA Service、Sidecar、宏、聊天消息或 ERA API；接入 ERA 是后续单独审核的工作。

## 输入与结果

输入必须显式提供函数库、有限数值初始状态和有序操作：

```json
{
  "functionLibrary": {
    "f": { "params": ["x1", "x2"], "expr": "x1*3+2*x2+3" },
    "g": { "params": ["x"], "expr": "f(x, x+1)" }
  },
  "initialState": { "a": 10, "b": 0 },
  "operations": [
    { "path": "a", "expr": "a+1" },
    { "path": "b", "expr": "g(a)" },
    { "path": "a", "expr": "a+1" }
  ]
}
```

操作严格按出现顺序读取当前状态。结果给出 `finalState`、定位诊断和每个改变路径最多一条的压缩候选，例如：

```json
{
  "a": { "$expr": "@a + 2" },
  "b": { "$expr": "g(@a + 1)" }
}
```

`@a` 仅由压缩器生成，表示本消息层开始时的 `a`；用户原始输入不能使用 `@`。函数体只能读取自己的形参以及内建/自定义函数，不能读取实时状态或快照。函数可前向声明、可嵌套调用，也可在调用实参内嵌套，例如 `f(g(x), h(y))`。直接和间接递归在调用图 DFS 阶段拒绝，绝不进入执行。

## 语法与数学后端

- 语法：有限数值、路径、括号、一元 `+/-`、`+ - * / % ^`、内建函数与自定义函数调用。指数按标准数学优先级处理：`-2^2` 为 `-4`，`(-2)^2` 为 `4`，`^` 保持右结合。
- 原生 `Math`：三角/反三角/双曲、指数、对数、开方、绝对值与取整等普通标量函数。
- 自有实现：非负整数阶乘、有限数检查和确定性的迭代自适应 Simpson 定积分。
- `@stdlib/math-base-special-gamma`：Gamma 数值。
- Math.js：仅处理由已验证内部 AST 生成的符号导数字符串；不解析或执行用户原始文本。

`derivative(f, at[, order])` 和 `integral(f, start, end)` 都只接受已定义的一元纯函数。导数阶数为任意正安全整数；无法表示或求值时返回诊断而不是伪造结果。

## 可重放随机与骰点

`random` 是表达式语言 ABI 中的确定性内建函数：

```text
random()            # randomContext.sourceKey + 自动 draw
random(seed)        # 有限数值 seed + 自动 draw
random(seed, draw)  # 显式 seed 与非负安全整数 draw
```

前两种形式需要调用方提供 `{ sourceKey, drawOffset }`。自动序号按操作、JSON 字段、参数和
函数展开的原始顺序预留；完全显式形式不消耗序号。算法固定为 UTF-8/IEEE-754 的 FNV-1a
64 位规范哈希、SplitMix64 混合和高 53 位映射到 `[0,1)`，Node 与 Browser 逐位一致。
实现不读取系统时间或 `Math.random()`。包含直接或间接随机调用的函数不能作为
`derivative`/`integral` 目标。

骰点规则不是内建语义，可以按游戏需要存入 `statFunc`：

```json
{
  "dice": { "params": ["min", "max"], "expr": "floor(random()*(max-min+1))+min" },
  "diceSeeded": { "params": ["min", "max", "seed"], "expr": "floor(random(seed)*(max-min+1))+min" },
  "diceAt": { "params": ["min", "max", "seed", "draw"], "expr": "floor(random(seed,draw)*(max-min+1))+min" },
  "d20Check": { "params": ["modifier", "difficulty"], "expr": "clamp(dice(1,20)+modifier-difficulty+1,0,1)" },
  "percentCheck": { "params": ["skill"], "expr": "clamp(skill-dice(1,100)+1,0,1)" }
}
```

检定用有限数值 `1` 表示通过、`0` 表示失败。

## 可审计工作流

根 Nodeset `era.expression.execute_layer` 明确展示：请求验证 → 函数定义解析 → 依赖/纯度/调用图 → DFS 递归拒绝 → 编译 → 顺序操作循环 → 符号推导 → 规范化压缩。

内部 `ast_frame_step` 使用显式后序调用帧栈。其自定义函数分支先求实参、绑定形参、压入函数体 AST，并在子调用结束后回传父帧；因此嵌套调用不是隐藏在 JavaScript 动态编译或递归字符串替换中的行为。

正式实现审核图：`../../reports/era-expression-prototype-implemented.expanded.svg`。

## 验证

```bash
npm run typecheck
npm test
npm run test:sandbox
python ../../run.py architecture --config configs/era.expression.jsonc --output ARCHITECTURE.jsonc
python ../../run.py architecture --config configs/era.expression.jsonc --output ARCHITECTURE.jsonc --check
python ../../run.py validate --config configs/era.expression.jsonc
python ../../run.py quality --path .
python ../../run.py build --config configs/era.expression.jsonc --target node --profile esm-module --out-dir generated/node-release
python ../../run.py build --config configs/era.expression.jsonc --target browser --profile esm-module --out-dir generated/browser-release
npm run test:workflow
```

单元测试覆盖直接表达式、前向与嵌套调用、直接/间接递归、函数纯度、Gamma/阶乘/五阶导数/积分、顺序求值、`@` 禁止、无效操作保持原状态、随机黄金向量、自动/显式抽取、骰点与技能检定，以及来自旧参考项目的基础和嵌套调用样例。工作流探针同时执行 Node 与 browser AOT，并断言两端结果一致。

## 旧项目参考与差异

仅以 `references/local-expression-reference/函数计算器/源码/Calculator3.2.2/Calculator/Calculator/` 中的 `Equation.cs`、`EquationElement.cs`、`EquationHelper.cs`、`EquationCalculator.cs`、`EquationFinder.cs`、`LambdaBuilder.cs`、`BaseEquationCalculator.cs` 与 `equations/custom_equations.txt` 提取行为样例。

本实现以 token 流、不可变 AST、显式环境和完整调用图替代旧版的全局状态、文本替换、动态编译和仅用于删除提示的引用检查。
