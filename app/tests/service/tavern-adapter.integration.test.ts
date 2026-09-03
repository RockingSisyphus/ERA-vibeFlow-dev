import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INPUT_EVENT } from '../../src/ERA变量框架/events/catalog';
import { ERA_TAVERN_LISTENER_COUNT, TavernEraServiceAdapter } from '../../src/ERA变量框架/service/tavern-adapter';
import type { EraAdmissionAccepted, EraInboundEvent } from '../../src/ERA变量框架/service/types';

type EventHandler = (...args: unknown[]) => unknown;

class FakeTavernEvents {
  readonly listeners = new Map<string, Set<EventHandler>>();
  readonly orders = new Map<string, 'first' | 'normal' | 'last'>();

  register(type: string, handler: EventHandler, order: 'first' | 'normal' | 'last') {
    const handlers = this.listeners.get(type) ?? new Set<EventHandler>();
    handlers.add(handler);
    this.listeners.set(type, handlers);
    this.orders.set(type, order);
    return { stop: () => this.remove(type, handler) };
  }

  remove(type: string, handler: EventHandler): void {
    const handlers = this.listeners.get(type);
    handlers?.delete(handler);
    if (handlers?.size === 0) {
      this.listeners.delete(type);
      this.orders.delete(type);
    }
  }

  only(type: string): EventHandler {
    const handlers = [...(this.listeners.get(type) ?? [])];
    if (handlers.length !== 1) throw new Error(`事件 ${type} 的监听数不是 1。`);
    return handlers[0];
  }

  get count(): number {
    return [...this.listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0);
  }
}

function accepted(waitThrough: () => Promise<never> | Promise<unknown>): EraAdmissionAccepted {
  return {
    accepted: true,
    eventId: 'fake:event:1',
    sequence: 1,
    done: Promise.resolve({ eventId: 'fake:event:1', sequence: 1, status: 'completed' }),
    waitThrough: waitThrough as EraAdmissionAccepted['waitThrough'],
  };
}

