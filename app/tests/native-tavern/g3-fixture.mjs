/** G3的可记录Tavern API环境；不代替Capability或业务规划。 */
import { fixture } from './native-fixture.mjs';
import { EVENT_CATALOG } from '../../src/ERA变量框架/events/catalog.ts';
export async function nativeG3(workflow, traceEvents) {
  let notificationCount = 0;
  const warnings = [],
    files = new Map();
  let chatVariables = { stat_data: {}, ERAMetaData: { SelectedMks: [], EditLogs: {} } },
    scriptVariables = {},
    saved = [];
  const card = {
    avatar: 'probe-card.png',
    name: '运行时探针角色',
    chat: 'probe-chat',
    first_mes: '运行时探针消息',
    data: { extensions: {} },
  };
  const chat = [
    {
      message_id: 0,
      role: 'assistant',
      is_user: false,
      mes: card.first_mes,
      swipe_id: 0,
      swipes: [card.first_mes],
      extra: {},
    },
  ];
  const tavern = {
    characterId: 0,
    groupId: null,
    characters: [card],
    chat,
    chatMetadata: { tainted: true },
    extensionSettings: {},
    getCurrentChatId: () => card.chat,
    getRequestHeaders: () => ({}),
    writeExtensionField: async () => {},
    saveSettingsDebounced: async () => {},
    reloadCurrentChat: async () => {},
    saveChat: async () => {
      saved = structuredClone(chat);
    },
  };
  let regexes = [],
    worldbookNames = [],
    entries = [],
    readFailure = false;
  const api = {
    location: { origin: 'http://tavern.test' },
    SillyTavern: tavern,
    getCurrentCharacterId: () => 'probe-card',
    getCurrentCharacterName: () => card.name,
    getScriptId: () => 'era-probe',
    getScriptTrees: ({ type }) => (type === 'character' ? [{ type: 'script', id: 'era-probe', enabled: true }] : []),
    getVariables: scope => {
      if (readFailure && scope.type === 'chat') throw new Error('Sidecar 读取故障探针');
      return structuredClone(scope.type === 'script' ? scriptVariables : chatVariables);
    },
    replaceVariables: (value, scope) => {
      if (scope.type === 'script') scriptVariables = structuredClone(value);
      else chatVariables = structuredClone(value);
    },
    updateVariablesWith: (fn, scope) => {
      if (scope.type === 'script') scriptVariables = fn(structuredClone(scriptVariables));
      else chatVariables = fn(structuredClone(chatVariables));
    },
    getChatMessages: range =>
      structuredClone(
        typeof range === 'number'
          ? chat[range]
            ? [{ ...chat[range], message: chat[range].mes }]
            : []
          : chat.map(m => ({ ...m, message: m.mes })),
      ),
    setChatMessages: async updates => {
      for (const u of updates) {
        const message = chat[u.message_id];
        if (u.message !== undefined) {
          message.mes = u.message;
          message.swipes[message.swipe_id] = u.message;
        }
        if (u.extra) message.extra = structuredClone(u.extra);
      }
    },
    refreshOneMessage: async () => {},
    reloadCurrentChat: async () => {},
    getCharacter: async () => ({ first_messages: [card.first_mes] }),
    getWorldbookNames: () => worldbookNames,
    getCharWorldbookNames: () => ({ primary: null, additional: [] }),
    getWorldbook: async () => entries,
    createWorldbook: async name => {
      worldbookNames.push(name);
    },
    replaceWorldbook: async (_name, value) => {
      entries = structuredClone(value);
    },
    getTavernRegexes: () => structuredClone(regexes),
    replaceTavernRegexes: async value => {
      regexes = structuredClone(value);
    },
    isCharacterTavernRegexesEnabled: () => true,
    enableCharacterTavernRegexes: async () => {},
    updateCharacterWith: async fn => fn(card),
    fetch: async (url, options = {}) => {
      const path = new URL(url).pathname;
      if (path === '/api/chats/get')
        return { ok: true, status: 200, json: async () => [{ header: true }, ...structuredClone(saved)] };
      if (path === '/api/files/upload') {
        const upload = JSON.parse(options.body);
        files.set(upload.name, JSON.parse(Buffer.from(upload.data, 'base64').toString('utf8')));
        return { ok: true, status: 200 };
      }
      if (path.startsWith('/user/files/')) {
        const name = decodeURIComponent(path.slice('/user/files/'.length)),
          value = files.get(name);
        return {
          ok: value !== undefined,
          status: value === undefined ? 404 : 200,
          text: async () => JSON.stringify(value),
        };
      }
      if (path === '/api/characters/merge-attributes') {
        card.first_mes = JSON.parse(options.body).first_mes;
        return { ok: true, status: 200 };
      }
      throw new Error(`G3未计划的Tavern请求：${path}`);
    },
  };
  const owner = await fixture(
    (inputs, options) =>
      workflow.runWorkflowAsync(inputs, {
        ...options,
        ...(traceEvents ? { trace: 'full', onTrace: event => traceEvents.push(event) } : { trace: 'off' }),
      }),
    {
      api,
      eventDefinitions: [...EVENT_CATALOG.values()],
      warn: (message, details) => warnings.push({ message, details }),
    },
  );
  owner.api.eventEmit = async (type, ...args) => {
    notificationCount++;
    for (const handler of owner.handlers.get(type) ?? []) await handler(...args);
  };
  return {
    owner,
    setReadFailure: value => {
      readFailure = value;
    },
    emit: event => owner.direct({ action: 'admit', input: event }).result,
    snapshot: () => ({
      registrations: Number(Boolean(owner.client)),
      listenerCount: [...owner.handlers.values()].reduce((n, handlers) => n + handlers.size, 0),
      removals: owner.disposed(),
      notifications: notificationCount,
      warnings: warnings.length,
      message: chat.at(-1)?.mes ?? '',
      sidecarRecords: files.size,
      workbenchRecord: structuredClone(
        [...(owner.session.workingByChat?.values() ?? [])][0]?.record ?? [...files.values()][0] ?? null,
      ),
    }),
  };
}
