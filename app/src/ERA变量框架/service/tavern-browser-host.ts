/*
 * 模块职责：在 Tavern Helper 后台 iframe 与顶层 SillyTavern 之间
 * 选择同一个真实宿主。这里只做宿主发现和 API 投影，不决定
 * Agent 会话、角色卡配置或生成语义。
 */

export type CurrentTavernContext = Pick<
  typeof SillyTavern,
  | 'characterId'
  | 'groupId'
  | 'characters'
  | 'chat'
  | 'name2'
  | 'chatMetadata'
  | 'writeExtensionField'
  | 'extensionSettings'
  | 'saveSettingsDebounced'
  | 'getRequestHeaders'
  | 'reloadCurrentChat'
  | 'saveChat'
  | 'printMessages'
  | 'clearChat'
  | 'eventSource'
  | 'eventTypes'
>;

type BrowserHost = {
  readonly SillyTavern?: typeof SillyTavern & {
    readonly getContext?: () => unknown;
    readonly stopGeneration?: () => boolean;
  };
  readonly TavernHelper?: Readonly<Record<string, unknown>>;
  readonly isCharacterTavernRegexesEnabled?: () => boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function browserHosts(): readonly BrowserHost[] {
  const hosts: BrowserHost[] = [];
  const browserWindow = typeof window === 'undefined' ? null : window;
  for (const candidate of [browserWindow?.top, browserWindow?.parent, browserWindow, globalThis]) {
    const host = candidate as unknown as BrowserHost;
    if (candidate && !hosts.includes(host)) hosts.push(host);
  }
  return hosts;
}

/**
 * 读写必须使用同一宿主，因为 iframe facade 可能只有过期内存镜像；
 * 只在顶层不可用时回退，避免配置写到非当前角色。
 */
export function currentTavernContext(): CurrentTavernContext {
  for (const host of browserHosts()) {
    const api = host.SillyTavern;
    const context = api?.getContext?.();
    if (
      isRecord(context) &&
      Object.prototype.hasOwnProperty.call(context, 'characterId') &&
      Array.isArray(context.characters) &&
      typeof context.writeExtensionField === 'function'
    ) {
      return context as CurrentTavernContext;
    }
  }
  return SillyTavern;
}
