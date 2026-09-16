# ERA 消息内函数调用

本文对应正在验收的开发版本。基础消息内调用已实现；三阶段候选执行与整体回退已接入，71条函数专项已取得通过证据，最终分发物的全量回归正在进行。具体证据见[本轮测试矩阵](../../reports/era-function-completion-review-20260914/函数测试覆盖矩阵.md)。

## 注册与调用

作者通过酒馆原生函数工具接口注册 JavaScript 函数。ERA 解析消息中的 `<EraFCall/>`，交给酒馆的工具调用器执行。参数结构、条件、循环和异步操作由作者定义；同名工具重新注册沿用酒馆的覆盖规则。注册脚本需要随角色卡加载。

```js
const context = SillyTavern.getContext();
context.registerFunctionTool({
  name: 'increaseFavor',
  displayName: '增加好感度',
  description: '按指定数值增加好感度',
  parameters: {
    type: 'object',
    properties: { delta: { type: 'number' } },
    required: ['delta'],
    additionalProperties: false,
  },
  action: async parameters => {
    const ERA = globalThis.ERA ?? window.top?.ERA;
    const api = ERA.forCall(parameters);
    if (!Number.isFinite(parameters.delta)) throw new Error('delta 必须是有限数值');
    await api.commit([
      { insert: { favor: 0 } },
      { edit: { favor: { $expr: `favor + ${parameters.delta}` } } },
    ], { scope: 'always' });
    return JSON.stringify({ favor: api.get().statData.favor });
  },
  formatMessage: () => '调整好感度',
  shouldRegister: () => true,
});
```

消息中的写法：

```xml
<VariableInsert>{"favor":10}</VariableInsert>
<EraFCall name="increaseFavor" args='{"delta":5}'/>
<VariableEdit>{"favor":{"$expr":"favor*2"}}</VariableEdit>
```

执行到函数时读取到 10，提交后立即读取到 15，后面的普通操作得到 30。`args` 是 JSON 对象；字符串中的引号、反斜杠和换行应正确进行 JSON 转义，属性值还需要符合所用 XML 引号的转义要求。不要把任意 JavaScript 源码放进消息。

必须将传入 `action` 的**原始参数对象**交给 `ERA.forCall(parameters)`。复制对象或重建同值对象不能取得本次调用上下文。函数在每一处未标 done 的调用位置执行，与消息是否可见无关。酒馆原生工具调用仍由酒馆处理；原生调用不自动获得 ERA 消息位置，相关脚本使用普通 ERA API。

## API 的读写时点

`api.get()` 返回运行到当前调用位置的最新内存变量。`await api.commit(...)` 成功表示操作已实际应用到内存，后续读取和消息后续块都能看到它；这时聊天和 Sidecar 可能尚未保存。

多个不等待的 commit 仍按接收顺序应用。若需要根据提交结果计算下一步，请先 await；不能把提交后的同步 `get()` 当作已完成提交的保证。例如：

```js
const first = api.commit([{ edit: { favor: 20 } }], { scope: 'always' });
const second = api.commit([{ edit: { favor: { $expr: 'favor*2' } } }], { scope: 'always' });
await Promise.all([first, second]);
```

函数返回时，ERA 会结清它已发出的 API 请求，再处理后续块。调用结束后上下文失效；延迟定时器不能继续借用旧的 `api` 写入。函数内 `ready()` 可读取当前位置状态，不用于强制持久化。

函数位置 API 禁止所有 `sync`：默认调用、`auto`、`latest`、`full` 和 `rollbackTo` 都明确拒绝为 `ERA_FUNCTION_SYNC_UNSUPPORTED`。捕获该错误后仍可继续 commit。外部脚本使用普通 `ERA.sync()` 的行为保持不变。

