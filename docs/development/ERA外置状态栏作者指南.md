# ERA 外置 HTML 状态栏（开发中）

本功能正在定向验收，尚未完成全部计划测试。进度和证据见
[实施清单](../../reports/era-external-statusbar-change-list.md)。

## 与聊天状态栏的区别

外置状态栏位于聊天区和输入区之间，不是聊天消息，不具有楼层、Swipe 或 MK。
`ERA.get()`、`ERA.ready()` 和 `ERA.subscribe()` 返回当前活动聊天的最新状态；
`ERA.history.atMessage(id)` 可显式查询历史。`ERA.commit()` 走原有 Service
队列和最新消息写入语义，不直接改 Sidecar。

## 开启、编辑和分享

在 ERA 设置中勾选“启用外置状态栏”，点击设置保存。开关和原始 HTML 存在角色卡
`extensions.era_external_statusbar` 中，无配置的旧角色卡默认关闭。
无角色卡或群聊不提供此区域，关闭悬浮球不影响已开启的外置状态栏。

点击区域中的“编辑”修改 HTML。输入会合并后自动保存，失焦或关闭编辑器会立即提交。
没有“取消修改”或单独的手动保存按钮。保存失败会保留草稿和重试入口；切回同一卡时
仍可恢复本页面尚未保存成功的草稿。页面关闭前应确认“已保存”，页面内草稿不是持久化备份。

保存不会重建正在运行的内容。点击“刷新”时先保存最新内容，成功后才新建一次 iframe。
因此刷新会再次执行作者的加载脚本，包括其中显式执行的 API 写入。
普通变量更新只更新宏和订阅，不会自动刷新或重新执行脚本。

导出角色卡前请确认“已保存”。HTML 中的外部库链接会随卡分享，但库文件不会自动打包。

## 精简环境

内容是原生 HTML，不是 Markdown，不需要代码围栏。浏览器负责 CSS 和 JavaScript；
ERA 不复制 Helper 私有渲染器，不为作者内容默认加载 jQuery、Vue 或 Tailwind。
作者可以自行添加内联代码、`script` 或 `link`。

首个作者脚本执行前提供：

- `ERA`：最新状态 Facade 和原有公共写入入口。
- `TavernHelper`：宿主已提供的公共接口，不复制私有 `_bind`。
- `SillyTavern.getContext()`：当前酒馆上下文。

没有虚构的“当前楼层”；依赖聊天内 iframe 楼层身份的 Helper 接口不适用于这里。

## 示例

```html
<style>
  body { margin: 0; padding: 12px; background: #243640; color: white; }
</style>
<p>HP：{{ERA:era_demo.player.hp}}</p>
<pre id="latest"></pre>
<script>
  (async () => {
    const show = state => {
      document.getElementById('latest').textContent =
        JSON.stringify(state.statData, null, 2);
    };
    show(await ERA.ready());
    ERA.subscribe(show);
  })();
</script>
```

HTML 文本和非执行属性中的 ERA 宏按最新状态绑定；宏值作为文本/属性值写入，
不当作额外 HTML。普通酒馆宏在挂载和显式刷新时通过宿主公共接口重新求值。
样式文本和 style 属性中的 ERA 宏在首个就绪状态求值一次，不随状态发布重复求值。
JavaScript 中使用 ERA API 获取结构化数据，不支持直接嵌入 ERA 宏。
这是精简公共环境的明确合同，不为脚本增加宏解释器；例如使用 `await ERA.ready()`
和 `ERA.subscribe()`，不要把 `{{ERA:path}}` 写进 JavaScript 字符串或表达式。

刷新、切聊天、切角色和卸载会释放旧实例订阅。作者界面内部的表单和节点在正常状态
更新时保留；显式刷新是新挂载，表单和加载脚本自然从保存的 HTML 重新开始。
