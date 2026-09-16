import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import _ from 'lodash';
import type { EraWaitThroughResult } from '../../src/ERA变量框架/service/types';
import { TavernEraServiceAdapter } from '../../src/ERA变量框架/service/tavern-adapter';
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
    if (handlers.length !== 1) throw new Error(`事件 ${type} 的监听数不是 1（实际 ${handlers.length}）。`);
    return handlers[0];
  }

  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe('重新生成的宏与生成栅栏', () => {
  const events = new FakeTavernEvents();
  let host: ReturnType<typeof createWorkflowHost> | null = null;
  let adapter: TavernEraServiceAdapter;
  let executedNodes: string[];
  let execution: Promise<unknown> | null = null;
  let chatVariables: Record<string, unknown>;
  let replaceMacro: MacroReplace | null = null;
  let unregisterMacro = (): void => undefined;
  let sidecarFiles: Map<string, unknown>;
  let pendingSwipe = false;
  let barriers: EraWaitThroughResult[] = [];

  beforeEach(async () => {
    pendingSwipe = false;
    barriers = [];
    executedNodes = [];
    chatVariables = {
      stat_data: { generation_value: '待重生成楼层的变量' },
      ERAMetaData: {
        SelectedMks: ['mk-initial', 'mk-previous', 'mk-current'],
        EditLogs: {
          'mk-initial': [],
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
    vi.stubGlobal('tavern_events', { GENERATION_ENDED: 'generation_ended' });
    vi.stubGlobal('getPresetNames', () => []);
    vi.stubGlobal('getLoadedPresetName', () => '');
    vi.stubGlobal('getCurrentCharacterId', () => 'barrier-card');
    vi.stubGlobal('getCurrentCharacterName', () => 'barrier-character');
    vi.stubGlobal('getScriptId', () => 'era-regenerate-barrier-test');
    let savedChat: unknown[] = [];
    vi.stubGlobal('SillyTavern', {
      extensionSettings: {},
      characterId: '0',
      characters: [{ avatar: 'barrier-card', name: 'barrier-character', chat: 'barrier-chat' }],
      get chat() {
        return chatMessages;
      },
      saveChat: async () => {
        savedChat = clone(chatMessages);
      },
      groupId: null,
      getCurrentChatId: () => 'barrier-chat',
      getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    });
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/chats/get') return new Response(JSON.stringify([{}, ...savedChat]), { status: 200 });
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
    const chatMessages = [
      {
        message_id: 0,
        role: 'assistant',
        is_user: false,
        mes: '初始楼\n<era_data>{"era-message-key"="mk-initial","era-message-type"="assistant"}</era_data>',
      },
      {
        message_id: 1,
        role: 'assistant',
        is_user: false,
        mes: [
          '上一楼',
          '<VariableInsert>{"generation_value":"上一楼的变量"}</VariableInsert>',
          '<era_data>{"era-message-key"="mk-previous","era-message-type"="assistant"}</era_data>',
        ].join('\n'),
      },
      {
        message_id: 2,
        role: 'assistant',
        is_user: false,
        mes: '待重生成楼层\n<era_data>{"era-message-key"="mk-current","era-message-type"="assistant"}</era_data>',
      },
    ];
    vi.stubGlobal('getChatMessages', (range: string | number) =>
      chatMessages
        .filter(message => typeof range !== 'number' || message.message_id === range)
        .filter(message => !(pendingSwipe && range === '0-{{lastMessageId}}' && message.message_id === 2))
        .map(message => ({
          ...clone(message),
          swipe_id: pendingSwipe && message.message_id === 2 ? 1 : 0,
          swipes: [message.mes],
        })),
    );
    vi.stubGlobal('setChatMessages', async (updates: Array<{ message_id: number; message?: string }>) => {
      for (const update of updates) {
        const message = chatMessages.find(item => item.message_id === update.message_id);
        if (message && typeof update.message === 'string') message.mes = update.message;
      }
    });
    vi.stubGlobal('refreshOneMessage', async () => undefined);
    vi.stubGlobal('toastr', { error: vi.fn() });

    adapter = new TavernEraServiceAdapter({ onBarrierFailure: result => barriers.push(result) });
    vi.stubGlobal('__ERA_VIBEFLOW_SERVICE_ADAPTER__', adapter);
    host = createWorkflowHost();
    await host.start();
    execution = host.runWorkflowAsync(
      {},
      {
        trace: 'full',
        onTrace: event => {
          if (typeof event.nodeId === 'string') executedNodes.push(event.nodeId);
        },
      },
    );
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

  it('完整同步通过实际 AOT 的保存参数校验并清除内存脏状态', async () => {
    await vi.waitFor(() => expect(events.count('generation_started')).toBe(1));
    const request = adapter.enqueue('era.facade.sync', 'era-api', [{ mode: 'full' }]);
    if (!request.accepted) throw new Error(request.message);
    const result = await request.done;
    expect(result.status).toBe('completed');
    const { readWorkingState } = await import('../../src/ERA变量框架/service/sidecar-runtime-snapshot');
    expect(readWorkingState({ characterId: 'barrier-card', groupId: null, chatId: 'barrier-chat' })?.dirty).toBe(false);
    expect(sidecarFiles.size).toBeGreaterThan(0);
  });

  it('B已保存后切C再生成D：真实工作流不遗留失败回执且最终状态属于D', async () => {
    await vi.waitFor(() => expect(events.count('generation_started')).toBe(1));
    const initial = adapter.enqueue('era.facade.sync', 'era-api', [{ mode: 'full' }]);
    if (!initial.accepted) throw new Error(initial.message);
    expect((await initial.done).status).toBe('completed');
    const last: any = SillyTavern.chat[2];
    last.swipe_id = 0;
    last.swipes = [
      last.mes,
      '<VariableEdit>{"generation_value":"B"}</VariableEdit>',
      '<VariableEdit>{"generation_value":"C"}</VariableEdit>',
    ];
    vi.stubGlobal('getChatMessages', (range: string | number) =>
      SillyTavern.chat
        .filter((message: any) => typeof range !== 'number' || message.message_id === range)
        .map((message: any) => ({
          ...clone(message),
          swipe_id: message.swipe_id ?? 0,
          swipes: message.swipes ?? [message.mes],
        })),
    );
    const originalSet = setChatMessages;
    vi.stubGlobal('setChatMessages', async (updates: any[]) => {
      await originalSet(updates);
      last.swipes[last.swipe_id] = last.mes;
    });
    const saved = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const originalSave = SillyTavern.saveChat;
    let intercepted = false;
    vi.spyOn(SillyTavern, 'saveChat').mockImplementation(async () => {
      await originalSave();
      if (last.swipe_id === 1 && !intercepted) {
        intercepted = true;
        saved.resolve();
        await release.promise;
      }
    });
    last.swipe_id = 1;
    last.mes = last.swipes[1];
    events.only('message_swiped')(2);
    await saved.promise;
    last.swipe_id = 2;
    last.mes = last.swipes[2];
    events.only('message_swiped')(2);
    release.resolve();
    await events.only('generation_started')('swipe', { automatic_trigger: false }, false);
    expect(barriers.flatMap(result => result.outcomes).filter(item => item.outcome.status === 'failed')).toEqual([]);
    last.swipes.push('<VariableEdit>{"generation_value":"D"}</VariableEdit>');
    last.swipe_id = 3;
    last.mes = last.swipes[3];
    events.only('message_received')(2);
    const finish = adapter.enqueue('era.facade.sync', 'era-api', [{ mode: 'auto' }]);
    if (!finish.accepted) throw new Error(finish.message);
    expect((await finish.done).status).toBe('completed');
    expect((await finish.waitThrough()).outcomes.filter(item => item.outcome.status === 'failed')).toEqual([]);
    const { readCurrentEraMacroSnapshot } = await import('../../src/ERA变量框架/macro/registration');
    expect(readCurrentEraMacroSnapshot()?.statWithoutMeta).toMatchObject({ generation_value: 'D' });
  });

  it('设置命令经过独立 Nodeset，在原 FIFO 中结算后仍能处理生成事件', async () => {
    await vi.waitFor(() => expect(events.count('generation_started')).toBe(1));
    await events.only('generation_started')('regenerate', { automatic_trigger: false }, false);
    executedNodes = [];
    const settings = adapter.enqueue('era.ui.agent_configuration', 'ui', [{ action: 'read' }]);
    expect(settings.accepted).toBe(true);
    if (!settings.accepted) throw new Error(settings.message);
    const through = settings.waitThrough();
    const result = await settings.done;
    expect(result).toMatchObject({ eventId: settings.eventId, sequence: settings.sequence, status: 'completed' });
    expect(result.value).toHaveProperty('configuration');
    expect(executedNodes).toContain('execute_settings_command');
    expect(executedNodes).toContain('build_settings_result');
    expect(executedNodes).not.toContain('execute_agent_phase_v2');
    const settled = await through;
    expect(settled.outcomes.filter(item => item.eventId === settings.eventId)).toHaveLength(1);

    executedNodes = [];
    await events.only('generation_started')('regenerate', { automatic_trigger: false }, false);
    expect(executedNodes).toContain('classify_generation_event');
    expect(executedNodes).toContain('prepare_generation_phase');
    expect(executedNodes).toContain('execute_agent_phase_v2');
    expect(executedNodes).toContain('form_session_transition');
    expect(executedNodes).not.toContain('execute_settings_command');
  });

  it.each(['regenerate', 'swipe'])('%s 必须在宏读取前只回退一次，保留楼1变量且不补写待生成楼', async generationType => {
    pendingSwipe = generationType === 'swipe';
    // ST-Harness 当前 regenerate 完成合同观察 generation_started、message_received、generation_ended。
    // 这里重放缺少 message_swiped 的入口，防止 ERA 把回退错误地限定为 overswipe 组合。
    await vi.waitFor(() => expect(events.count('generation_started')).toBe(1));
    if (pendingSwipe) events.only('message_swiped')(2);
    const regenerate = events.only('generation_started');
    const barrier = regenerate(generationType, { automatic_trigger: false }, false);

    expect(barrier).toBeInstanceOf(Promise);
    await barrier;

    expect(replaceMacro).not.toBeNull();
    const token = replaceMacro?.({}, '{{ERA:generation_value}}') ?? '';
    const [{ resolveEraLazyMacroTokens }, { readCurrentEraMacroSnapshot }] = await Promise.all([
      import('../../src/ERA变量框架/macro/syntax'),
      import('../../src/ERA变量框架/macro/registration'),
    ]);
    expect(resolveEraLazyMacroTokens(token, readCurrentEraMacroSnapshot())).toBe('上一楼的变量');
    expect(chatVariables.stat_data).toBeUndefined();
  });
});
