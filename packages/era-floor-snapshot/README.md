# ERA 按楼快照与公开状态同步分发包

楼层与公开状态源码位于 `../../javascript_project/service/base_lib/domain/`：

- `floor_snapshot.ts`：按楼回放，登记为 `era.snapshot.floor_projection`。
- `public_state.ts`：作者状态投影，登记为 `era.snapshot.public_state`。
- `message_identity.ts`：状态栏/报告的原消息键解析，登记为 `era.snapshot.message_identity`。
- `../../base_lib/data_view/data_view.ts`：项目共享数据转换，登记为 `era.data_view`；Macro与Service直接引用，本包生成同源出口。

Service 直接消费登记源码；App 通过本包同步消费同一实现。`index.js`、模块 JS 与类型声明均由 `npm run build` 生成，禁止手改。`npm pack` 会先构建；打包后更新 App 的本地 tarball 依赖。构建器使用 App 的 TypeScript，源码依赖使用 Service root 安装的 lodash/类型；运行包声明 lodash 依赖。

原 `projectFloorSnapshot`/`projectFloorSnapshots` API 保持不变，0.1.2 增加 `projectPublicState`、`selectedMks`、`transformEraData` 和 `removeMetaFields` 出口。宿主身份、订阅与 UI 缓存仍由调用方负责。

0.1.3 增加 `messageMk` 同源出口，保留状态栏原有严格文本匹配语义；其余 MK 解析器不变。

0.1.4 改用项目级共享数据转换；特殊自有键（如 `__proto__`）保留为数据，不触发原型赋值。公开API保持不变。
