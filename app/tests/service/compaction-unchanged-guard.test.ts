import { describe, expect, it } from 'vitest';
import { writeSingleScopeSegments } from '../../../javascript_project/service/base_lib/sync/command_compaction';
const ORIGINAL =
  '<VariableEdit>{"era_demo":{"player":{"hp":13}}}</VariableEdit><FunctionInsert>{"f":{"params":["x"],"expr":"x+1"}}</FunctionInsert>探索记录 1';
// 压缩引擎的 renderTag 产物：语义相同但被美化重排（多行）。
const RERENDERED =
  '<VariableEdit>\n{"era_demo":{"player":{"hp":13}}}\n</VariableEdit><FunctionInsert>\n{"f":{"params":["x"],"expr":"x+1"}}\n</FunctionInsert>探索记录 1';
// 真机证据逐字复制：`st-run-20260911T18572962-bea9ca9f83c3` 的 `COMBINED-AUTHOR-001`
// 第 2 楼在 `author-initial`（原文）与 `author-synced`（full 同步后）两处观测到的文本。
// 两次观测的差异**只有** `<VariableEdit>` 的换行与缩进；`<FunctionInsert>` 与 `<era_data>` 尾行完全一致。
const REAL_ORIGINAL =
  '<VariableEdit>{"era_demo":{"player":{"hp":13}}}</VariableEdit><FunctionInsert>{"singleFloorHistory":{"params":["x"],"expr":"x+1"}}</FunctionInsert>探索记录 1\n<era_data>{"era-message-key"="era_mk_1789165770160_c1pzo0d9","era-message-type"="assistant"}</era_data>';
const REAL_RERENDERED =
  '<VariableEdit>\n{"era_demo":{"player":{"hp":13}}}\n</VariableEdit><FunctionInsert>{"singleFloorHistory":{"params":["x"],"expr":"x+1"}}</FunctionInsert>探索记录 1\n<era_data>{"era-message-key"="era_mk_1789165770160_c1pzo0d9","era-message-type"="assistant"}</era_data>';
function contextWith(status: 'unchanged' | 'compacted', compacted = RERENDERED, original = ORIGINAL) {
  return {
    originalWork: { schemaVersion: 1, step: {}, disposition: 'commit', plan: null, payload: null, failure: null },
    plan: { kind: 'sync', status: 'recalculated', committed: true } as never,
    messages: [
      {
        schemaVersion: 1,
        messageId: 1,
        role: 'assistant',
        swipeIndex: 0,
        content: { kind: 'text', text: original },
        extra: {},
      },
    ],
    messageUpdates: [],
    meta: {},
    markers: {},
    editLogs: {},
    functionEditLogs: {},
    candidates: [
      {
        accepted: true,
        original,
        compaction: { status, content: compacted },
        replay: { editLog: [], functionEditLog: [] },
        candidate: { messageIndex: 0, messageId: 1, mk: 'mk-1', eraMeta: {} },
      },
    ],
  } as never;
}
describe('封存压缩写入：unchanged 层不得重写消息文本', () => {
  it('状态为 unchanged 时保持原文逐字节不变', () => {
    const written = writeSingleScopeSegments(contextWith('unchanged')) as unknown as {
      messages: {
        content: {
          text: string;
        };
      }[];
      messageUpdates: unknown[];
    };
    // 引擎已判定「命令没有变化」；此时写入 renderTag 的重排结果会平白改写聊天历史，
    // 真机 COMBINED-HISTORY-001 / RUNTIME-COALESCE-CHAT-SWITCH-001 的
    // 「messages 不得变化」绑定断言就是这样被打掉的。
    expect(written.messages[0]?.content.text).toBe(ORIGINAL);
    expect(written.messageUpdates).toHaveLength(0);
  });
  it('报了 compacted 但命令只是被重新排版时，仍保留原文', () => {
    const written = writeSingleScopeSegments(contextWith('compacted', ORIGINAL)) as unknown as {
      messages: {
        content: {
          text: string;
        };
      }[];
      messageUpdates: unknown[];
    };
    // 压缩引擎用 renderTag 重新渲染同一条命令（只有空白不同）——这不算压缩。
    expect(written.messages[0]?.content.text).toBe(ORIGINAL);
    expect(written.messageUpdates).toHaveLength(0);
  });
  it('真机整段文本（含 era_data 尾行）只因排版被重排时仍保留原文', () => {
    // 这一条锁的是真机失败证据本身：`COMBINED-AUTHOR-001/002`（6+8 条断言失败）与
    // `COMBINED-HISTORY-002/003`（2+1 条）在同一签名下全灭——full 同步把作者的
    // 单行 `<VariableEdit>` 美化成多行，破坏了「这些话的文本不得变化」的绑定断言。
    const written = writeSingleScopeSegments(contextWith('compacted', REAL_RERENDERED, REAL_ORIGINAL)) as unknown as {
      messages: {
        content: {
          text: string;
        };
      }[];
      messageUpdates: unknown[];
    };
    expect(written.messages[0]?.content.text).toBe(REAL_ORIGINAL);
    expect(written.messageUpdates).toHaveLength(0);
  });
  it('真正被压缩时仍然写入压缩结果', () => {
    // 真压缩：命令内容变了（两条 hp 编辑被合并成一条终值）。
    const MERGED = '<VariableEdit>\n{"era_demo":{"player":{"hp":15}}}\n</VariableEdit>探索记录 1';
    const written = writeSingleScopeSegments(contextWith('compacted', MERGED)) as unknown as {
      messages: {
        content: {
          text: string;
        };
      }[];
      messageUpdates: unknown[];
    };
    expect(written.messages[0]?.content.text).toBe(MERGED);
    expect(written.messageUpdates).toHaveLength(1);
  });
});
