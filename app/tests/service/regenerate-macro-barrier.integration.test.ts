import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import _ from 'lodash';
import { TavernEraServiceAdapter } from '../../src/ERA变量框架/service/tavern-adapter';
import type { EraWorkflowHost } from '../../src/ERA变量框架/service/types';
import { createWorkflowHost } from '@era/vibeflow-service';

type EventHandler = (...args: unknown[]) => unknown;
type MacroReplace = (context: Record<string, unknown>, substring: string) => string;

class FakeTavernEvents {
  private readonly listeners = new Map<string, Set<EventHandler>>();

  register(type: string, handler: EventHandler) {
    const handlers = this.listeners.get(type) ?? new Set<EventHandler>();
    handlers.add(handler);
    this.listeners.set(type, handlers);
    return { stop: () => this.remove(type, handler) };
  }

  remove(type: string, handler: EventHandler): void {
    const handlers = this.listeners.get(type);
    handlers?.delete(handler);
    if (handlers?.size === 0) this.listeners.delete(type);
  }

  only(type: string): EventHandler {
    const handlers = [...(this.listeners.get(type) ?? [])];
    if (handlers.length !== 1) throw new Error(`事件 ${type} 的监听数不是 1。`);
    return handlers[0];
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe('重新生成的宏与生成栅栏', () => {
  const events = new FakeTavernEvents();
  let host: EraWorkflowHost | null = null;
  let execution: Promise<unknown> | null = null;
  let chatVariables: Record<string, unknown>;
  let replaceMacro: MacroReplace | null = null;
  let unregisterMacro = (): void => undefined;
  let sidecarFiles: Map<string, unknown>;

  beforeEach(async () => {
    chatVariables = {
      stat_data: { generation_value: '待重生成楼层的变量' },
      ERAMetaData: {
        SelectedMks: ['mk-previous', 'mk-current'],
        EditLogs: {
          'mk-previous': [{ op: 'insert', path: 'generation_value', value_new: '上一楼的变量' }],
          'mk-current': [
            {
              op: 'update',
              path: 'generation_value',
              value_old: '上一楼的变量',
              value_new: '待重生成楼层的变量',
            },
          ],
        },
      },
    };
    sidecarFiles = new Map();

    vi.stubGlobal('eventOn', (type: string, handler: EventHandler) => events.register(type, handler));
    vi.stubGlobal('eventMakeFirst', (type: string, handler: EventHandler) => events.register(type, handler));
    vi.stubGlobal('eventMakeLast', (type: string, handler: EventHandler) => events.register(type, handler));
    vi.stubGlobal('eventRemoveListener', (type: string, handler: EventHandler) => events.remove(type, handler));
    vi.stubGlobal('getButtonEvent', (name: string) => `era-button:${name}`);
    vi.stubGlobal('getCurrentCharacterId', () => 'barrier-card');
    vi.stubGlobal('SillyTavern', {
      groupId: null,
      getCurrentChatId: () => 'barrier-chat',
      getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    });
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/files/upload')) {
        const body = JSON.parse(String(init?.body)) as { name: string; data: string };
        const json = decodeURIComponent(escape(atob(body.data)));
        sidecarFiles.set(body.name, JSON.parse(json));
        return new Response('{}', { status: 200 });
      }
      const name = decodeURIComponent(url.split('/').at(-1) ?? '');
      const record = sidecarFiles.get(name);
      return record === undefined
        ? new Response('', { status: 404 })
        : new Response(JSON.stringify(record), { status: 200 });
    });
    vi.stubGlobal('_', _);
    vi.stubGlobal('eventEmit', async () => undefined);
    vi.stubGlobal('registerMacroLike', (_regex: RegExp, replace: MacroReplace) => {
      replaceMacro = replace;
      return { unregister: () => (replaceMacro = null) };
    });
    vi.stubGlobal('getVariables', () => clone(chatVariables));
    vi.stubGlobal('replaceVariables', (next: Record<string, unknown>) => {
      chatVariables = clone(next);
    });
    vi.stubGlobal('updateVariablesWith', (updater: (current: Record<string, unknown>) => Record<string, unknown>) => {
      chatVariables = clone(updater(chatVariables));
    });
    vi.stubGlobal('getChatMessages', () => [
      {
        message_id: 0,
        role: 'assistant',
        is_user: false,
        mes: [
          '上一楼',
          '<VariableInsert>{"generation_value":"上一楼的变量"}</VariableInsert>',
          '<era_data>{"era-message-key"="mk-previous","era-message-type"="assistant"}</era_data>',
        ].join('\n'),
      },
      {
        message_id: 1,
        role: 'assistant',
        is_user: false,
        mes: '待重生成楼层\n<era_data>{"era-message-key"="mk-current","era-message-type"="assistant"}</era_data>',
      },
    ]);
    vi.stubGlobal('setChatMessages', async () => undefined);
    vi.stubGlobal('refreshOneMessage', async () => undefined);
    vi.stubGlobal('toastr', { error: vi.fn() });

    const adapter = new TavernEraServiceAdapter();
    vi.stubGlobal('__ERA_VIBEFLOW_SERVICE_ADAPTER__', adapter);
    host = createWorkflowHost() as EraWorkflowHost;
    await host.start();
    execution = host.runWorkflowAsync({});
    const { registerEraMacro } = await import('../../src/ERA变量框架/macro/registration');
    unregisterMacro = registerEraMacro();
  });

  afterEach(async () => {
    unregisterMacro();
    await host?.stop();
    await execution?.catch(() => undefined);
    host = null;
    execution = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('重新生成路径只提供 generation_started 时，仍必须在宏读取前回退到上一楼变量', async () => {
    // ST-Harness 当前 regenerate 完成合同观察 generation_started、message_received、generation_ended。
    // 这里重放缺少 message_swiped 的入口，防止 ERA 把回退错误地限定为 overswipe 组合。
    const regenerate = events.only('generation_started');
    const barrier = regenerate('regenerate', { automatic_trigger: false }, false);

    expect(barrier).toBeInstanceOf(Promise);
    await barrier;

    expect(replaceMacro).not.toBeNull();
    expect(replaceMacro?.({}, '{{ERA:generation_value}}')).toBe('上一楼的变量');
    expect(chatVariables.stat_data).toBeUndefined();
  });
});
