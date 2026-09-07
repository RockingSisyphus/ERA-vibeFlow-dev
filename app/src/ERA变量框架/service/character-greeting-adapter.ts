/**
 * 封装角色卡主开场白的宿主读写，并且仅在当前聊天仍可证明是未编辑的主开场白时同步首楼。
 * 它不解析 ERA 变量、不写 Sidecar，也不替代 Service 的初始化事务与乐观并发检查。
 */
import type { EraCapabilityContext, EraTavernAdapter } from './types';
import { currentTavernContext } from './tavern-browser-host';

type ThrowIfAborted = (signal: AbortSignal) => void;

type GreetingRefreshResult = Readonly<{
  status: 'refreshed' | 'preserved' | 'not-applicable';
  reason: string;
}>;

type GreetingRefreshTarget =
  | Readonly<{ kind: 'result'; result: GreetingRefreshResult }>
  | Readonly<{ kind: 'empty' }>
  | Readonly<{ kind: 'message'; message: SillyTavern.ChatMessage; updated: string }>;

function syncCharacterEditorDraft(firstMessage: string): void {
  // SillyTavern 会把角色编辑器输入以 debounce 延后约一秒保存。ERA 的后端写入
  // 若不同时更新这份草稿，先前由其他角色资源更新排队的保存会重新提交旧开场白，
  // 从而反向覆盖已经成功写入的示例变量。这里只同步宿主表单的权威草稿值，
  // 不派发 input/change，也不会因此启动另一轮角色保存。
  const topDocument = window.top?.document;
  if (!topDocument) return;
  const firstMessageField = topDocument.querySelector<HTMLTextAreaElement>('#firstmessage_textarea');
  if (firstMessageField) firstMessageField.value = firstMessage;
}

async function persistCurrentMainGreeting(next: string): Promise<void> {
  const tavern = currentTavernContext();
  const characterIndex = Number(tavern.characterId);
  const character = tavern.characters[characterIndex] as unknown as {
    avatar?: unknown;
    first_mes?: string;
    json_data?: string;
    data?: { first_mes?: string };
  };
  if (!Number.isSafeInteger(characterIndex) || characterIndex < 0 || typeof character?.avatar !== 'string') {
    throw new Error('ERA_CHARACTER_GREETING_MISSING: 无法解析当前角色卡。');
  }

  // Tavern Helper replaceCharacter 用显示名拼接 avatar_url；当角色显示名与实际
  // PNG 文件名不同时，它会向错误目标提交。SillyTavern 的 merge-attributes 接口
  // 接收真实 avatar，并能原子更新 V2 first_mes；受控首楼重绘在持久化成功后另行执行。
  const response = await fetch('/api/characters/merge-attributes', {
    method: 'POST',
    headers: tavern.getRequestHeaders(),
    body: JSON.stringify({ avatar: character.avatar, first_mes: next, data: { first_mes: next } }),
  });
  if (!response.ok) {
    throw new Error(`ERA_CHARACTER_GREETING_WRITE_FAILED: ${response.status} ${await response.text()}`);
  }

  // merge-attributes 故意不刷新前端缓存；同步同一份宿主角色镜像，保证随后的
  // capability 读取和导出立即看到权威值，同时不触发无条件 CHARACTER_EDITED。
  character.first_mes = next;
  if (character.data) character.data.first_mes = next;
  if (typeof character.json_data === 'string') {
    const json = JSON.parse(character.json_data) as { first_mes?: string; data?: { first_mes?: string } };
    json.first_mes = next;
    if (json.data) json.data.first_mes = next;
    character.json_data = JSON.stringify(json);
  }

  // 同步编辑器草稿只用于阻止宿主既有保存把旧值写回；不派发事件。
  syncCharacterEditorDraft(next);
}

function preserved(reason: string): GreetingRefreshResult {
  return { status: 'preserved', reason };
}

function stripEraManagedGreetingSuffix(value: string): string {
  const suffixes = [
    /\s*<StatusPlaceHolderImpl\s*\/>\s*$/i,
    /\s*<era_data(?:\s[^>]*)?>[\s\S]*?<\/era_data>\s*$/i,
  ] as const;
  let stripped = value;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      const next = stripped.replace(suffix, '');
      if (next !== stripped) {
        stripped = next;
        changed = true;
      }
    }
  }
  return stripped;
}

