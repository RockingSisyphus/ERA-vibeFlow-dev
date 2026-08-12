# ERA Quality

ERA 专用的确定性 TypeScript/Vue 质量检查器。它只扫描 `src/ERA变量框架/**/*.{ts,vue}`，不会读取
`dist`、示例、测试或开发工具自身。

## 命令

- `pnpm quality`：与 `.era-quality-baseline.json`
  比较，新增、恶化、改善但未更新 baseline 或已解决但未移除的债务都会失败。
- `pnpm quality:audit`：忽略 baseline 展示完整结果；只要分析器正常完成就返回成功。
- `pnpm quality:json`：输出稳定排序且不含时间戳的 JSON。
- `pnpm quality:baseline`：首次创建 baseline，或在没有新增/恶化债务时递减更新。
- `pnpm typecheck:quality`：检查质检器本身。

规则和阈值存放在
`era-quality.config.json`。有意保留的例外必须在其中按规则、文件和对象精确声明，并提供带中文的理由及到期日。源码内没有静默 disable 指令。

## Baseline

baseline 保存 finding 的稳定指纹、严重度和债务值，不包含行号。普通代码移动不会制造新债务；阈值超出量增加则会被识别为恶化。债务减少或消失时，`pnpm quality`
会要求运行 `pnpm quality:baseline`，从而把改进锁定下来。

修改策略或规则实现源码都会改变 policy digest。审核规则变化后，使用：

```bash
pnpm quality:baseline -- --accept-policy-change
```

## 注释规则边界

中文和低价值注释规则覆盖 Vue 的 template、script 和 style；最低注释量只对 TypeScript 逻辑计算。工具能确定性发现语言、数量、缺少关键文档、注释代码、失效文件引用和高置信复述模式，但不会声称理解任意自然语言陈述是否与实现事实完全一致。

文件与函数的行数阈值只统计非空、非注释代码行；行尾带注释的代码仍计为一行。物理文件大小是独立的异常保护，上限为 120,000 字节，以容纳 UTF-8 中文设计说明。
