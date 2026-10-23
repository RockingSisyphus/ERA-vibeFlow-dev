import {defineDataSchema} from "@vibeflow/plugin";

export const contract_1_0 = defineDataSchema({
  "type_key": "era.expression.value",
  "representation": "json",
  "display_name": "表达式数值",
  "description": "表达式求值得到的有限数值或定位诊断的 JSON 结果。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});
