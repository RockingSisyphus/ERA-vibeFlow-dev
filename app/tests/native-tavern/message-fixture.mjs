/** 为原消息单测补足可记录的Tavern保存环境，所有写入和确认执行正式AOT入口。 */
import { fixture } from './native-fixture.mjs';
export async function messageOwner() {
  const overlay = new Map();
  let saved = [];
  const rawMessages = () =>
    typeof globalThis.getChatMessages === 'function'
      ? globalThis.getChatMessages('0--1', { include_swipes: true })
      : [];
  const messages = () =>
    rawMessages().map((raw, index) => {
      const id = raw.message_id ?? index,
        partial = raw.role === undefined && raw.mes === undefined && raw.message === undefined;
      const patch = partial ? (overlay.get(id) ?? {}) : {};
      const text = patch.message ?? raw.mes ?? raw.message ?? raw.swipes?.[raw.swipe_id ?? 0] ?? '';
      const swipes = partial ? [text] : (raw.swipes ?? [text]);
      return {
        ...raw,
        ...patch,
        message_id: id,
        role: raw.role ?? 'assistant',
        mes: text,
        message: text,
        swipe_id: raw.swipe_id ?? 0,
        swipes,
      };
    });
  const fallback = {
    characterId: 0,
    groupId: null,
    characters: [{ avatar: 'fixture-card.png', name: 'Fixture', chat: 'fixture-chat' }],
    getCurrentChatId: () => 'fixture-chat',
    getRequestHeaders: () => ({}),
  };
  const tavern = new Proxy(fallback, {
    get: (target, key) => {
      const actual = globalThis.SillyTavern;
      if (key === 'chat') {
        if (actual?.chat) return actual.chat;
        const chat = [];
        for (const message of messages()) chat[message.message_id] = message;
        return chat;
      }
      if (key === 'saveChat')
        return async () => {
          if (typeof actual?.saveChat === 'function') await actual.saveChat();
          else {
            saved = [];
            for (const message of messages()) saved[message.message_id] = structuredClone(message);
          }
        };
      return actual?.[key] ?? target[key];
    },
  });
  const api = {
    location: { origin: 'http://tavern.test' },
    SillyTavern: tavern,
    getCurrentCharacterId: () =>
      typeof globalThis.getCurrentCharacterId === 'function' ? globalThis.getCurrentCharacterId() : 'card',
    getChatMessages: range => {
      const values = messages();
      return typeof range === 'number' ? values.filter(m => m.message_id === range) : values;
    },
    getVariables: scope => (typeof globalThis.getVariables === 'function' ? globalThis.getVariables(scope) : {}),
    setChatMessages: async (updates, options) => {
      for (const update of updates) overlay.set(update.message_id, update);
      if (typeof globalThis.setChatMessages === 'function') await globalThis.setChatMessages(updates, options);
    },
    fetch: async (url, options) =>
      typeof globalThis.fetch === 'function' && globalThis.fetch !== nativeFetch
        ? await globalThis.fetch(url, options)
        : { ok: true, json: async () => [{}, ...saved] },
    refreshOneMessage: async id => {
      if (typeof globalThis.refreshOneMessage === 'function') await globalThis.refreshOneMessage(id);
    },
  };
  const owner = await fixture(undefined, { api });
  return owner;
}
const nativeFetch = globalThis.fetch;
export async function writeMessage(input) {
  const owner = await messageOwner();
  try {
    return await owner.caps['era.tavern.messages'].update_content(input);
  } catch (error) {
    let cause = error;
    while (cause?.code === 'VF_NODE_FAILED' && cause.cause) cause = cause.cause;
    throw cause;
  } finally {
    owner.page.dispatchEvent(new Event('pagehide'));
    await owner.work;
  }
}
