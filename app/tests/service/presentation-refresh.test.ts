import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recentMessageIds, registerEraPresentationRefresh } from '../../src/ERA变量框架/service/presentation-refresh';
import {
  clearSidecarRuntimeSnapshot,
  publishSidecarRuntimeSnapshot,
} from '../../src/ERA变量框架/service/sidecar-runtime-snapshot';
import { initEraSettings } from '../../src/ERA变量框架/utils/era_data';

describe('ERA presentation refresh', () => {
  const refreshOneMessage = vi.fn(async (_messageId: number) => undefined);
  let rawSettings: Record<string, unknown>;

  beforeEach(() => {
    clearSidecarRuntimeSnapshot();
    rawSettings = { 强制重载功能: true, 强制重载消息数: 2 };
    vi.stubGlobal('getScriptId', () => 'era-test');
    vi.stubGlobal('getVariables', () => structuredClone(rawSettings));
    vi.stubGlobal('refreshOneMessage', refreshOneMessage);
    vi.stubGlobal('SillyTavern', { chat: [{ mes: '0' }, { mes: '1' }, { mes: '2' }, { mes: '3' }] });
    initEraSettings();
  });

  afterEach(() => {
    clearSidecarRuntimeSnapshot();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('selects only the requested suffix and rejects invalid bounds', () => {
    expect(recentMessageIds(5, 2)).toEqual([3, 4]);
    expect(recentMessageIds(2, 9)).toEqual([0, 1]);
    expect(recentMessageIds(2, 0)).toEqual([]);
    expect(recentMessageIds(2.5, 1)).toEqual([]);
  });

  it('refreshes one display suffix per committed snapshot without mutating messages', async () => {
    const before = structuredClone(SillyTavern.chat);
    const stop = registerEraPresentationRefresh();
    const snapshot = {
      identity: { characterId: 'char', groupId: null, chatId: 'chat' },
      sidecarId: 'sidecar',
      revision: 3,
      statData: { value: 1 },
      statFunc: {},
      eraMeta: {},
    };
    publishSidecarRuntimeSnapshot(snapshot);
    await vi.waitFor(() => expect(refreshOneMessage).toHaveBeenCalledTimes(2));
    expect(refreshOneMessage.mock.calls.map(([messageId]) => messageId)).toEqual([2, 3]);
    expect(SillyTavern.chat).toEqual(before);

    publishSidecarRuntimeSnapshot(snapshot);
    await Promise.resolve();
    expect(refreshOneMessage).toHaveBeenCalledTimes(2);

    rawSettings = { 强制重载功能: false, 强制重载消息数: 2 };
    initEraSettings();
    publishSidecarRuntimeSnapshot({ ...snapshot, revision: 4 });
    await Promise.resolve();
    expect(refreshOneMessage).toHaveBeenCalledTimes(2);
    stop();
  });
});