message、branch、always 沿用公共 API 的作用域规则。同一执行窗口沿用首次准入：首次允许后，该窗口中的多个 commit 都可以执行，即使内容相同。进入后续窗口时，message 检查目标消息的记录，branch 检查活动分支的记录；已有对应记录则跳过，always 始终允许。这里不是按请求内容去重，保存防抖窗口也不等同于作用域执行窗口。scope 管理 ERA 操作，不能替代作者对网络请求、DOM 修改等外部行为的控制。

## 操作记录、done 与重放

函数产生的 ERA 操作以普通 `era_tx` 写在该调用下方，与状态栏和外部 API 的操作记录使用同一格式。状态栏和外部 API 仍在目标消息末尾追加记录。

函数结束后调用带有 `status="done"`。done 是唯一执行判据：有 done 时跳过函数，操作记录按普通指令重放；没有 done 时执行函数。修改带 done 的函数名或参数不会自动重新执行，手动去掉 done 才会执行。历史楼新增调用会在历史同步经过该位置时执行，并影响后续楼层。

压缩可以移动、合并函数留下的普通操作记录，done 调用不形成位置边界。只读 history、预览及压缩校验不会执行作者函数。旧 `EraFCallTx` 中的普通操作可以重放，其中的属性或记录存在与否都不代替 done。

普通作者函数抛错或异步拒绝时，ERA 保留已成功应用的操作，记录诊断、标 done 并继续后块。作者可以在函数内部捕获错误后继续提交。

## 三阶段与候选回退

规划按“JSON 前操作及函数 → JSON calls → JSON 后操作及函数”执行；结算直接输出六类 ERA 操作标签及 EraFCall，按原文位置逐块执行；操作之间可以自由插入函数调用，无变化时输出空文本，不输出 operations JSON、代码围栏或说明文字。正文同样按出现位置处理。下一阶段读取前一阶段完成后的状态；报告和 JSON 字符串中的调用文本不会成为执行指令。

规划或结算候选发生可纠错错误时，ERA 撤销**整次候选**的变量、函数库、日志、scope、随机状态、文本记录、done 和进度，再请求完整的新候选。此前成功的阶段保留。规划 JSON 或结算标签格式无效时，在对应位置失败，前面的函数可能已经执行过。结算标签直接保存在消息中并参与重放与压缩；报告的“AI 响应”显示原始标签。公共 ERA.commit 的操作数组接口保持原样。

因此，某次 commit 成功回执只证明它当时已经应用；候选随后失败时，该操作也会被撤销。作者函数本身抛错沿用成功前缀保留规则；如果所在候选之后失败，成功前缀也随整个候选撤销。ERA 不回退外部副作用。

替换阶段时，ERA 在发出模型请求前撤销被替换部分的变量及函数库效果：重新规划保留本轮之前的正文，重新正文保留本轮规划，重新结算保留本轮规划和正文。保留部分的 done 与普通操作记录继续有效。原生 Regenerate 撤销被替换回复；Continue 保留既有正文和函数库，并在其后执行新内容。

手动重新结算会先移除旧结算效果，保留规划、正文及其 done 和记录，再请求模型。新候选连续失败耗尽时保持“未结算”，不会用旧结算结果冒充成功。取消、保存失败和目标版本失效不作为模型纠错错误。

## 保存与恢复边界

完整消息或同步任务结束后批量保存；外部 API 的连续提交使用保存窗口。保存顺序是聊天消息在前、Sidecar 在后。普通公开 `ERA.ready()` 与最终呈现等待相应保存完成。

编辑、删除或切换 Swipe 会使旧目标失效，ERA 不能用旧计算覆盖用户的新内容。切聊天期间待保存工作按聊天身份隔离，恢复必须核对来源；这部分完整竞争场景仍在本轮专项验收范围内。

强制关闭酒馆后，恢复以已保存聊天为依据重新计算。尚未保存到聊天中的纯内存 API 请求不会被补造，作者脚本需要时自行重发。函数已产生的网络或页面副作用不属于 ERA 的回退与恢复范围。
