# SwipeAwaitDemo

这是一个隔离的 Tavern Helper 后台脚本，用来验证：

> 当 `MESSAGE_SWIPED` 的监听器返回一个尚未完成的 Promise 时，SillyTavern 是否会等待它完成后才继续生成和发送模型请求。

它不会修改 ERA 的事件队列、500ms/600ms 等待策略或变量同步逻辑。

## 使用

1. 启动项目开发服务并生成 `dist/SwipeAwaitDemo/index.js`。
2. 在 Tavern Helper 中导入同目录的 `酒馆助手本地导入.json`。
3. 只启用一个 `SwipeAwaitDemo-本地导入` 实例。
4. 在最后一条 AI 消息的最后一个 swipe 上继续右滑，以触发 `Generate("swipe")`。

为了避免调用真实模型，可以另开终端启动配套的本地固定回复服务：

```bash
node scripts/swipe-await-mock-kobold.mjs
```

然后在隔离测试酒馆中选择 KoboldAI，将 API 地址设为：

```text
http://127.0.0.1:19001/api
```

服务只监听 IPv4 loopback。请求到达时间可通过以下命令读取：

```bash
curl -fsS http://127.0.0.1:19001/probe
```

脚本只会在 `swipe_id >= swipes.length` 的 overswipe 临时槽位等待 5000ms；切换已有 swipe 只记录、不延迟。overswipe 时会依次记录：

```text
message-swiped-enter
约 5000ms
message-swiped-release
generation-started
generate-after-data
模型网络请求
```

时间记录同时写入控制台和顶层页面：

```js
window.__ERA_SWIPE_AWAIT_DEMO__.records
```

## 2026-07-27 实测

在 SillyTavern 1.18.0、Tavern Helper 4.8.19 的隔离测试实例中，右滑 `1/1` 创建新 swipe 后得到：

```text
MESSAGE_SWIPED 进入             1785102182961
Promise 释放                    1785102187962  (+5001ms)
GENERATION_STARTED              1785102187986  (+24ms)
GENERATE_AFTER_DATA             1785102188164  (+202ms)
假 Kobold /api/v1/generate 到达 1785102188182  (+220ms)
```

因此这条链路确实会等待异步 `MESSAGE_SWIPED` 监听器完成：5 秒等待期间没有进入生成阶段，模型请求在 Promise 释放约 220ms 后才到达后端。

测试完成后应停用或删除本 demo，避免后续 overswipe 多等待 5 秒。
