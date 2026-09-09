import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectMessage } from '../../src/ERA变量框架/service/message-projection';
import { assertCurrentMessageBasis } from '../../src/ERA变量框架/service/message-write-target';
import { TavernEraServiceAdapter } from '../../src/ERA变量框架/service/tavern-adapter';

describe('complete message topology during native Overswipe', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the reserved candidate empty instead of borrowing old mes text', () => {
    const message = { message_id: 2, role: 'assistant', swipe_id: 3, swipes: ['A', 'B', 'C'], mes: 'C' };
    expect(projectMessage(message, 2)).toMatchObject({ messageId: 2, swipeIndex: 3, activeText: '' });
    expect(message.swipes).toEqual(['A', 'B', 'C']);
    expect(projectMessage({ ...message, swipe_id: 1 }, 2).activeText).toBe('B');
    expect(() => projectMessage({ message_id: 2, role: 'assistant', swipe_id: 5, swipes: ['A'] }, 2)).toThrow();
    expect(() => projectMessage({ message_id: 2, role: 'assistant' }, 2)).toThrow();
  });

  it('uses the same complete range and pending projection for reads and write-source comparison', async () => {
    const identity = { characterId: 'card', chatId: 'chat', groupId: null };
    const raw = [
      { message_id: 0, role: 'assistant', swipe_id: 0, swipes: ['initial'] },
      { message_id: 1, role: 'assistant', swipe_id: 0, swipes: ['previous_floor'] },
      { message_id: 2, role: 'assistant', swipe_id: 3, swipes: ['A', 'B', 'C'] },
    ];
    const read = vi.fn((range: string) => (range === '0--1' ? raw : raw.slice(0, -1)));
    vi.stubGlobal('getChatMessages', read);
    vi.stubGlobal('getCurrentCharacterId', () => identity.characterId);
    vi.stubGlobal('SillyTavern', { groupId: null, getCurrentChatId: () => identity.chatId });
    const adapter = new TavernEraServiceAdapter();
    const result = await adapter.messages.read_context({ projection: 'era-active-message-v1' }, {
      signal: new AbortController().signal,
    } as never);
    expect(result).toEqual({ schemaVersion: 2, messages: raw.map(projectMessage) });
    expect(() => assertCurrentMessageBasis({ identity, messages: raw.map(projectMessage) })).not.toThrow();
    expect(read.mock.calls.every(([range]) => range === '0--1')).toBe(true);
    raw.length = 0;
    expect(
      await adapter.messages.read_context({ projection: 'era-active-message-v1' }, {
        signal: new AbortController().signal,
      } as never),
    ).toEqual({ schemaVersion: 2, messages: [] });
  });
});
