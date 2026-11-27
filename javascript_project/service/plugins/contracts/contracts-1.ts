import {defineDataSchema} from "@vibeflow/plugin";

export const contract_0_12 = defineDataSchema({
  "type_key": "era.tavern.character.single_floor.request",
  "representation": "json",
  "schema": {"type":"object","required":["characterId","enabled"],"properties":{"characterId":{"type":"string"},"enabled":{"type":"boolean"}}},
  "display_name": "角色卡单层显示设置请求",
  "description": "指定角色卡及其单层显示开关。"
});

export const contract_0_13 = defineDataSchema({
  "type_key": "era.tavern.character.single_floor.result",
  "representation": "json",
  "schema": {"type":"object"},
  "display_name": "角色卡单层显示设置结果",
  "description": "返回本次单层显示设置的宿主处理结果。"
});

export const contract_0_14 = defineDataSchema({
  "type_key": "era.agent.auxiliary.execution_request",
  "representation": "json",
  "display_name": "ERA 多阶段生成 辅助阶段执行请求",
  "description": "保存规划或结算阶段所需的角色配置、预设摘要和本机模型连接引用。连接使用方案标识及名称，供宿主找到实际连接配置。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["schemaVersion","routedStep","executionState","hostContext","configurationVersion","migrationMode","configuration","stages","diagnostics"],"properties":{"schemaVersion":{"const":2},"routedStep":{"type":"object","additionalProperties":true},"executionState":{"type":"object","additionalProperties":true},"hostContext":{"oneOf":[{"type":"object","additionalProperties":true},{"type":"null"}]},"configurationVersion":{"oneOf":[{"enum":["1","2"]},{"type":"null"}]},"migrationMode":{"enum":["not-applicable","v1-preserved","v2"]},"configuration":{"type":"object","additionalProperties":true},"stages":{"type":"array","maxItems":2,"items":{"type":"object","additionalProperties":false,"required":["stage","enabled","retryCount","attempts"],"properties":{"stage":{"enum":["planning","settlement"]},"enabled":{"type":"boolean"},"retryCount":{"type":"integer","minimum":0,"maximum":16},"attempts":{"type":"array","minItems":1,"maxItems":17,"items":{"type":"object","additionalProperties":false,"required":["preset","modelSource"],"properties":{"preset":{"type":"object","additionalProperties":false,"required":["source"],"properties":{"source":{"enum":["builtin","snapshot"]},"sourceName":{"type":"string","maxLength":256},"orderedPrompts":{"type":"array","maxItems":256,"items":{"oneOf":[{"type":"string"},{"type":"object","additionalProperties":true}]}},"settings":{"type":"object","additionalProperties":true}}},"modelSource":{"type":"object","additionalProperties":false,"required":["kind"],"properties":{"kind":{"enum":["tavern-current","custom-profile"]},"profileId":{"type":"string","minLength":1,"maxLength":256},"profileNameHint":{"type":"string","maxLength":256},"model":{"type":"string","minLength":1,"maxLength":512},"legacyModelOverride":{"type":"string","minLength":1,"maxLength":512}}}}}}}}},"diagnostics":{"type":"array","maxItems":128,"items":{"type":"object","additionalProperties":false,"required":["code","message"],"properties":{"code":{"type":"string","minLength":1,"maxLength":256},"message":{"type":"string","maxLength":4096}}}}}}
});

export const contract_0_15 = defineDataSchema({
  "type_key": "era.agent.candidate.done",
  "display_name": "本阶段是否已成功或无法继续",
  "representation": "json",
  "schema": {"type":"boolean"},
  "description": "为真时结束候选重试循环；为假时使用更新后的请求再试一次。"
});

export const contract_0_16 = defineDataSchema({
  "type_key": "era.agent.candidate.outcome",
  "display_name": "候选循环最终结果",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":true},
  "description": "候选完成后交给生成会话的结果；内部重试请求不向外传播。"
});

export const contract_0_17 = defineDataSchema({
  "type_key": "era.agent.candidate.state.next",
  "display_name": "本次尝试后的进度及重试请求",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":false,"required":["request","step","executionState"],"properties":{"request":{"type":"object","additionalProperties":true},"step":{"type":"object","additionalProperties":true},"executionState":{"type":"object","additionalProperties":true}}},
  "description": "保留步骤与批次状态，并在需要重试时替换生成请求。"
});

export const contract_0_18 = defineDataSchema({
  "type_key": "era.agent.candidate.state",
  "display_name": "本次模型尝试的请求、起点和进度",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":false,"required":["request","step","executionState"],"properties":{"request":{"type":"object","additionalProperties":true},"step":{"type":"object","additionalProperties":true},"executionState":{"type":"object","additionalProperties":true}}},
  "description": "保存本次候选的生成请求、已准备步骤和所属批次状态。"
});

export const contract_0_19 = defineDataSchema({
  "type_key": "era.agent.connection.state",
  "representation": "json",
  "display_name": "本机连接公开事实",
  "description": "当前记录数、查找键存在性与有效记录摘要，不包含秘密值。",
  "schema": {"type":"object","required":["entryCount","entryExists","profile"],"additionalProperties":false,"properties":{"entryCount":{"type":"integer","minimum":0},"entryExists":{"type":"boolean"},"profile":{"type":["object","null"],"properties":{"id":{"type":"string"},"name":{"type":"string"},"apiUrl":{"type":"string"},"hasKey":{"type":"boolean"}},"required":["id","name","apiUrl","hasKey"],"additionalProperties":false}}}
});
