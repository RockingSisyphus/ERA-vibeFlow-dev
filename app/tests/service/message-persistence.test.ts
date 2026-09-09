import { afterEach, describe, expect, it, vi } from 'vitest';

import { prepareMessagePersistence } from '../../src/ERA变量框架/service/message-persistence';

function fixture(extra?: Record<string, unknown>) {
  const character = { name: 'A', avatar: 'A.png', chat: 'chat-A' };
  const message = {
    mes: 'old',
    swipe_id: 1,
    swipes: ['other', 'old'],
    extra: { attachment: 'keep' },
    swipe_info: [{ extra: {} }, { extra: {} }],
  };
  let saved = structuredClone(message);
  const save = vi.fn(async () => {
    saved = structuredClone(message);
  });
  const read = vi.fn(async (_url: string, _options: { body: string }) => ({
    ok: true,
    json: async () => [{ user_name: 'header' }, saved],
  }));
  vi.stubGlobal('SillyTavern', {
    characterId: '0',
    groupId: null,
    characters: [character],
    chat: [message],
    saveChat: save,
    getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    getCurrentChatId: () => character.chat,
  });
  vi.stubGlobal('getCurrentCharacterId', () => '0');
  vi.stubGlobal('getChatMessages', () => [{ message_id: 0, role: 'assistant', ...message }]);
  vi.stubGlobal('fetch', read);
  const confirm = prepareMessagePersistence(
    { updates: [{ message_id: 0, message: 'new MK', extra }] },
    new AbortController().signal,
  );
  message.mes = 'new MK';
  message.swipes[1] = 'new MK';
  Object.assign(message.extra, extra);
  return {
    character,
    message,
    save,
    read,
    confirm,
    setSaved: (value: typeof message) => {
      saved = value;
    },
  };
}

describe('message persistence completion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the fixed file and requested active Swipe after public save', async () => {
    const f = fixture();
    expect(await f.confirm()).toEqual({ status: 'committed' });
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(JSON.parse(f.read.mock.calls[0]![1].body)).toEqual({
      avatar_url: 'A.png',
      ch_name: 'A',
      file_name: 'chat-A',
    });
    expect(f.message.extra).toEqual({ attachment: 'keep' });
  });

  it('does not treat a swallowed save error as success', async () => {
    const f = fixture();
    f.save.mockImplementation(async () => undefined);
    expect(await f.confirm()).toMatchObject({
      status: 'failed',
      writeState: 'memory-written',
      persistenceConfirmed: false,
    });
    expect(f.message.mes).toBe('new MK');
  });

  it('does not select or save another chat if navigation happened after the memory write', async () => {
    const f = fixture();
    f.character.chat = 'chat-B';
    expect(await f.confirm()).toMatchObject({ status: 'failed' });
    expect(f.save).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
  });

  it('still reads A and reports source change when navigation occurs inside public save', async () => {
    const f = fixture();
    f.save.mockImplementation(async () => {
      f.setSaved(structuredClone(f.message));
      f.character.chat = 'chat-B';
    });
    expect(await f.confirm()).toMatchObject({ status: 'failed', persistenceConfirmed: true, sourceChanged: true });
    expect(JSON.parse(f.read.mock.calls[0]![1].body).file_name).toBe('chat-A');
  });

  it('checks the original slot rather than the selected candidate', async () => {
    const f = fixture();
    f.save.mockImplementation(async () => {
      f.setSaved({ ...f.message, swipe_id: 0 });
    });
    expect(await f.confirm()).toMatchObject({ status: 'committed' });
  });

  it('confirms B on disk but reports the newly selected C as a source change', async () => {
    const f = fixture();
    f.save.mockImplementation(async () => {
      f.message.swipes.push('C');
      f.message.swipe_id = 2;
      f.message.mes = 'C';
      f.setSaved(structuredClone(f.message));
    });
    expect(await f.confirm()).toMatchObject({ status: 'failed', persistenceConfirmed: true, sourceChanged: true });
    expect(f.message.mes).toBe('C');
  });

  it('does not confirm a missing original slot even when the selected text matches', async () => {
    const f = fixture();
    f.save.mockImplementation(async () => f.setSaved({ ...f.message, swipe_id: 0, swipes: ['new MK'] }));
    expect(await f.confirm()).toMatchObject({ status: 'failed', persistenceConfirmed: false, sourceChanged: false });
  });

  it.each([true, false])('checks inactive candidate ERA extra (correct=%s)', async correct => {
    const extra = { era_agent: { status: 'settled' } };
    const f = fixture(extra);
    f.save.mockImplementation(async () => {
      f.message.swipe_info[1] = { extra: correct ? extra : {} };
      f.message.swipe_id = 0;
      f.message.mes = 'other';
      f.setSaved(structuredClone(f.message));
    });
    expect(await f.confirm()).toMatchObject({ status: 'failed', persistenceConfirmed: correct, sourceChanged: true });
  });

  it.each(['edit', 'delete'])('recognizes %s during saving without claiming persistence', async change => {
    const f = fixture();
    f.save.mockImplementation(async () => {
      if (change === 'edit') {
        f.message.mes = 'edited';
        f.message.swipes[1] = 'edited';
      } else vi.stubGlobal('getChatMessages', () => []);
      f.setSaved(structuredClone(f.message));
    });
    expect(await f.confirm()).toMatchObject({
      status: 'failed',
      sourceChanged: true,
      persistenceConfirmed: change === 'delete',
    });
  });

  it('reports readback failure without retrying or changing the in-memory write', async () => {
    const f = fixture();
    f.read.mockRejectedValue(new Error('read network failed'));
    expect(await f.confirm()).toMatchObject({ status: 'failed', message: 'read network failed' });
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.message.mes).toBe('new MK');
  });
});