function selectGreetingRefreshTarget(expected: string, next: string): GreetingRefreshTarget {
  const tavern = currentTavernContext();
  if (tavern.groupId) {
    return { kind: 'result', result: { status: 'not-applicable', reason: '群聊不支持单角色主开场白刷新。' } };
  }
  if (!next.startsWith(expected)) {
    return { kind: 'result', result: preserved('更新后的主开场白不是原文追加，当前聊天未修改。') };
  }
  if (tavern.chatMetadata.tainted === true) {
    return { kind: 'result', result: preserved('当前聊天已被宿主标记为修改过。') };
  }
  if (tavern.chat.length > 1) return { kind: 'result', result: preserved('当前聊天已有多楼历史。') };
  if (tavern.chat.length === 0) return { kind: 'empty' };

  const message = tavern.chat[0];
  if (message.is_user || message.is_system) {
    return { kind: 'result', result: preserved('首楼不是角色主开场白。') };
  }
  if ((message.swipe_id ?? 0) !== 0) {
    return { kind: 'result', result: preserved('首楼当前显示的是备用开场白。') };
  }
  const primary = Array.isArray(message.swipes) ? message.swipes[0] : message.mes;
  if (stripEraManagedGreetingSuffix(primary) !== expected || stripEraManagedGreetingSuffix(message.mes) !== expected) {
    return { kind: 'result', result: preserved('首楼内容已不等于角色卡原主开场白。') };
  }
  return { kind: 'message', message, updated: next };
}

/**
 * 角色卡主开场白持久化和当前聊天是两份不同事实。只有当前聊天仍可证明是
 * 原主开场白时，才把本次初始化追加块带到首楼；已有历史、编辑内容和备用
 * 开场白都不能被角色卡更新反向覆盖。
 */
async function refreshPristineMainGreeting(expected: string, next: string): Promise<GreetingRefreshResult> {
  const tavern = currentTavernContext();
  const target = selectGreetingRefreshTarget(expected, next);
  if (target.kind === 'result') return target.result;
  if (target.kind === 'empty') {
    const message = {
      name: tavern.name2,
      is_user: false,
      is_system: false,
      mes: next,
      extra: {},
    } satisfies SillyTavern.ChatMessage;
    tavern.chat.push(message);
  } else {
    target.message.mes = target.updated;
    if (Array.isArray(target.message.swipes)) target.message.swipes[0] = target.updated;
  }

  const messageId = 0;
  await tavern.eventSource.emit(tavern.eventTypes.MESSAGE_RECEIVED, messageId, 'first_message');
  await tavern.clearChat();
  await tavern.printMessages();
  await tavern.eventSource.emit(tavern.eventTypes.CHARACTER_MESSAGE_RENDERED, messageId, 'first_message');
  await tavern.saveChat();
  return { status: 'refreshed', reason: '纯净主开场白已同步到当前首楼并完成重绘。' };
}

/**
 * 主开场白 I/O 必须与大型 Tavern 事件适配器分离，否则初始化资源能力会继续抬高
 * 核心接线文件复杂度，并诱使后续功能在同一适配器中堆积角色卡字段选择规则。
 */
export function createCharacterGreetingAdapter(throwIfAborted: ThrowIfAborted): EraTavernAdapter['character'] {
  return {
    /** 只投影主开场白，避免备用开场白和角色卡其他字段意外进入工作流。 */
    read_main_greeting: async (
      _input: Readonly<Record<string, unknown>>,
      context: EraCapabilityContext,
    ): Promise<unknown> => {
      throwIfAborted(context.signal);
      const characterName = getCurrentCharacterName();
      if (SillyTavern.groupId || !characterName) return { status: 'missing', firstMessage: null };
      const character = await getCharacter(characterName);
      throwIfAborted(context.signal);
      const tavern = currentTavernContext();
      const current = tavern.characters[Number(tavern.characterId)];
      return {
        status: 'ready',
        characterId: current.avatar,
        externalStatusbar:
          (current.data?.extensions as unknown as Record<string, unknown>)?.era_external_statusbar ?? null,
        firstMessage: typeof character.first_messages[0] === 'string' ? character.first_messages[0] : '',
      };
    },
    /** 写入前乐观核对旧值；更新角色卡后，仅允许纯净主开场白即时同步到当前首楼。 */
    write_main_greeting: async (
      input: Readonly<Record<string, unknown>>,
      context: EraCapabilityContext,
    ): Promise<unknown> => {
      throwIfAborted(context.signal);
      if (typeof input.expected !== 'string' || typeof input.next !== 'string') {
        throw new TypeError('主开场白写入请求缺少 expected 或 next。');
      }
      const expected = input.expected;
      const next = input.next;
      const characterName = getCurrentCharacterName();
      if (SillyTavern.groupId || !characterName) {
        throw new Error('ERA_CHARACTER_GREETING_MISSING: 当前未打开可写入的单角色角色卡。');
      }
      const character = await getCharacter(characterName);
      const observed = typeof character.first_messages[0] === 'string' ? character.first_messages[0] : '';
      if (observed !== expected) throw new Error('ERA_CHARACTER_GREETING_STALE: 主开场白已在初始化期间改变。');
      await persistCurrentMainGreeting(next);
      throwIfAborted(context.signal);
      const chatRefresh = await refreshPristineMainGreeting(expected, next);
      throwIfAborted(context.signal);
      return {
        status: 'updated',
        firstMessage: next,
        chatRefresh,
      };
    },
  };
}
