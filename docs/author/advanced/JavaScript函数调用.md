# JavaScript 函数调用

商店购买同时涉及余额、数量和参数检查，适合交给一个JavaScript函数。作者把实现放在酒馆助手的**角色脚本库**，加载角色卡时注册；AI只输出名称和参数，不生成函数源码。

## 注册一个购买函数

先使用[初级教程](../初级使用.md)的初值：金币10、食物1。下面脚本注册每份3金币的购买功能，数量必须是正安全整数。检查余额后，把扣款和增加食物放进一次提交：

```js
$(() => {
  const context = SillyTavern.getContext();
  const name = "era_rpg_buyFood";
  context.registerFunctionTool({
    name,
    displayName: "购买食物",
    description: "按每份3金币购买食物，quantity为购买份数",
    parameters: {
      type: "object",
      properties: { quantity: { type: "integer", minimum: 1 } },
      required: ["quantity"],
      additionalProperties: false,
    },
    shouldRegister: () => false,
    action: async (parameters) => {
      const ERA = globalThis.ERA ?? window.top.ERA;
      const api = ERA.forCall(parameters);
      const quantity = parameters.quantity;
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error("购买数量必须是正安全整数");
      }
      const cost = quantity * 3;
      const rpg = api.get().statData.era_demo.rpg;
      if (
        !Number.isSafeInteger(cost) ||
        !Number.isFinite(rpg.gold) ||
        !Number.isFinite(rpg.food) ||
        rpg.gold < cost
      ) {
        throw new Error("余额不足或商店数据无效");
      }
      const receipt = await api.commit(
        [
          {
            edit: {
              era_demo: {
                rpg: {
                  gold: { $expr: `era_demo.rpg.gold - ${cost}` },
                  food: { $expr: `era_demo.rpg.food + ${quantity}` },
                },
              },
            },
          },
        ],
        { scope: "always" },
      );
      return JSON.stringify({
        status: receipt.status,
        ...api.get().statData.era_demo.rpg,
      });
    },
  });
  $(window).on("pagehide", () => context.unregisterFunctionTool(name));
});
```

`ERA.forCall`必须收到action的**原始参数对象**，复制或提前解构后重建对象会失去调用位置。示例假定gold和food是可修改的普通数值；受保护字段仍遵循各自规则，一次commit不能被理解为绕过保护或自动实现商店事务回滚。

角色脚本随卡导出，但运行时注册表不作为变量存入Sidecar；重新打开页面时由脚本重新注册。同名注册覆盖旧定义，因此使用带角色前缀的名称，避免不同脚本相互覆盖。加载后应先完成注册，再让AI生成调用。

## 让AI调用

向世界书或相应阶段预设加入：

```text
购买食物时调用era_rpg_buyFood，quantity是份数，每份3金币。
在购买发生的位置输出：
<EraFCall name="era_rpg_buyFood" args='{"quantity":2}'/>
由函数负责扣金币和增加食物，不为同次购买重复输出变量修改。
不要添加status="done"。
```

初始金币10、食物1，调用后应为金币4、食物3。`args`必须是JSON对象；JSON字符串和XML属性引号都要正确转义。无参数工具可用 `args='{}'`；嵌套对象、数组、字符串的解释由作者决定。

注册中的description和parameters可用于酒馆原生工具请求；示例的 `shouldRegister: () => false` 阻止该工具进入原生请求，但ERA仍能按名称调用。ERA不会自动把所有工具整理成标签提示词。若开启原生工具调用，应另外编写适合原生环境的action；原生调用没有ERA消息位置，不能直接使用此示例的forCall逻辑。

## 顺序、完成与失败

函数可放在规划、正文、结算中的操作之间，读取执行到当前位置的内存状态。它的API记录作为普通ERA操作写在调用下方，后续块能看到结果。函数返回时，ERA先结清已发出的请求再继续；多个不await的commit按接收顺序处理，但紧跟的同步get不保证已读到它们。需要依赖结果时使用await。

完成的调用带 `status="done"`。只有此标记决定是否重执行：有done时重放普通操作记录；没有done时执行函数。修改已done的名称或参数不会重新执行，手动移除done才会。重放时函数记录的位置可被压缩调整。

例如在旧楼新增购买调用，重算会在该位置执行它并影响后续余额。直接去掉旧购买的done而保留其旧记录，会让新旧记录共同存在；作者或编辑者应明确自己的重做意图。

函数同步抛错、异步拒绝或未注册时，ERA报告错误、标done并继续后块；此前成功提交的操作保留。作者可捕获错误后继续。函数内部禁止所有sync（包括默认、auto、latest、full、rollbackTo），明确返回 `ERA_FUNCTION_SYNC_UNSUPPORTED`；捕获后仍可commit。上下文结束或取消后不能用延迟回调继续提交。

规划或结算候选随后被整体撤销时，这次购买的变量、操作记录和done也随候选撤销；外部网络或DOM副作用不承诺回退。详见[多阶段生成](多阶段生成.md)。