describe('ERA Tavern 生产接线', () => {
  let events: FakeTavernEvents;

  beforeEach(() => {
    events = new FakeTavernEvents();
    vi.stubGlobal('eventOn', (type: string, handler: EventHandler) => events.register(type, handler, 'normal'));
    vi.stubGlobal('eventMakeFirst', (type: string, handler: EventHandler) => events.register(type, handler, 'first'));
    vi.stubGlobal('eventMakeLast', (type: string, handler: EventHandler) => events.register(type, handler, 'last'));
    vi.stubGlobal('eventOnce', (type: string, handler: EventHandler) => {
      const once = (...args: unknown[]) => {
        events.remove(type, once);
        return handler(...args);
      };
      return events.register(type, once, 'normal');
    });
    vi.stubGlobal('eventRemoveListener', (type: string, handler: EventHandler) => events.remove(type, handler));
    vi.stubGlobal('tavern_events', {
      GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS',
      CHAT_CHANGED: 'CHAT_CHANGED',
    });
    vi.stubGlobal('getButtonEvent', (name: string) => `era-button:${name}`);
    vi.stubGlobal('toastr', { error: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('只注册 10 个 Tavern 生命周期事件与 3 个按钮，不监听旧公共事件 API', () => {
    const adapter = new TavernEraServiceAdapter();
    const listener = vi.fn(() => accepted(async () => ({ throughSequence: 1, outcomes: [], hasFailures: false })));
    const stop = adapter.subscribe(listener);

    expect(events.count).toBe(ERA_TAVERN_LISTENER_COUNT);
    expect(events.listeners.size).toBe(ERA_TAVERN_LISTENER_COUNT);
    expect(events.listeners.has('era:updateByObject')).toBe(false);
    expect(events.listeners.has('era:requestWriteDone')).toBe(false);
    expect(events.listeners.has('era:forceSync')).toBe(false);
    expect(events.listeners.has(INPUT_EVENT.MANUAL_WRITE)).toBe(false);
    expect(events.listeners.has(INPUT_EVENT.MANUAL_SYNC)).toBe(false);
    expect(events.listeners.has(INPUT_EVENT.MANUAL_FULL_SYNC)).toBe(false);
    expect(events.listeners.has('era-button:写入变量修改')).toBe(true);
    expect(events.listeners.has('era-button:手动同步状态')).toBe(true);
    expect(events.listeners.has('era-button:强制完全重算')).toBe(true);
    expect(events.orders.get(INPUT_EVENT.GENERATION_STARTED)).toBe('first');
    expect(events.orders.get(INPUT_EVENT.GENERATION_STOPPED)).toBe('normal');
    expect(() => adapter.subscribe(listener)).toThrowError('不允许重复注册');

    stop();
    stop();
    expect(events.count).toBe(0);
  });

  it('generation dry-run 脱离等待，真实生成返回 waitThrough 栅栏', async () => {
    const waitThrough = vi.fn(async () => ({ throughSequence: 1, outcomes: [], hasFailures: false }));
    const received: EraInboundEvent[] = [];
    const adapter = new TavernEraServiceAdapter();
    const stop = adapter.subscribe(event => {
      received.push(event);
      return accepted(waitThrough);
    });
    const generation = events.only(INPUT_EVENT.GENERATION_STARTED);

    expect(generation('type', {}, true)).toBeUndefined();
    expect(waitThrough).not.toHaveBeenCalled();
    const realBarrier = generation('type', {}, false);
    expect(realBarrier).toBeInstanceOf(Promise);
    await realBarrier;
    expect(waitThrough).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({ type: INPUT_EVENT.GENERATION_STARTED, source: 'tavern' });
    expect(received[0]?.args).toEqual(['type', {}, true]);

    expect(received.at(-1)).toMatchObject({ type: INPUT_EVENT.GENERATION_STARTED, source: 'tavern' });
    stop();
  });

  it('Agent 规划失败时在原生控制器尚未建立的场景延后到 after-commands 阻断，并随适配器清理', () => {
    const stopNative = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const stopAuxiliary = vi.fn(() => true);
    vi.stubGlobal('stopAllGeneration', stopAuxiliary);
    vi.stubGlobal('SillyTavern', {
      getContext: () => ({ stopGeneration: stopNative }),
    });

    const adapter = new TavernEraServiceAdapter();
    const stopAdapter = adapter.subscribe(() =>
      accepted(async () => ({
        throughSequence: 1,
        outcomes: [],
        hasFailures: false,
      })),
    );
    const result = adapter.agent.stop_native_generation(
      { reason: 'planning-exhausted' },
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({ status: 'deferred', nativeStopped: false, auxiliaryStopped: true });
    expect(stopAuxiliary).toHaveBeenCalledTimes(1);
    expect(stopNative).toHaveBeenCalledTimes(1);
    expect(events.listeners.has('GENERATION_AFTER_COMMANDS')).toBe(true);

    events.only('GENERATION_AFTER_COMMANDS')('regenerate', {}, false);
    expect(stopNative).toHaveBeenCalledTimes(2);
    expect(events.listeners.has('GENERATION_AFTER_COMMANDS')).toBe(false);

    adapter.agent.stop_native_generation({}, { signal: new AbortController().signal });
    expect(events.listeners.has('GENERATION_AFTER_COMMANDS')).toBe(true);
    stopAdapter();
    expect(events.listeners.has('GENERATION_AFTER_COMMANDS')).toBe(false);
  });

  it('能力严格投影消息、局部更新保留宿主字段，并在操作前后尊重 AbortSignal', async () => {
    const variables = {
      stat_data: { known: 1 },
      frameworkUnknown: { nested: [1, null, { future: true }] },
    };
    const setMessages = vi.fn(async (updates: Array<Record<string, unknown>>) => {
      for (const update of updates) {
        if (typeof update.message === 'string') {
          hostMessage.message = update.message;
          hostMessage.swipes[hostMessage.swipe_id] = update.message;
        }
        if (Array.isArray(update.swipes)) {
          hostMessage.swipes = [...update.swipes] as string[];
          hostMessage.message = hostMessage.swipes[hostMessage.swipe_id] ?? '';
          hostMessage.extra = hostMessage.swipes_info[hostMessage.swipe_id] ?? {};
        }
      }
    });
    const emitted = vi.fn(async () => undefined);
    const replaceEntries = vi.fn(async () => undefined);

    vi.stubGlobal('getVariables', () => structuredClone(variables));
    vi.stubGlobal('replaceVariables', vi.fn());
    vi.stubGlobal('updateVariablesWith', (updater: (value: Record<string, unknown>) => Record<string, unknown>) =>
      updater(variables),
    );
    const hostMessage: {
      message_id: number;
      role: string;
      message: string;
      swipe_id: number;
      swipes: string[];
      swipes_info: Record<string, unknown>[];
      extra: Record<string, unknown>;
      attachments: Record<string, unknown>[];
      send_date: Date;
      futureMessageField: Record<string, unknown>;
    } = {
      message_id: 0,
      role: 'assistant',
      message: 'hello',
      swipe_id: 1,
      swipes: ['旧分支', 'hello', '备用分支'],
      swipes_info: [{}, {}, {}],
      extra: {
        media: [{ type: 'image', url: 'asset://keep' }],
      },
      attachments: [{ type: 'image', url: 'asset://keep' }],
      send_date: new Date('2026-08-08T00:00:00Z'),
      futureMessageField: { keep: true },
    };
    vi.stubGlobal('getChatMessages', () => [hostMessage]);
    vi.stubGlobal('setChatMessages', setMessages);
    vi.stubGlobal(
      'refreshOneMessage',
      vi.fn(async () => undefined),
    );
    vi.stubGlobal('getWorldbookNames', () => ['book']);
    vi.stubGlobal('getCharWorldbookNames', () => ({ primary: 'book', additional: [], futureBinding: true }));
    vi.stubGlobal('getWorldbook', async () => [{ uid: 1, name: 'entry', futureEntryField: { keep: true } }]);
    vi.stubGlobal(
      'createWorldbook',
      vi.fn(async () => true),
    );
    vi.stubGlobal(
      'rebindCharWorldbooks',
      vi.fn(async () => undefined),
    );
    vi.stubGlobal('replaceWorldbook', replaceEntries);
    vi.stubGlobal('isCharacterTavernRegexesEnabled', () => false);
    vi.stubGlobal('getTavernRegexes', () => [{ script_name: 'regex', futureRegexField: { keep: true } }]);
    vi.stubGlobal('getCurrentCharacterName', () => '角色');
    vi.stubGlobal('getCurrentCharacterId', () => 'stable-character-avatar.png');
    vi.stubGlobal('getScriptId', () => 'script-id');
    vi.stubGlobal('eventEmit', emitted);
    const flushSettings = vi.fn(async () => undefined);
    const saveSettingsDebounced = Object.assign(
      vi.fn(() => undefined),
      { flush: flushSettings },
    );
    vi.stubGlobal('SillyTavern', {
      characterId: 1,
      groupId: null,
      characters: [],
      writeExtensionField: vi.fn(async () => undefined),
      extensionSettings: { character_allowed_regex: [] },
      saveSettingsDebounced,
      getCurrentChatId: () => 'chat-id',
      reloadCurrentChat: vi.fn(async () => undefined),
    });

    const adapter = new TavernEraServiceAdapter();
    const controller = new AbortController();
    const context = { signal: controller.signal };
    expect(await adapter.regex.read({}, context)).toEqual({
      enabled: false,
      regexes: [{ script_name: 'regex', futureRegexField: { keep: true } }],
    });
    await adapter.regex.upsert({ regex: { script_name: 'ERA 状态栏模板' } }, context);
    expect(SillyTavern.writeExtensionField).toHaveBeenCalledOnce();
    expect(SillyTavern.reloadCurrentChat).toHaveBeenCalledOnce();
    expect(SillyTavern.extensionSettings.character_allowed_regex).toEqual(['stable-character-avatar.png']);
    expect(saveSettingsDebounced).toHaveBeenCalledOnce();
    expect(flushSettings).toHaveBeenCalledOnce();
    const readVariables = await adapter.variables.read({ scope: { type: 'chat' } }, context);
    expect(readVariables).toMatchObject({
      variables: { frameworkUnknown: { nested: [1, null, { future: true }] } },
    });
    expect(adapter.identity.read({}, context)).toMatchObject({
      characterName: '角色',
      characterId: 'stable-character-avatar.png',
      chatId: 'chat-id',
      scriptId: 'script-id',
    });

    const messages = await adapter.messages.read_context(
      { projection: 'era-active-message-v1', range: '0-{{lastMessageId}}' },
      context,
    );
    expect(messages).toEqual({
      schemaVersion: 2,
      messages: [{ schemaVersion: 1, messageId: 0, role: 'assistant', activeText: 'hello', swipeIndex: 1 }],
    });
    expect(JSON.stringify(messages)).not.toContain('send_date');
    expect(JSON.stringify(messages)).not.toContain('attachments');
    expect(JSON.stringify(messages)).not.toContain('futureMessageField');
    await adapter.messages.update_content(
      {
        messageId: 0,
        content: 'next',
        refresh: 'affected',
      },
      context,
    );
    expect(setMessages).toHaveBeenCalledWith([{ message_id: 0, message: 'next' }], {
      refresh: 'affected',
    });
    expect(hostMessage.message).toBe('next');
    expect(hostMessage.swipes).toEqual(['旧分支', 'next', '备用分支']);
    expect(hostMessage.extra).toEqual({ media: [{ type: 'image', url: 'asset://keep' }] });
    expect(hostMessage.attachments).toEqual([{ type: 'image', url: 'asset://keep' }]);
    expect(hostMessage.futureMessageField).toEqual({ keep: true });

    const worldbook = await adapter.worldbook.read({ name: 'book' }, context);
    expect(worldbook).toMatchObject({ entries: [{ futureEntryField: { keep: true } }] });
    await adapter.worldbook.replace_entries(
      { name: 'book', entries: [{ uid: 1, futureEntryField: { keep: true } }] },
      context,
    );
    expect(replaceEntries).toHaveBeenCalledWith('book', [{ uid: 1, futureEntryField: { keep: true } }]);

    await adapter.regex.upsert({ regex: { script_name: 'new', futureRegexField: { keep: true } } }, context);
    expect(SillyTavern.writeExtensionField).toHaveBeenCalledTimes(2);
    await adapter.notify({ type: 'era:test', args: [{ future: true }, undefined] }, context);
    expect(emitted).toHaveBeenCalledWith('era:test', { future: true }, undefined);

    controller.abort(new Error('测试取消'));
    await expect(adapter.variables.read({ scope: { type: 'chat' } }, context)).rejects.toThrow('测试取消');
    await expect(adapter.notify({ type: 'era:test', args: [] }, context)).rejects.toThrow('测试取消');
  });
});
