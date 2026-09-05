import lodash from 'lodash';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let createEraFacade: typeof import('../../src/ERA变量框架/service/public-api').createEraFacade;
let clearSidecarRuntimeSnapshot: typeof import('../../src/ERA变量框架/service/sidecar-runtime-snapshot').clearSidecarRuntimeSnapshot;
let publishSidecarRuntimeSnapshot: typeof import('../../src/ERA变量框架/service/sidecar-runtime-snapshot').publishSidecarRuntimeSnapshot;

describe('ERA.history.atMessage 函数历史投影', () => {
  beforeAll(async () => {
    vi.stubGlobal('_', lodash);
    ({ createEraFacade } = await import('../../src/ERA变量框架/service/public-api'));
    ({ clearSidecarRuntimeSnapshot, publishSidecarRuntimeSnapshot } =
      await import('../../src/ERA变量框架/service/sidecar-runtime-snapshot'));
  });

  beforeEach(() => {
    vi.stubGlobal('getCurrentCharacterId', () => 'card-history');
    vi.stubGlobal('SillyTavern', {
      groupId: null,
      getCurrentChatId: () => 'chat-history',
    });
  });

  afterEach(() => {
    clearSidecarRuntimeSnapshot();
    vi.unstubAllGlobals();
    vi.stubGlobal('_', lodash);
  });

  it('同时逆向变量与函数日志且不修改当前运行时快照', async () => {
    publishSidecarRuntimeSnapshot({
      sidecarId: 'era_chat_history-12345678',
      identity: { characterId: 'card-history', groupId: null, chatId: 'chat-history' },
      revision: 8,
      statData: { hp: 20, added: true },
      statFunc: {
        f: { params: ['x'], expr: 'x+2' },
        g: { params: ['x'], expr: 'f(x)' },
      },
      eraMeta: {
        SelectedMks: ['mk-0', 'mk-1', 'mk-2'],
        EditLogs: {
          'mk-0': [{ op: 'insert', path: 'hp', value_new: 10 }],
          'mk-1': [{ op: 'update', path: 'hp', value_old: 10, value_new: 20 }],
          'mk-2': [{ op: 'insert', path: 'added', value_new: true }],
        },
        FunctionEditLogs: {
          'mk-0': [{ op: 'insert', name: 'f', value_new: { params: ['x'], expr: 'x+1' } }],
          'mk-1': [
            {
              op: 'update',
              name: 'f',
              value_old: { params: ['x'], expr: 'x+1' },
              value_new: { params: ['x'], expr: 'x+2' },
            },
          ],
          'mk-2': [{ op: 'insert', name: 'g', value_new: { params: ['x'], expr: 'f(x)' } }],
        },
      },
    });

    const facade = createEraFacade(() => ({
      mount: async () => undefined,
      list: () => [],
      select: async () => undefined,
      clearSelection: () => undefined,
      stop: () => undefined,
    }));
    const historical = await facade.history.atMessage(0);
    expect(historical.statData).toEqual({ hp: 10 });
    expect(historical.statFunc).toEqual({ f: { params: ['x'], expr: 'x+1' } });
    expect(facade.get().statData).toEqual({ hp: 20, added: true });
    expect(facade.get().statFunc).toHaveProperty('g');
  });
});
