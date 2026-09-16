# ERA 浏览器宿主边界

此目录是 ERA 的浏览器宿主组合层：负责启动/停止 VibeFlow Service、注册同步宏、挂载 UI，及把 Tavern
Helper 的事件和高层 API 投影为受限 Host 能力。真实业务规则不应在此复制。

开始前阅读：

- `../../../docs/developer/开发总览.md`：宏观生命周期及宿主职责；具体顺序沿登记Architecture定位源码。
- `../../@types/iframe/event.d.ts` 和任务使用的 `../../@types/function/*.d.ts`：宿主接口签名。

通用规则：

- 聊天、变量、世界书和显示更新优先使用 Tavern Helper 高层 API；不得以 DOM 或 `exported.sillytavern.d.ts`
  替代已有高层操作。
- 只允许 `service/tavern-adapter.ts` 把 Tavern 副作用实现为 Host 能力；不在 UI、宏或旧 `events/**`
  中新增第二套业务调度器。
- 公开 `era:*` 事件、持久化数据格式、通知顺序和宏语义是 ABI；改动前必须明确用户批准，并同时更新合同测试和现行设计文档。
- 生命周期必须成对管理：注册的 listener、DOM、style、timer、global 入口和 pending work 在
  `pagehide`/stop 后必须由同一实例清理。

按子目录继续读取局部 `AGENTS.md`。`events/**`、`core/**`
的旧代码仅在现有差分测试所规定的范围内作为兼容 oracle；不要把它当作新的生产实现入口。
