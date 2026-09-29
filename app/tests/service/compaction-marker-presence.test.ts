import { describe, expect, it } from 'vitest';

import { withCommandCompactionMarkers } from '../../../javascript_project/service/base_lib/domain/commands/command_compaction_marker';

describe('封存压缩标记：没有标记时不得改动 meta', () => {
  it('空标记集不新增 CommandCompaction 键', () => {
    const meta = { SelectedMks: ['mk-1'], EditLogs: {} };

    // 真机 RUNTIME-COALESCE-CHAT-SWITCH-001：切换聊天再读回时 eraSidecar 必须逐字段不变；
    // 过去这里无条件写入 `CommandCompaction: {}`，让「同一聊天读回后侧车不变」的绑定断言失败。
    expect(withCommandCompactionMarkers(meta, {})).toEqual(meta);
    expect(Object.hasOwn(withCommandCompactionMarkers(meta, {}), 'CommandCompaction')).toBe(false);
  });

  it('有标记时照常写入', () => {
    const meta = { SelectedMks: ['mk-1'] };
    const markers = { 'mk-1': { version: 1, mk: 'mk-1', status: 'unchanged' } };

    expect(withCommandCompactionMarkers(meta, markers)).toEqual({
      SelectedMks: ['mk-1'],
      CommandCompaction: markers,
    });
  });
});
