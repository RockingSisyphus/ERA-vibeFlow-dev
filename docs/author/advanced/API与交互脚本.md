# API 与交互脚本

状态栏显示金币后，可以增加购买按钮。所有写入统一使用commit，不直接修改get返回的对象、聊天变量或Sidecar。

## 先确定当前接口属于哪里

| 环境                      | 读取及写入目标                             | RPG例子                          |
| ------------------------- | ------------------------------------------ | -------------------------------- |
| 外置栏或外部角色脚本      | 当前活动聊天状态，记录追加到目标AI消息末尾 | 在最新剧情后购买食物             |
| 托管楼内状态栏            | 挂载时确认的消息和Swipe，记录追加该楼末尾  | 旧楼按钮的操作从旧楼影响后续历史 |
| `ERA.forCall(parameters)` | 执行到消息调用位置的状态，记录在调用下方   | 剧情先扣钱，再按余额决定奖励     |

角色脚本先 `await waitGlobalInitialized('ERA')`；外置环境已提供ERA。托管模板必须按[显示模式](显示模式与状态栏.md#传统模板的挂载结构)先挂载，不再次绑定全局接口。

## 接口参考

| 接口                                       | 作用与RPG示例                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `get(options?)`                            | 同步读快照；取得当前金币。loading时不要沿用上一聊天的数据                           |
| `ready(options?)`                          | 等待当前已接收操作处理与保存完成；函数位置接口读取当前位置，不强制落盘          |
| `subscribe(listener)`                      | 订阅发布的状态，返回注销函数；刷新金币文字。通知不保证每个内存中间块都单独呈现      |
| `commit(operations,{scope?})`              | 按顺序应用操作；购买后扣钱并增加食物                                                |
| `sync({mode?})`                            | auto默认同步、latest重算末楼、full完整重算；修复编辑后的余额                        |
| `sync({rollbackTo:id})`                    | 回到指定消息处理后的变量状态；不删除聊天正文                                        |
| `history.atMessage(id)`                    | 只读查询指定楼处理后的状态；核对购买前余额，不执行作者函数                          |
| `forCall(parameters)`                      | 取得原始工具参数对象绑定的调用位置接口；见[函数调用](JavaScript函数调用.md)         |
| `generation.subscribe(listener,{stages?})` | 订阅成功阶段，返回注销函数；阶段完成后更新战斗日志，详见[多阶段生成](多阶段生成.md) |
| `statusbar.mount(window)`                  | 为传统iframe建立楼层绑定；不要用于外置模板                                          |
| `statusbar.list()`                         | 列出托管楼层摘要，供“查看购买记录”选择器使用                                        |
| `statusbar.select(id)`                     | 按需选择旧楼显示，仍需存在可显示的消息实例                                          |
| `statusbar.clearSelection()`               | 撤销额外旧楼选择，回到范围策略                                                      |

get/ready的 `force`、`overflow: 'placeholder'|'empty'|'hidden'` 用于托管历史显示。状态包含status、statData（含元数据）、stat/statWithoutMeta、statFunc、identity、revision、message_id、mk，以及日志和元数据投影；普通业务优先读取statData和statFunc，不依赖内部追踪数组自己恢复历史。

普通变量提交把记录追加到消息，酒馆保持已有 iframe。外部脚本向已完成的楼层提交成功后，可立即打开该楼编辑，编辑器会读到包含事务的正文。向已经打开编辑器的目标楼层提交时，接口会返回 `ERA_API_MESSAGE_EDITING`，作者可在用户保存或取消编辑后重试。托管状态栏中的 ERA 文本宏随发布的快照原地更新。自定义界面可在 `ERA.ready()` 后用 `ERA.subscribe(render)` 更新现有节点。新回复首次缺少状态栏标记时，ERA 补写标记并请酒馆呈现该楼。

外部 `ERA.get()` 在重算期间读取最近一次完整结果。作者函数通过 `ERA.forCall(parameters)` 读取执行到调用位置时的变量，等自己的 `commit` 返回后即可读到更新。函数返回后，ERA 接着处理下一块正文，整轮完成后统一保存。

## 提交与读回

```js
await ERA.ready();
const receipt = await ERA.commit(
  [
    {
      edit: {
        era_demo: {
          rpg: {
            gold: { $expr: "era_demo.rpg.gold - 3" },
            food: { $expr: "era_demo.rpg.food + 1" },
          },
        },
      },
    },
  ],
  { scope: "always" },
);
console.log(receipt.status, ERA.get().statData.era_demo.rpg);
```

该片段演示接口，商店正式按钮还应像[购买函数](JavaScript函数调用.md#注册一个购买函数)一样检查余额和数量。从金币10、食物1开始，成功后读到7和2。

操作项支持insert/edit/delete/functionInsert/functionEdit/functionDelete。成功回执含 `status: 'committed'|'skipped'`、scope、messageId和state。**commit成功表示操作已应用到内存，不表示聊天与Sidecar已完成持久化。** 多次不await提交仍按接收顺序处理；下一次计算依赖结果时先await。一次提交不额外承诺所有业务变化原子回滚。

数组逐项写入使用相同的 `$arrayOps` 载荷。下面把已经存在的第一件装备的耐久改成 8。路径中的 0 是数组下标，若对象键的名字是 0，则写成字符串 `"0"`。数值保护和整数组日志仍按[数组与 Meta 规则](变量结构与保护.md#按位置操作数组)处理。

```js
await ERA.commit([
  { edit: { $arrayOps: [{ path: ["装备", 0, "耐久"], value: 8 }] } },
], { scope: "always" });
```

完整任务结束或保存窗口到期时批量保存，先聊天、后 Sidecar。外部脚本如果要在提交后马上刷新页面，可先等待 `await ERA.ready()` 确认已保存状态。用户强制关闭页面后，恢复只依据已保存聊天。编辑、删除、Swipe、切聊天或取消会使旧目标失效，错误会通过 Promise 返回。

## scope控制哪一轮允许写入

| scope             | 窗口规则                                                        | RPG用途            |
| ----------------- | --------------------------------------------------------------- | ------------------ |
| `message`（默认） | 同一获准消息窗口内可多次提交；后续窗口发现该消息已有m记录则跳过 | 每楼首次激活的奖励 |
| `branch`          | 按当前活动分支的b记录判断，换到无记录分支可再执行               | 分支首次领取补给   |
| `always`          | 每次允许的请求均执行                                            | 玩家明确点击购买   |

scope不是按payload去重，也不是按函数名去重；保存防抖窗口不等于scope窗口。不同函数及外部API可能共享实际窗口，不应给多个独立奖励盲目套用默认scope。

API记录是普通era_tx，随历史重放；外部脚本重启后要不要重发由作者决定。函数位置接口禁止所有sync；错误可捕获，之后仍可提交有效操作。上下文结束后不能继续使用它。
