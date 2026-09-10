# 按楼快照同步分发包

唯一可编辑源码：`../../javascript_project/service/base_lib/domain/floor_snapshot.ts`，登记为 `era.snapshot.floor_projection`。本目录 `index.js` 与 `index.d.ts` 由 `npm run build` 生成，不手改。`npm pack` 会先构建。

Service 直接依赖已登记 base_lib；App 通过本包同步调用相同实现。包名与 projectFloorSnapshot/projectFloorSnapshots API 保持不变。更新后安装新 tarball 并构建 App；不要增加第二份算法副本。
