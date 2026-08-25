# ERA Sidecar Storage Probe

这是一个**非生产** Demo，用于回答一个很具体的问题：SillyTavern 中的 Tavern Helper 前端能否经由受限的本机接口，把数据持久化到不属于聊天文件的本地位置。

答案是可以，但实现不是“纯 Tavern Helper 脚本直接调用 `fs`”。浏览器脚本只调用同源 HTTP 接口；真正的文件读写由 SillyTavern Server Plugin 在 Node.js 侧完成。

## Demo 的边界

- 每个 SillyTavern 用户只在自己的 `data/<user>/extensions/era-sidecar-storage-probe/` 下读写记录。
- 请求只可传入受限的 `key`，不能指定路径、目录或扩展名。
- 单条 JSON payload 上限 64 KiB；写入采用同目录临时文件加 rename，避免半写入记录。
- 此 Demo 只写入自检数据，不读取聊天，也不存 ERA 真实变量。
- 它是文件存储探针，不是最终的 ERA Sidecar 数据模型或迁移工具。

## 安装到本机 SillyTavern

1. 将 `server-plugin/` 整个目录复制到 `<SillyTavern>/plugins/era-sidecar-storage-probe/`。
2. 在 `<SillyTavern>/config.yaml` 中设置：

   ```yaml
   enableServerPlugins: true
   enableServerPluginsAutoUpdate: false
   ```

3. 重启 SillyTavern。Server Plugin 会注册以下同源路由：

   ```text
   /api/plugins/era-sidecar-storage-probe/health
   /api/plugins/era-sidecar-storage-probe/write
   /api/plugins/era-sidecar-storage-probe/read
   /api/plugins/era-sidecar-storage-probe/delete
   ```

4. 将 `client/era-sidecar-storage-probe-client.js` 作为 Tavern Helper 脚本载入；随后在浏览器控制台或脚本中执行：

   ```js
   await ERA_SIDECAR_STORAGE_PROBE.runSelfTest();
   ```

   该操作会写入随机 token、读回比较、再删除；成功时不会留下测试记录。

## 平台结论与限制

- **Windows / Linux**：只依赖 Node.js 标准库的 `path` 和文件 API，路径不包含平台分隔符假设；只要 SillyTavern 的 Node 服务在本机运行即可使用。
- **Android**：仅当设备本机运行的是支持 Server Plugin 的 SillyTavern Node 服务（例如官方 Termux 方案）时可用。若 Android 浏览器只是连接远端电脑的 SillyTavern，文件会写在那台远端电脑，而不是手机。
- 本仓只能在当前 Linux 环境实际执行合同测试；Windows 和 Android 必须分别安装后运行 `runSelfTest()` 才能标为已验证。Demo 的 `/health` 会返回实际 `platform` 与 Node 版本作为证据。

## 本机合同测试

```bash
node prototypes/era-sidecar-storage-probe/test/contract.mjs
```

测试覆盖每用户目录隔离、写后读回、删除、路径穿越拒绝和大小限制。它直接调用 Plugin 的真实路由处理器，但不会重启或修改正在使用的 SillyTavern。

## 未来 ERA Sidecar 不应直接复用的部分

最终方案需要额外实现：按聊天/分支稳定标识的账本、操作顺序与 checkpoint、聊天复制时 copy-on-write、导入导出包、崩溃恢复和旧聊天迁移。此 Demo 只证明最底层的本地受限持久化能力。
