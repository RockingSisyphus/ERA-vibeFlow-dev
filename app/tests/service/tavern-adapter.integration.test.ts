import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INPUT_EVENT } from '../../src/ERA变量框架/events/catalog';
import { ERA_TAVERN_LISTENER_COUNT, TavernEraServiceAdapter } from '../../src/ERA变量框架/service/tavern-adapter';
import type { EraAdmissionAccepted, EraInboundEvent } from '../../src/ERA变量框架/service/types';
import { ERA_API_EVENTS } from '../../src/ERA变量框架/utils/constants';

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
    vi.stubGlobal('eventRemoveListener', (type: string, handler: EventHandler) => events.remove(type, handler));
    vi.stubGlobal('getButtonEvent', (name: string) => `era-button:${name}`);
    vi.stubGlobal('toastr', { error: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('只注册 22 个目录事件与 3 个按钮，13 个对外 API 各一次', () => {
    const adapter = new TavernEraServiceAdapter();
    const listener = vi.fn(() => accepted(async () => ({ throughSequence: 1, outcomes: [], hasFailures: false })));
    const stop = adapter.subscribe(listener);

    expect(events.count).toBe(ERA_TAVERN_LISTENER_COUNT);
    expect(events.listeners.size).toBe(ERA_TAVERN_LISTENER_COUNT);
    for (const apiType of Object.values(ERA_API_EVENTS)) {
      expect(events.listeners.get(apiType)?.size).toBe(1);
    }
    expect(events.listeners.has(INPUT_EVENT.MANUAL_WRITE)).toBe(false);
    expect(events.listeners.has(INPUT_EVENT.MANUAL_SYNC)).toBe(false);
    expect(events.listeners.has(INPUT_EVENT.MANUAL_FULL_SYNC)).toBe(false);
    expect(events.listeners.has('era-button:写入变量修改')).toBe(true);
    expect(events.listeners.has('era-button:手动同步状态')).toBe(true);
    expect(events.listeners.has('era-button:强制完全重算')).toBe(true);
    expect(events.orders.get(INPUT_EVENT.GENERATION_STARTED)).toBe('first');
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

    events.only(ERA_API_EVENTS.GET_CURRENT_VARS)({ futureRequest: true });
    expect(received.at(-1)).toMatchObject({ type: ERA_API_EVENTS.GET_CURRENT_VARS, source: 'era-api' });
    stop();
  });

  it('能力严格投影消息、局部更新保留宿主字段，并在操作前后尊重 AbortSignal', async () => {
    const variables = {
      stat_data: { known: 1 },
      frameworkUnknown: { nested: [1, null, { future: true }] },
    };
    const setMessages = vi.fn(async () => undefined);
    const emitted = vi.fn(async () => undefined);
    const replaceEntries = vi.fn(async () => undefined);
    const updateRegexes = vi.fn(async (updater: (value: unknown[]) => unknown[]) =>
      updater([{ script_name: 'existing', futureRegexField: { keep: true } }]),
    );

    vi.stubGlobal('getVariables', () => structuredClone(variables));
    vi.stubGlobal('replaceVariables', vi.fn());
    vi.stubGlobal('updateVariablesWith', (updater: (value: Record<string, unknown>) => Record<string, unknown>) =>
      updater(variables),
    );
    const hostMessage = {
      message_id: 0,
      role: 'assistant',
      message: 'hello',
      swipe_id: 1,
      swipes: ['旧分支', 'hello', '备用分支'],
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
    vi.stubGlobal('isCharacterTavernRegexesEnabled', () => true);
    vi.stubGlobal('getTavernRegexes', () => [{ script_name: 'regex', futureRegexField: { keep: true } }]);
    vi.stubGlobal('updateTavernRegexesWith', updateRegexes);
    vi.stubGlobal('getCurrentCharacterName', () => '角色');
    vi.stubGlobal('getScriptId', () => 'script-id');
    vi.stubGlobal('eventEmit', emitted);
    vi.stubGlobal('SillyTavern', {
      characterId: 'character-id',
      groupId: null,
      getCurrentChatId: () => 'chat-id',
      reloadCurrentChat: vi.fn(async () => undefined),
    });

    const adapter = new TavernEraServiceAdapter();
    const controller = new AbortController();
    const context = { signal: controller.signal };
    const readVariables = await adapter.variables.read({ scope: { type: 'chat' } }, context);
    expect(readVariables).toMatchObject({
      variables: { frameworkUnknown: { nested: [1, null, { future: true }] } },
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
    expect(setMessages).toHaveBeenCalledWith([{ message_id: 0, swipes: ['旧分支', 'next', '备用分支'] }], {
      refresh: 'affected',
    });
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
    expect(updateRegexes).toHaveReturned();
    await adapter.notify({ type: 'era:test', args: [{ future: true }, undefined] }, context);
    expect(emitted).toHaveBeenCalledWith('era:test', { future: true }, undefined);

    controller.abort(new Error('测试取消'));
    await expect(adapter.variables.read({ scope: { type: 'chat' } }, context)).rejects.toThrow('测试取消');
    await expect(adapter.notify({ type: 'era:test', args: [] }, context)).rejects.toThrow('测试取消');
  });
});
