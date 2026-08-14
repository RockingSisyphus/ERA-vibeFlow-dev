# ERA VibeFlow

ERA VibeFlow 是 ERA 的生产后继实现：异步业务服务和同步宏分别编译为两个
JavaScript/TypeScript AOT 模块，再由同一个 Tavern/webpack 应用入口装配。当前使用
VibeFlow 0.13.2，内部 contracts 版本为 1.4.0。

## 当前状态

发布状态为 `BLOCKED_VALIDATION`。三项已确认的 ERA 功能回退
`API-BOUND-011`、`SEM-ERR-007`、`SEM-KEY-015` 已完成系统性修正，当前没有剩余已知
ERA 产品回退。历史 P2 中另外三个 failed 已定位为 Harness Evaluator 证据读取问题，
`UI-NAV-004` 的 inconclusive 已定位为测试 fixture 缺少备用开场白。

Evaluator 修正和多开场白 fixture 已分别验证，但尚未合并到同一 Harness 工作树后重新
执行完整 P2，因此候选制品仍不可标记为 `READY`。两小时空闲长稳不是默认门禁；只有
用户直接、明确要求时才会执行。

## 工程边界

- `javascript_project/service`：异步 ERA Service，包含永久工作流、Host Extension、
  Capability、collection/planner、同步事务和公开 API。
- `javascript_project/macro`：同步 ERA Macro；不启用 Host Extension 或 Capability。
- `packages/era-contracts`：跨边界 DTO、Schema 和安全 JSON codec 的唯一来源。
- `app`：Vue/Pinia、webpack、Tavern adapter、唯一生产入口和差分测试 oracle。
- `generated`：VibeFlow AOT 构建输出，禁止手工修改。

## JSON 相对数值更新

`<VariableEdit>`、`era:updateByObject` 和 `era:updateByPath` 共用同一套有限数值运算：

```json
{
  "player": {
    "hp": { "$inc": -10 },
    "damageMultiplier": { "$mul": 1.2 },
    "cooldown": { "$div": 2 }
  }
}
```

运算对象必须恰好只有一个键，操作数、目标和结果必须是有限数字，`$div` 不能除以
0。无效字段会被跳过并产生诊断，同一指令的其他合法字段继续执行。不存在或受保护的
路径仍不会被修改。`"+=2"`、`"-=2"`、`"*=2"`、`"/=2"` 不属于运算语法，只是普通
字符串；ERA 不支持 `$sub`、`$set`、任意表达式、变量引用或数组运算。

## 常用检查

```bash
python run.py verify-kernel
python run.py validate --config javascript_project/service/configs/era.service.jsonc
python run.py validate --config javascript_project/macro/configs/era.macro.jsonc
python run.py quality --path javascript_project/service
python run.py quality --path javascript_project/macro
pnpm --dir app verify
pnpm --dir app build
```

工作流或节点变更必须遵循根目录 `AGENTS.md` 的协同审核流程。当前文档入口见
[`docs/README.md`](docs/README.md)，当前待办见
[`docs/migration/TODO.md`](docs/migration/TODO.md)。
