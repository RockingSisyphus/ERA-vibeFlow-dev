import {defineBaseLib} from "@vibeflow/plugin";
export const mechanicalBindings = defineBaseLib({
 id:"era.tavern.mechanical_bindings",display_name:"从接口声明生成的固定AOT调用接线",
 description:"已登记的纯生成函数读取本root的bindings.jsonc接口数据，生成generated/bindings.mjs构建产物。产物只投影参数与结果，调用三个辅助AOT入口和主Service AOT；队列、回执和资源管理均由原生Node执行。接口JSONC属于构建数据，生成接线与AOT同为输出，均不是手写实现源码。",
 implementations:[{language:"javascript",targets:["node"],source:{kind:"file",ref:"scripts/generate-bindings.mjs",export:"generateBindings"}}],
 rulesets:["vibeflow.data_store"]
});
