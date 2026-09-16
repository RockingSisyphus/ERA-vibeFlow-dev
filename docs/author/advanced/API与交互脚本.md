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
| `ready(options?)`                          | 等待就绪；普通接口还等待相应保存完成，函数位置接口读取当前位置，不强制落盘          |
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

完整任务结束或保存窗口到期时批量保存，先聊天、后Sidecar。用户强制关闭页面后，恢复只依据已保存聊天；纯内存请求不会凭空补造。编辑、删除、Swipe、切聊天或取消会使旧目标失效，错误会通过Promise返回，不覆盖新内容。

## scope控制哪一轮允许写入

| scope             | 窗口规则                                                        | RPG用途            |
| ----------------- | --------------------------------------------------------------- | ------------------ |
| `message`（默认） | 同一获准消息窗口内可多次提交；后续窗口发现该消息已有m记录则跳过 | 每楼首次激活的奖励 |
| `branch`          | 按当前活动分支的b记录判断，换到无记录分支可再执行               | 分支首次领取补给   |
| `always`          | 每次允许的请求均执行                                            | 玩家明确点击购买   |

scope不是按payload去重，也不是按函数名去重；保存防抖窗口不等于scope窗口。不同函数及外部API可能共享实际窗口，不应给多个独立奖励盲目套用默认scope。

API记录是普通era_tx，随历史重放；外部脚本重启后要不要重发由作者决定。函数位置接口禁止所有sync；错误可捕获，之后仍可提交有效操作。上下文结束后不能继续使用它。
