# ERA VibeFlow 文档索引

## 现行文档

- [`../README.md`](../README.md)：项目入口、工程边界和常用检查。
- [`migration/TODO.md`](migration/TODO.md)：当前唯一任务清单与发布阻塞条件。
- [`migration/最终报告.md`](migration/最终报告.md)：当前实现、测试证据和发布判断。
- [`migration/执行备忘录.md`](migration/执行备忘录.md)：按时间追加的实施审计日志；
  只以最后一节作为当前状态。
- [`testing/ERA前台UI测试需求.md`](testing/ERA前台UI测试需求.md)：当前前台组件的功能意图、
  UI 操作路径、预期结果、自动化缺口和专项验收条件。
- [`testing/ERA当前缺陷基线.md`](testing/ERA当前缺陷基线.md)：当前仍开放的 ERA 产品缺陷、
  用户可见表现、证据和后续修复验收条件的唯一权威入口。
- [`testing/ERA产品问题台账.md`](testing/ERA产品问题台账.md)：已经修复、排除或被当前缺陷基线
  取代的历史问题记录。
- [`testing/前台测试实施变更清单.md`](testing/前台测试实施变更清单.md)：本轮专项测试、
  Harness 合并与 UI 收口的复用、修改、删除、新增清单。
- `javascript_project/service/ARCHITECTURE.jsonc` 与
  `javascript_project/macro/ARCHITECTURE.jsonc`：由 VibeFlow `review` 生成的登记架构。
- [`development/README.md`](development/README.md)：酒馆运行时接口、ERA 宿主边界、上游兼容性
  与 Codex 分层开发入口。

## 审核与迁移证据

`migration/*-architecture-change-inventory.md`、版本升级 inventory、baseline manifest、
oracle fixture 和 planned/implemented SVG 是当时的审核证据。它们可以包含历史状态，
但不能覆盖现行 TODO、报告或机器审计结果。

## 历史归档

`archive/` 保存已经被当前实现替代的计划和历史 P2 状态快照。归档文件不会继续维护，
也不应作为当前开发入口。生成的 Architecture、SVG 和构建报告只能通过相应 VibeFlow
或项目命令刷新，禁止手工修改。
