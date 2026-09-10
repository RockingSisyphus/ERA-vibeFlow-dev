# ERA 按楼快照与公开状态同步分发包

唯一可编辑源码位于 `../../javascript_project/service/base_lib/domain/`：

- `floor_snapshot.ts`：按楼回放，登记为 `era.snapshot.floor_projection`。
- `public_state.ts`：作者状态投影，登记为 `era.snapshot.public_state`。
- `data_view.ts`：数据转义、元字段过滤和 MK 选择，登记为 `era.snapshot.data_view`。

Service 直接消费登记源码；App 通过本包同步消费同一实现。`index.js`、模块 JS 与类型声明均由 `npm run build` 生成，禁止手改。`npm pack` 会先构建；打包后更新 App 的本地 tarball 依赖。构建器使用 App 的 TypeScript，源码依赖使用 Service root 安装的 lodash/类型；运行包声明 lodash 依赖。

原 `projectFloorSnapshot`/`projectFloorSnapshots` API 保持不变，0.1.2 增加 `projectPublicState`、`selectedMks`、`transformEraData` 和 `removeMetaFields` 出口。宿主身份、订阅与 UI 缓存仍由调用方负责。
