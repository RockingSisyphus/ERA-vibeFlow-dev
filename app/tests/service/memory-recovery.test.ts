import { describe, expect, it } from 'vitest';
import { planEraSync } from './native-workflow-fixture';
import {
  messageContentVersion,
  readMkMessageText,
} from '../../../javascript_project/service/base_lib/domain/mk_engine';
import { execute } from './memory-batch-fixture';
const message = (messageId: number, text: string) => ({
  messageId,
  role: 'assistant' as const,
  content: { kind: 'text' as const, text },
});
describe('聊天先保存的恢复边界', () => {
  it('旧楼层MK没变但操作记录变化，重启重算从该楼层开始并影响后楼', async () => {
    const baseline = await planEraSync({
      messages: [
        message(0, '<VariableInsert>{"hp":100}</VariableInsert>'),
        message(1, '<EraFCall name="a" status="done"/><era_tx s="a"><VariableEdit>{"hp":70}</VariableEdit></era_tx>'),
        message(2, '<VariableEdit>{"hp":{"$expr":"hp*2"}}</VariableEdit>'),
      ],
      mkSeedsByIndex: [0, 1, 2].map(index => ({ timestamp: 1, token: `test000${index}` })),
      stat: {},
      statFunc: {},
      meta: {},
      reason: 'manual',
      processingMk: null,
      consecutiveState: null,
    });
    expect(baseline.stat).toEqual({ hp: 140 });
    const meta = {
      ...baseline.meta,
      MessageContentVersions: baseline.messages.map(item => messageContentVersion(readMkMessageText(item))),
    };
    const messages = baseline.messages.map((item, index) =>
      index === 1 ? message(1, readMkMessageText(item).replace('"hp":70', '"hp":60')) : item,
    );
    const recovered = await planEraSync({
      messages,
      stat: baseline.stat,
      statFunc: {},
      meta,
      reason: 'manual',
      processingMk: null,
      consecutiveState: null,
    });
    expect(recovered.stat).toEqual({ hp: 120 });
    expect(recovered.divergence).toMatchObject({ recalcId: 1 });
    expect(readMkMessageText(recovered.messages[1])).toContain('status="done"');
  });
  it('Sidecar失败时只把依据推进到本次已确认保存的文本，保留待保存状态', async () => {
    const result = await execute('<VariableEdit>{"hp":70}</VariableEdit>', { failSave: true });
    expect(result.working.sourceBasis.messages[0].activeText).toBe(result.writes[0].updates[0].message);
    expect(result.working.dirty).toBe(true);
    expect(result.working.record.state.statData.hp).toBe(70);
  });
});
