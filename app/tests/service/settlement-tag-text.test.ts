import { expect, it } from 'vitest';
import { inspectSettlementText } from '../../../javascript_project/service/base_lib/agent/agent_stage_text';

it('标签载荷中的转义与调用文本保持原文，不当成顶层调用执行', () => {
  const text = `<VariableInsert>{"text":"<EraFCall name="quoted"/>"}</VariableInsert>`.replace(
    'name="quoted"',
    'name=\\"quoted\\"',
  );
  expect(inspectSettlementText(text)).toEqual({ content: text, prefix: text, error: null });
});
it('129个标签无结算专用项数上限', () => {
  const text = '<VariableEdit>{"hp":1}</VariableEdit>'.repeat(129);
  expect(inspectSettlementText(text).error).toBeNull();
});
it('有效操作与调用交错时不改变任何原文', () => {
  const text =
    '<VariableInsert>{"hp":100}</VariableInsert><EraFCall name="buy" args=\'{"quantity":2}\'/><VariableEdit>{"hp":70}</VariableEdit><VariableInsert>{"food":2}</VariableInsert>';
  expect(inspectSettlementText(text)).toEqual({ content: text, prefix: text, error: null });
});
