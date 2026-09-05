# ERA 托管状态栏作者指南

## 适用范围

本指南适用于快速初始化生成的 V2 托管状态栏。旧式状态栏不会被 ERA 自动改写，仍按旧行为
运行；ERA 会将其标记为 `legacy-unmanaged`，但不会承诺按楼快照、首帧就绪或无重绘更新。

ERA 继续只持久化最新状态、完整变量/函数修改日志、`SelectedMks` 和 Sidecar revision，
不会为每个聊天楼层长期保存一份完整快照。托管状态栏所需的历史状态在显示时按日志计算，
并且只缓存当前激活的少量楼层。

## 模板结构

状态栏使用 Tavern Helper 原生渲染的 HTML 片段。CSS、HTML、Web Component 和脚本由
浏览器正常解析执行；ERA 只绑定现有根节点中的宏，确认楼层快照后解除隐藏：

```html
<!-- html> Tavern Helper 前端片段识别标记 -->
<style>.statusbar { padding: 12px; background: #243641; color: white; }</style>
<script data-era-statusbar-bootstrap>
  const mountEraStatusbar = () => window.parent.ERA.statusbar.mount(window);
  window.eraStatusbarMounted = window.parent.ERA
    ? mountEraStatusbar()
    : waitGlobalInitialized('ERA').then(mountEraStatusbar);
</script>
<section class="statusbar" data-era-statusbar-root="v1" hidden inert>
  <div>HP：{{ERA:era_demo.player.hp}}</div>
  <div>完整对象：{{ERA-withmeta:era_demo.player}}</div>
</section>
<script>
  void (async () => {
    await window.eraStatusbarMounted;
    const state = await ERA.ready();
    console.log(state.message_id, state.mk, state.statData);
  })();
</script>
```

在模板首次可见前，ERA 会重新从当前页面的 iframe、父消息 DOM、当前 Swipe、消息 MK、
`SelectedMks` 和 Sidecar 身份推导它属于哪一楼。页面 reload、切换聊天、切换角色或重启
SillyTavern 后也会重新推导，不依赖旧页面内存。

片段开头的 `html>` 注释用于当前 Tavern Helper 的前端内容识别（其 `isFrontend` 检查
`html>`、`<head>` 或 `<body`）。它不是第二份 HTML 文档外壳；不要因此再嵌套
`doctype/html/head/body`。这项识别仍由 Helper 完成，ERA 不替代其解析器。

bootstrap 必须先于使用 ERA 的作者脚本。`mount()` 同步安装局部 Facade，随后等待 DOM、
身份和状态；`get()` 在此期间返回 loading，`commit()` 拒绝未就绪写入。依赖 ERA 数据的
逻辑应等待 `ERA.ready()`；与 ERA 无关的脚本照常执行。ERA 不复制节点、替换 body、
移动 style 或重放作者脚本。后续发布只更新已有宏绑定和订阅。

首次载入旧聊天时，iframe 可能早于顶层 ERA 脚本启动。因此 bootstrap 使用 Helper 原生的
`waitGlobalInitialized('ERA')` 等待共享接口，而作者首次入口先等待 `eraStatusbarMounted`。
不要在挂载后再次调用 `waitGlobalInitialized('ERA')`：Helper 会把本楼 Facade 替换成全局
接口的 getter。挂载完成后的所有读取、订阅和写入只使用本楼 `ERA`。

## 读取变量

托管状态栏中的宏自动使用所在楼层快照：

```html
<span>{{ERA:world.player.hp}}</span>
<pre>{{ERA-withmeta:world.player}}</pre>
```

JavaScript API 也自动使用所在楼层：

```js
const state = await ERA.ready();
const hp = state.statData.world.player.hp;

const current = ERA.get();
console.log(current.message_id, current.mk, current.statFunc);

const unsubscribe = ERA.subscribe(nextFloorState => {
  console.log(nextFloorState.statData);
});
```

状态栏外的 `ERA.get()` 与 `ERA.subscribe()` 保持原语义，读取当前活动分支的最新状态。显式
查询任意历史楼仍可使用 `await ERA.history.atMessage(messageId)`。

## 写入变量和函数

托管状态栏内的 `ERA.commit()` 自动绑定到该状态栏所在消息和当前 Swipe，无需作者传递
messageId：

```js
const receipt = await ERA.commit(
  [{ edit: { world: { player: { hp: 13 } } } }],
  { scope: 'message' },
);
```

ERA 会把操作真实写入该消息，从该楼开始重算后续历史并提交 Sidecar。更新通过原有 iframe
直接推送，不重绘整条消息、不重建 iframe，也不会再次执行模板脚本。两次用户明确点击同一
按钮仍是两次合法操作，不按 payload 去重。

## 历史显示范围

默认只激活当前活动分支中最近 3 个含托管状态栏的 AI 楼层。更早状态栏按设置使用：

- `placeholder`：显示 ERA 休眠占位栏；
- `empty`：保留空外壳；
- `hidden`：隐藏整个外壳。

作者可以在状态栏根节点上声明单楼策略：

```html
<section data-era-statusbar-root="v1" data-era-overflow="empty" hidden inert>
  ...
</section>
```

确实需要始终激活的单个模板可声明：

```html
<section data-era-statusbar-root="v1" data-era-force-display="true" hidden inert>
  ...
</section>
```

已经存在的状态栏实例也可使用 `await ERA.ready({ force: true })` 确定性地按需计算旧楼快照。
`ERA.get({ force: true })` 会发起相同请求，但第一次同步调用仍可能先返回 loading 状态。

用户还可以在 ERA UI 的“指定显示历史状态栏”区域临时选择一个额外楼层；这个选择只在当前
页面有效，不写入角色卡或 Sidecar。

范围外根节点保持 hidden/inert，只有 `placeholder` 会在旁边插入 ERA 自有提示。
作者脚本仍由浏览器执行，但 `ERA.ready()` 继续等待，ERA 写入被拒绝。强制显示或 UI
指定后才释放就绪；休眠和唤醒均保留原 DOM、表单及监听器。

## 兼容与迁移

- 快速初始化新建的是托管模板，并且只用
  `<!-- ERA_DEMO_GREETING_V2_BEGIN -->` 这一个固定标记判断是否已经初始化：标记存在即不再追加，
  标记不存在即允许追加。它不比较示例块全文，也不要求结束标记，因此酒馆换行规范化或作者修改
  标记后的示例内容不会破坏幂等判断。
- 旧角色卡中的非托管状态栏不会自动升级或删除。
- “强制重载功能”和“强制重载消息数”已经退役；旧设置会被忽略，保存新设置时不再写回。
- 状态栏正确性不得依赖编辑消息、reload、刷新整个消息或延迟碰运气。
