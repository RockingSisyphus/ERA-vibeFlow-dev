# 工作台同步预览包

唯一源码是 `javascript_project/service/base_lib/domain/workbench_operations.ts`、
`workbench_draft.ts`、`workbench_protection.ts`。Service 的实际 Commit 准备节点直接引用
这些源码；UI 使用本包执行同源同步预览。包内 JS 和声明均为生成物，不应手工修改。

重建：在此目录运行 `npm pack`（执行 `build.mjs`），更新 App 中对应 file tarball
依赖并运行 `pnpm --dir app install`。已发布 tarball 内容变化应提升包版本。

编辑基准、Sidecar 读取和事务准入属于 Service 节点，不在此浏览器预览包中发布。
