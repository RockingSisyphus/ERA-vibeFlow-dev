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

/** 优先读取顶层角色卡正则开关，避免 iframe 内存镜像过期。 */
export function currentCharacterRegexEnabled(): boolean {
  for (const host of browserHosts()) {
    if (typeof host.isCharacterTavernRegexesEnabled === 'function') {
      return Reflect.apply(host.isCharacterTavernRegexesEnabled, host, []) as boolean;
    }
    const helper = host.TavernHelper;
    const callable = helper?.isCharacterTavernRegexesEnabled;
    if (typeof callable === 'function') {
      return Reflect.apply(callable, helper, []) as boolean;
    }
  }
  return isCharacterTavernRegexesEnabled();
}

/**
 * 快速初始化创建状态栏正则时，同时把当前角色加入 SillyTavern 的
 * 局部正则允许列表。多阶段生成不依赖这个开关；这里只负责让用户
 * 明确请求创建的状态栏正则实际生效；否则资源虽已写入角色卡，SillyTavern 仍会跳过执行。
 */
export async function enableCurrentCharacterRegexes(): Promise<void> {
  if (currentCharacterRegexEnabled()) return;
  const characterId = getCurrentCharacterId();
  if (!characterId) throw new TypeError('当前聊天没有角色，无法启用角色局部正则。');
  const tavern = currentTavernContext();
  const settings = tavern.extensionSettings as unknown as Record<string, unknown>;
  const current = Array.isArray(settings.character_allowed_regex)
    ? settings.character_allowed_regex.filter((value): value is string => typeof value === 'string')
    : [];
  if (!current.includes(characterId)) settings.character_allowed_regex = [...current, characterId];
  const save = tavern.saveSettingsDebounced as typeof tavern.saveSettingsDebounced & {
    flush?: () => unknown | Promise<unknown>;
  };
  const scheduled = save();
  // SillyTavern 的 saveSettingsDebounced 是 lodash debounce；仅 await 调用结果
  // 不会等待真正保存，随后可能以旧角色编辑表单覆盖刚写入的主开场白。
  if (typeof save.flush === 'function') await save.flush();
  else await scheduled;
}

/**
 * 只停止 SillyTavern 原生正文生成；必须由 Service 会话决定时机，
 * 否则辅助 generateRaw 或用户其他生成会被宿主层误停。
 */
export function stopNativeTavernGeneration(): boolean {
  for (const host of browserHosts()) {
    const api = host.SillyTavern;
    const context = api?.getContext?.();
    if (isRecord(context) && typeof context.stopGeneration === 'function') {
      return Reflect.apply(context.stopGeneration, context, []) === true;
    }
    if (typeof api?.stopGeneration === 'function') {
      return Reflect.apply(api.stopGeneration, api, []) === true;
    }
  }
  return false;
}

/** 将宿主消息输入约束为非负安全整数，避免刷新误伤其他楼层。 */
export function requireMessageId(input: Readonly<Record<string, unknown>>): number {
  const value = input.messageId ?? input.message_id;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('消息更新请求缺少非负整数 messageId。');
  }
  return value;
}

/** 按钮事件由单独通道登记，因此必须从 Tavern 目录监听集合中排除。 */
export function withoutButtonInputEvents(values: readonly string[], buttonEvents: ReadonlySet<string>): string[] {
  const result: string[] = [];
  for (const value of values) if (!buttonEvents.has(value)) result.push(value);
  return result;
}
