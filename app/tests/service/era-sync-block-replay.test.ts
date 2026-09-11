import { describe, expect, it } from 'vitest';

import {
  replayMessageBlock,
  type EraMessageReplayCheckpoint,
} from '../../../javascript_project/service/base_lib/domain/sync_engine';
import type { EraMkMessageV1 } from '../../../javascript_project/service/base_lib/domain/mk_engine';

const MESSAGE: EraMkMessageV1 = {
  schemaVersion: 1,
  messageId: 7,
  role: 'assistant',
  content: {
    kind: 'text',
    text: [
      '<VariableInsert>{"hp":100}</VariableInsert>',
      '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
      '<EraFCall name="attack" args=\'{"damage":10}\' id="c1"/>',
      '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
    ].join('\n'),
  },
} as EraMkMessageV1;

const PLAIN_MESSAGE: EraMkMessageV1 = {
  schemaVersion: 1,
  messageId: 8,
  role: 'assistant',
  content: {
    kind: 'text',
    text: [
      '<VariableInsert>{"gold":5}</VariableInsert>',
      '<VariableEdit>{"gold":{"$expr":"gold+2"}}</VariableEdit>',
      '<VariableDelete>{"tmp":{}}</VariableDelete>',
    ].join('\n'),
  },
} as EraMkMessageV1;

function checkpoint(overrides: Partial<EraMessageReplayCheckpoint> = {}): EraMessageReplayCheckpoint {
  return {
    messageIndex: 0,
    blockIndex: 0,
    stat: { tmp: true },
    statFunc: {},
    meta: {},
    ...overrides,
  };
}

function step(
  message: EraMkMessageV1,
  current: EraMessageReplayCheckpoint,
  options: { readonly formal?: boolean; readonly stat?: unknown } = {},
) {
  return replayMessageBlock({
    message,
    messageIndex: current.messageIndex,
    messageId: message.messageId,
    mk: 'mk-1',
    checkpoint: {
      ...current,
      ...(options.stat === undefined ? {} : { stat: options.stat }),
    },
    formal: options.formal ?? true,
  });
}

describe('ERA 一步一块：同步引擎按块重放', () => {
  it('从第 0 块开始，不携带上一次的累计状态', () => {
    const result = step(PLAIN_MESSAGE, checkpoint({ messageIndex: 0, blockIndex: 0, stat: { tmp: true } }));

    expect(result.executedBlockIndexes).toEqual([0]);
    expect(result.stat).toEqual({ tmp: true, gold: 5 });
    expect(result.done).toBe(false);
    expect(result.pendingCall).toBe(null);
  });

  it('逐步推进与一次性重放得到相同终态', () => {
    let state = checkpoint({ messageIndex: 1, blockIndex: 0, stat: { tmp: true } });
    let guard = 0;
    while (!state.done && guard < 8) {
      const result = step(PLAIN_MESSAGE, state, { stat: state.stat });
      state = {
        ...state,
        blockIndex: result.checkpoint.blockIndex,
        stat: result.stat,
        statFunc: result.statFunc ?? state.statFunc,
        done: result.done,
      };
      guard += 1;
    }

    expect(state.done).toBe(true);
    expect(state.stat).toEqual({ gold: 7 });
  });

  it('逐步推进累计出本楼的编辑日志，覆盖每个被改变的路径', () => {
    let state = checkpoint({ messageIndex: 1, blockIndex: 0, stat: { tmp: true } });
    const paths: string[] = [];
    const log: unknown[] = [];
    let guard = 0;
    while (!state.done && guard < 8) {
      const result = step(PLAIN_MESSAGE, state, { stat: state.stat });
      paths.push(...result.editLog.map(entry => entry.path));
      log.push(...result.editLog);
      state = {
        ...state,
        blockIndex: result.checkpoint.blockIndex,
        stat: result.stat,
        statFunc: result.statFunc ?? state.statFunc,
        done: result.done,
      };
      guard += 1;
    }

    expect(paths).toContain('gold');
    expect(paths).toContain('tmp');
    expect(log.length).toBeGreaterThanOrEqual(3);
  });

  it('未处理调用处停止：回报 pendingCall 且不置 done', () => {
    let state = checkpoint({ messageIndex: 0, blockIndex: 0, stat: { tmp: true } });
    let pending: { name: string | null } | null = null;
    let guard = 0;
    while (pending === null && guard < 6) {
      const result = step(MESSAGE, state, { stat: state.stat });
      state = {
        ...state,
        blockIndex: result.checkpoint.blockIndex,
        stat: result.stat,
        statFunc: result.statFunc ?? state.statFunc,
        done: result.done,
      };
      pending = result.pendingCall;
      guard += 1;
    }

    expect(pending).not.toBe(null);
    expect(pending?.name).toBe('attack');
    expect(state.done).toBe(false);
    expect(state.stat).toEqual({ tmp: true, hp: 70 });
  });

  it('纯计算模式跳过未标记调用，并继续处理后面的块', () => {
    let state = checkpoint({ messageIndex: 0, blockIndex: 0, stat: { tmp: true } });
    const codes: string[] = [];
    let guard = 0;
    while (!state.done && guard < 8) {
      const result = step(MESSAGE, state, { stat: state.stat, formal: false });
      codes.push(...result.diagnostics.map(item => item.code));
      state = {
        ...state,
        blockIndex: result.checkpoint.blockIndex,
        stat: result.stat,
        statFunc: result.statFunc ?? state.statFunc,
        done: result.done,
      };
      guard += 1;
    }

    expect(codes).toContain('ERA_FCALL_NOT_EXECUTED');
    expect(state.done).toBe(true);
    expect(state.stat).toEqual({ tmp: true, hp: 60 });
  });

  it('检查点按块下标续做，不从头重算', () => {
    const first = step(PLAIN_MESSAGE, checkpoint({ messageIndex: 1, blockIndex: 0, stat: { tmp: true } }));
    const resumed = replayMessageBlock({
      message: PLAIN_MESSAGE,
      messageIndex: 1,
      messageId: PLAIN_MESSAGE.messageId,
      mk: 'mk-1',
      checkpoint: {
        ...first.checkpoint,
        stat: first.stat,
        statFunc: first.statFunc ?? {},
      },
      formal: true,
    });

    expect(resumed.executedBlockIndexes).toEqual([1]);
    // 第二步只执行第二块：gold+2 生效，第三块的 delete 尚未执行。
    expect(resumed.stat).toEqual({ tmp: true, gold: 7 });
    expect(resumed.checkpoint.blockIndex).toBe(2);
    expect(resumed.done).toBe(false);
  });
});
