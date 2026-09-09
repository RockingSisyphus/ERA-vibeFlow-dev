import { describe, expect, it, vi } from 'vitest';

import {
  assertMessageWriteTargets,
  MessageWriteTargetChanged,
} from '../../src/ERA变量框架/service/message-write-target';

const chat = { characterId: 'card-a', chatId: 'chat-a', groupId: null };
const target = { messageId: 4, swipeId: 1, sourceText: 'B <era_data>stable-b</era_data>' };

describe('message write target facts', () => {
  it('allows two explicit operations against the same unchanged source without payload deduplication', () => {
    const read = vi.fn(() => ({ swipeId: 1, text: target.sourceText }));
    assertMessageWriteTargets(chat, chat, [target], read);
    assertMessageWriteTargets(chat, chat, [target], read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['chat', { ...chat, chatId: 'chat-b' }, { swipeId: 1, text: target.sourceText }],
    ['chat', { ...chat, characterId: 'card-b' }, { swipeId: 1, text: target.sourceText }],
    ['chat', { ...chat, groupId: 'group-b' }, { swipeId: 1, text: target.sourceText }],
    ['missing-message', chat, null],
    ['swipe', chat, { swipeId: 2, text: 'C' }],
    ['source-text', chat, { swipeId: 1, text: 'user edited B but retained MK' }],
  ] as const)('rejects changed %s before any message write', (reason, currentChat, message) => {
    const write = vi.fn();
    try {
      assertMessageWriteTargets(chat, currentChat, [target], () => message);
      write();
      expect.unreachable('changed target must not reach the write');
    } catch (error) {
      expect(error).toBeInstanceOf(MessageWriteTargetChanged);
      expect(error).toMatchObject({ reason, written: false, code: 'ERA_MESSAGE_WRITE_TARGET_CHANGED' });
    }
    expect(write).not.toHaveBeenCalled();
  });

  it('checks every target before a batch begins, including deletion or renumbering of an earlier floor', () => {
    const targets = [{ messageId: 1, swipeId: 0, sourceText: 'first floor' }, target];
    expect(() =>
      assertMessageWriteTargets(chat, chat, targets, id =>
        id === 1 ? { swipeId: 0, text: 'different floor now at this index' } : { swipeId: 1, text: target.sourceText },
      ),
    ).toThrow(MessageWriteTargetChanged);
  });

  it('does not read message data after a chat change, even when the other chat has identical text', () => {
    const read = vi.fn(() => ({ swipeId: 1, text: target.sourceText }));
    expect(() => assertMessageWriteTargets(chat, { ...chat, chatId: 'other' }, [target], read)).toThrow(
      MessageWriteTargetChanged,
    );
    expect(read).not.toHaveBeenCalled();
  });
});
