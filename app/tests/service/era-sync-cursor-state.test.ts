import { describe, expect, it } from 'vitest';

import {
  createInitialServiceState,
  reduceForProtocolSlice,
} from '../../../javascript_project/service/base_lib/service_protocol';

describe('ERA 服务状态：块游标槽', () => {
  it('初始状态带 null 的 syncCursor 槽', () => {
    const state = createInitialServiceState() as unknown as {
      readonly syncCursor?: unknown;
    };

    expect(state).toHaveProperty('syncCursor');
    expect(state.syncCursor).toBe(null);
  });

  it('归约普通事件时原样携带既有 syncCursor', () => {
    const initial = createInitialServiceState();
    const cursor = {
      messageId: 7,
      mk: 'mk-7',
      blockIndex: 2,
      stat: { hp: 70 },
      statFunc: {},
      resolvedCallIds: ['c1'],
      done: false,
    };
    const withCursor = { ...initial, syncCursor: cursor };

    const { reduction } = reduceForProtocolSlice(
      withCursor,
      {
        schemaVersion: 1,
        eventId: 'e1',
        sequence: 1,
        type: 'app_ready',
        occurredAt: 1,
        source: 'tavern',
        args: [],
        encodedBytes: 2,
      } as never,
      {},
    );

    expect(reduction.nextState.syncCursor).toEqual(cursor);
  });

  it('游标是可移植 JSON，不含函数或未定义值', () => {
    const cursor = {
      messageId: 3,
      mk: 'mk-3',
      blockIndex: 1,
      stat: { hp: 5 },
      statFunc: { double: { params: ['x'], expr: 'x * 2' } },
      resolvedCallIds: [],
      done: false,
    };

    const cloned = JSON.parse(JSON.stringify(cursor));

    expect(cloned).toEqual(cursor);
  });
});
