import {
  planGreetingRefresh,
  type GreetingRefreshFacts,
} from '../../../javascript_project/service/base_lib/greeting_refresh_policy';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture as nativeFixture } from '../native-tavern/native-fixture.mjs';

type FixtureOptions = Readonly<{
  chat?: SillyTavern.ChatMessage[];
  tainted?: boolean;
}>;

function fixture(options: FixtureOptions = {}) {
  const character = {
    name: '显示名称',
    avatar: 'real-avatar-file.png',
    first_mes: '作者原文',
    data: { first_mes: '作者原文' },
    json_data: JSON.stringify({ first_mes: '作者原文', data: { first_mes: '作者原文' } }),
  };
  const chat = options.chat ?? [
    {
      name: '显示名称',
      is_user: false,
      is_system: false,
      mes: '作者原文',
      swipe_id: 0,
      swipes: ['作者原文', '备用开场白'],
      swipe_info: [{ marker: 'keep-primary' }, { marker: 'keep-alternate' }],
      extra: { marker: 'keep-message-extra' },
    },
  ];
  const emit = vi.fn(async () => undefined);
  const clearChat = vi.fn(async () => undefined);
  const printMessages = vi.fn(async () => undefined);
  const saveChat = vi.fn(async () => undefined);
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 }),
  );
  const tavern = {
    characterId: '0',
    groupId: '',
    name2: '显示名称',
    characters: [character],
    chat,
    chatMetadata: { tainted: options.tainted === true },
    writeExtensionField: vi.fn(),
    extensionSettings: {},
    saveSettingsDebounced: vi.fn(),
    getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'test' }),
    reloadCurrentChat: vi.fn(),
    saveChat,
    printMessages,
    clearChat,
    eventSource: { emit },
    eventTypes: {
      MESSAGE_RECEIVED: 'message_received',
      CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
    },
  };

  vi.stubGlobal('window', { top: { document: { querySelector: () => null } } });
  vi.stubGlobal('SillyTavern', tavern as unknown as typeof SillyTavern);
  vi.stubGlobal('getCurrentCharacterName', () => '显示名称');
  vi.stubGlobal('getCharacter', async () => ({ first_messages: ['作者原文'] }));
  vi.stubGlobal('fetch', fetchMock);

  return { character, chat, emit, clearChat, printMessages, saveChat, fetchMock };
}

async function writeGreeting() {
  const native = await nativeFixture(undefined, { api: { ...globalThis, location: { origin: 'http://tavern.test' } } });
  const adapter = native.caps['era.tavern.character'];
  try {
    const input = {
      expected: '作者原文',
      next: '作者原文\n<VariableInsert>demo</VariableInsert>\n<StatusPlaceHolderImpl/>',
    };
    const context = { signal: new AbortController().signal };
    const written = (await adapter.write_main_greeting(input, context)) as Record<string, unknown>;
    const target = planGreetingRefresh(
      input.expected,
      input.next,
      adapter.read_greeting_refresh_context({}, context) as GreetingRefreshFacts,
    );
    const chatRefresh =
      target.kind === 'result'
        ? target.result
        : await adapter.apply_greeting_refresh({ ...target, next: input.next }, context);
    return { ...written, chatRefresh };
  } finally {
    native.page.dispatchEvent(new Event('pagehide'));
    await native.work;
  }
}

describe('角色主开场白初始化适配器', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('用真实 avatar 持久化，并把纯净主开场白同步到当前首楼后走完整重绘链', async () => {
    const state = fixture({
      chat: [
        {
          name: '显示名称',
          is_user: false,
          is_system: false,
          mes: '作者原文\n<era_data>{"era-message-key"="mk-0"}</era_data>\n<StatusPlaceHolderImpl/>',
          swipe_id: 0,
          swipes: ['作者原文\n<era_data>{"era-message-key"="mk-0"}</era_data>\n<StatusPlaceHolderImpl/>', '备用开场白'],
          swipe_info: [{ marker: 'keep-primary' }, { marker: 'keep-alternate' }],
          extra: { marker: 'keep-message-extra' },
        },
      ],
    });

    await expect(writeGreeting()).resolves.toMatchObject({
      status: 'updated',
      chatRefresh: { status: 'refreshed' },
    });

    const request = state.fetchMock.mock.calls[0];
    expect(request?.[0]).toBe('http://tavern.test/api/characters/merge-attributes');
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      avatar: 'real-avatar-file.png',
      first_mes: expect.stringContaining('<StatusPlaceHolderImpl/>'),
    });
    expect(state.character.first_mes).toContain('<VariableInsert>demo</VariableInsert>');
    expect(state.chat[0]?.mes).toBe('作者原文\n<VariableInsert>demo</VariableInsert>\n<StatusPlaceHolderImpl/>');
    expect(state.chat[0]?.swipes).toEqual([
      '作者原文\n<VariableInsert>demo</VariableInsert>\n<StatusPlaceHolderImpl/>',
      '备用开场白',
    ]);
    expect(state.chat[0]?.extra).toEqual({ marker: 'keep-message-extra' });
    expect(state.chat[0]?.swipe_info).toEqual([{ marker: 'keep-primary' }, { marker: 'keep-alternate' }]);
    expect(state.emit.mock.calls).toEqual([
      ['message_received', 0, 'first_message'],
      ['character_message_rendered', 0, 'first_message'],
    ]);
    expect(state.clearChat).toHaveBeenCalledOnce();
    expect(state.printMessages).toHaveBeenCalledOnce();
    expect(state.saveChat).toHaveBeenCalledOnce();
  });

  it('角色卡仍写入，但已有多楼聊天完全保留且不触发重绘', async () => {
    const first = {
      name: '显示名称',
      is_user: false,
      is_system: false,
      mes: '作者原文',
      extra: { marker: 'first' },
    };
    const second = { name: '用户', is_user: true, is_system: false, mes: '继续', extra: { marker: 'second' } };
    const state = fixture({ chat: [first, second] });

    await expect(writeGreeting()).resolves.toMatchObject({
      status: 'updated',
      chatRefresh: { status: 'preserved', reason: '当前聊天已有多楼历史。' },
    });

    expect(state.chat).toEqual([first, second]);
    expect(state.emit).not.toHaveBeenCalled();
    expect(state.clearChat).not.toHaveBeenCalled();
    expect(state.printMessages).not.toHaveBeenCalled();
    expect(state.saveChat).not.toHaveBeenCalled();
  });

  it('已编辑或备用 Swipe 的单首楼保留当前正文', async () => {
    const edited = fixture({
      chat: [{ name: '显示名称', is_user: false, is_system: false, mes: '用户编辑后的开场白', extra: {} }],
    });
    await expect(writeGreeting()).resolves.toMatchObject({
      chatRefresh: { status: 'preserved', reason: '首楼内容已不等于角色卡原主开场白。' },
    });
    expect(edited.chat[0]?.mes).toBe('用户编辑后的开场白');
    expect(edited.emit).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    const alternate = fixture({
      chat: [
        {
          name: '显示名称',
          is_user: false,
          is_system: false,
          mes: '备用开场白',
          swipe_id: 1,
          swipes: ['作者原文', '备用开场白'],
          extra: {},
        },
      ],
    });
    await expect(writeGreeting()).resolves.toMatchObject({
      chatRefresh: { status: 'preserved', reason: '首楼当前显示的是备用开场白。' },
    });
    expect(alternate.chat[0]?.mes).toBe('备用开场白');
    expect(alternate.emit).not.toHaveBeenCalled();
  });
});
