# ERA 浏览器宿主边界

此目录是 ERA 的浏览器宿主组合层：调用一次原生辅助workflow入口、提供Tavern API发现及展示端口、注册同步宏和挂载UI。事件、Capability、任务和资源生命周期由javascript_project/tavern的Node组合执行。真实业务规则不应在此复制。

开始前阅读：

- `../../../docs/developer/开发总览.md`：宏观生命周期及宿主职责；具体顺序沿登记Architecture定位源码。
- `../../@types/iframe/event.d.ts` 和任务使用的 `../../@types/function/*.d.ts`：宿主接口签名。

通用规则：

- 聊天、变量、世界书和显示更新优先使用 Tavern Helper 高层 API；不得以 DOM 或 `exported.sillytavern.d.ts`
  替代已有高层操作。
- Tavern副作用由 `javascript_project/tavern` 的已登记Node执行；此目录保留API发现、公共Facade和展示，不在UI、宏或旧events中新增业务调度器。
- 公开 `era:*` 事件、持久化数据格式、通知顺序和宏语义是 ABI；改动前必须明确用户批准，并同时更新合同测试和现行设计文档。
- 生命周期必须成对管理：注册的 listener、DOM、style、timer、global 入口和 pending work 由辅助workflow资源Node在pagehide/取消及finally中清理，并等待实际异步收尾。

按子目录继续读取局部 `AGENTS.md`。`events/catalog.ts`保留公共事件目录；旧core差分参考已退役，其行为期待由正式工作流和静态结果数据承接。领域逻辑以Service为入口，不恢复旧Host调度。
