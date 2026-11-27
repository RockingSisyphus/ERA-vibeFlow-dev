import {defineDataSchema} from "@vibeflow/plugin";
export const runtimeNext = defineDataSchema({"type_key": "era.tavern.runtime.state.next", "representation": "json", "display_name": "下一轮职责处理状态", "description": "继续时携带当前实例；退出时只携带轻量完成标记，不留下任务控制器。", "schema": {}});

export const runtimeDone = defineDataSchema({type_key:"era.tavern.runtime.done", representation:"json", display_name:"职责分支是否结束", description:"true表示本职责已停止，false表示继续等待下一次输入。",schema:{type:"boolean"}});

export const runtimeResult = defineDataSchema({type_key:"era.tavern.runtime.result",representation:"json",display_name:"所有职责退出后的确认",description:"资源、Service、作者、通知和计时分支全部真实结束后返回停止确认。",schema:{type:"object",properties:{status:{const:"stopped"}},required:["status"],additionalProperties:false}});

export const transportNext = defineDataSchema({type_key:"era.tavern.transport.next",representation:"json",display_name:"本轮通信完成后的本地实例",description:"事件已交出或回信已落实后保留当前实例资源，供下一轮继续，或供结束汇合确认。只在酒馆图内部传递，不进入官方消息。",schema:{}});
