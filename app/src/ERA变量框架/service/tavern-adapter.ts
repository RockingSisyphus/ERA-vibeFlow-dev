/*
 * 模块职责：作为 Tavern Helper 与 VibeFlow Host Extension 的唯一生产接线层，
 * 只登记一套事件监听、转交回执和执行声明式 Capability。模块边界：
 * 不得实现领域路由、合并、CRUD、同步、回滚或资源选择，这些规则依赖 AOT workflow。
 */

import { INPUT_EVENT, LISTENED_EVENT_TYPES, getEventDefinition, shouldCloseCollectionWindow } from '../events/catalog';
import { Logger } from '../utils/log';
import { createSidecarAdapter } from './sidecar-adapter';
import type {
  EraAdmissionResult,
  EraCapabilityContext,
  EraEventSource,
  EraInboundEvent,
  EraPreparedNotification,
  EraStartupGateDecision,
  EraTavernAdapter,
  EraWaitThroughResult,
} from './types';
import { readInstallationScopeFacts } from './installation-scope';
import { projectMessage } from './message-projection';

const logger = new Logger();

type VariableScope =
  | { readonly type: 'chat' }
  | { readonly type: 'script'; readonly script_id?: string }
  | { readonly type: 'message'; readonly message_id?: number | 'latest' };

type RegisteredListener = {
  readonly eventType: string;
  readonly handler: (...args: unknown[]) => void | Promise<void>;
};

const BUTTON_INPUT_EVENTS = new Set<string>([
  INPUT_EVENT.MANUAL_WRITE,
  INPUT_EVENT.MANUAL_SYNC,
  INPUT_EVENT.MANUAL_FULL_SYNC,
]);

const BUTTON_EVENTS: ReadonlyArray<readonly [string, string]> = [
  ['写入变量修改', INPUT_EVENT.MANUAL_WRITE],
  ['手动同步状态', INPUT_EVENT.MANUAL_SYNC],
  ['强制完全重算', INPUT_EVENT.MANUAL_FULL_SYNC],
];

/** 22 个目录事件 + 3 个真实脚本按钮，生产页面只允许这一套监听。 */
export const ERA_TAVERN_LISTENER_COUNT = 25;

export interface EraTavernAdapterOptions {
  readonly onScriptVariablesCommitted?: () => void;
  readonly onBarrierFailure?: (result: EraWaitThroughResult) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clonePortable<T>(value: T): T {
  return structuredClone(value);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException('ERA 宿主操作已取消。', 'AbortError');
}

function variableScope(value: unknown): VariableScope {
  if (!isRecord(value) || typeof value.type !== 'string') return { type: 'chat' };
  if (value.type === 'chat') return { type: 'chat' };
  if (value.type === 'script') {
    return typeof value.script_id === 'string' ? { type: 'script', script_id: value.script_id } : { type: 'script' };
  }
  if (value.type === 'message') {
    const messageId = value.message_id;
    return typeof messageId === 'number' || messageId === 'latest'
      ? { type: 'message', message_id: messageId }
      : { type: 'message' };
  }
  throw new TypeError(`ERA 不允许的变量作用域：${value.type}`);
}

function eventSource(eventType: string): Exclude<EraEventSource, 'timer'> {
  if (eventType.startsWith('era:')) return 'era-api';
  if (
    eventType === INPUT_EVENT.MANUAL_WRITE ||
    eventType === INPUT_EVENT.MANUAL_SYNC ||
    eventType === INPUT_EVENT.MANUAL_FULL_SYNC
  )
    return 'ui';
  return 'tavern';
}

function reportBarrierFailure(result: EraWaitThroughResult): void {
  if (!result.hasFailures) return;
  logger.error('generationBarrier', '生成前 ERA 状态任务执行失败，按兼容的 fail-open 策略放行。', result);
  try {
    toastr.error('ERA 生成前状态同步失败，本次请求可能读到旧变量；请查看 Console。', 'ERA 生成栅栏');
  } catch (error) {
    console.error('ERA 生成栅栏错误提示失败。', error);
  }
}

function messageId(input: Readonly<Record<string, unknown>>): number {
  const value = input.messageId ?? input.message_id;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('消息更新请求缺少非负整数 messageId。');
  }
  return value;
}

/** 按钮由独立 Tavern button 事件接入，目录监听不得重复登记。 */
function isNonButtonInputEvent(value: string): boolean {
  return !BUTTON_INPUT_EVENTS.has(value);
}

/**
 * 只负责 Tavern Helper 与 Host Extension 的接线。所有选择、合并、
 * CRUD、同步与资源判断都由 workflow 预先生成明确请求。
 */
export class TavernEraServiceAdapter implements EraTavernAdapter {
  private listener: ((event: EraInboundEvent) => EraAdmissionResult) | null = null;
  private accepting = true;
  private startupGate: Promise<EraStartupGateDecision>;
  private resolveStartupGate: ((decision: EraStartupGateDecision) => void) | null = null;

  constructor(private readonly options: EraTavernAdapterOptions = {}) {
    this.startupGate = new Promise<EraStartupGateDecision>(resolve => {
      this.resolveStartupGate = resolve;
    });
  }

  waitForStartupGate(): Promise<EraStartupGateDecision> {
    return this.startupGate;
  }

  settleStartupGate(decision: EraStartupGateDecision): void {
    const resolve = this.resolveStartupGate;
    if (!resolve) return;
    this.resolveStartupGate = null;
    resolve(Object.freeze({ ...decision }));
  }

  /**
   * 一次性登记 25 个生产监听器。重复订阅必须失败，否则同一 Tavern 事件
   * 会产生两个 receipt，并破坏 FIFO 与 high-water barrier。
   */
  subscribe(listener: (event: EraInboundEvent) => EraAdmissionResult): () => void {
    if (this.listener) throw new Error('ERA 服务适配器不允许重复注册。');
    this.listener = listener;
    this.accepting = true;
    const registrations: RegisteredListener[] = [];

    const registeredTypes = new Set<string>();
    /** 统一记录卸载句柄，并在登记失败时按原顺序完整回收。 */
    const register = (
      eventType: string,
      handler: RegisteredListener['handler'],
      order: 'first' | 'normal' | 'last',
    ) => {
      if (registeredTypes.has(eventType)) throw new Error(`ERA 生产监听事件重复：${eventType}`);
      registeredTypes.add(eventType);
      registrations.push({ eventType, handler });
      if (order === 'first') eventMakeFirst(eventType, handler);
      else if (order === 'last') eventMakeLast(eventType, handler);
      else eventOn(eventType, handler);
    };

    try {
      for (const type of LISTENED_EVENT_TYPES.filter(isNonButtonInputEvent)) {
        const definition = getEventDefinition(type);
        /** 只有 generation barrier 事件返回 Promise，普通通知保持 Tavern 原时序。 */
        const handler = (...args: unknown[]): void | Promise<void> => {
          const result = this.enqueue(type, eventSource(type), args);
          if (
            !result.accepted ||
            definition?.awaitMode !== 'generation-barrier' ||
            !shouldCloseCollectionWindow(type, args)
          )
            return undefined;
          return result
            .waitThrough()
            .then(barrier => {
              (this.options.onBarrierFailure ?? reportBarrierFailure)(barrier);
            })
            .catch(error => {
              logger.error('generationBarrier', '生成栅栏回执异常，按 fail-open 策略放行。', error);
            });
        };
        register(type, handler, definition?.listenerOrder ?? 'normal');
      }

      for (const [buttonName, type] of BUTTON_EVENTS) {
        const eventType = getButtonEvent(buttonName);
        /** 按钮只负责入队，结果统一由 receipt 和 UI 呈现。 */
        const handleButton = () => {
          this.enqueue(type, 'ui', []);
        };
        register(eventType, handleButton, 'normal');
      }

      if (registrations.length !== ERA_TAVERN_LISTENER_COUNT) {
        throw new Error(`ERA 生产监听数量应为 ${ERA_TAVERN_LISTENER_COUNT}，实际为 ${registrations.length}。`);
      }
    } catch (error) {
      for (const registration of registrations) {
        eventRemoveListener(registration.eventType, registration.handler);
      }
      this.listener = null;
      this.accepting = false;
      throw error;
    }

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      this.accepting = false;
      for (const registration of registrations) {
        eventRemoveListener(registration.eventType, registration.handler);
      }
      if (this.listener === listener) this.listener = null;
    };
  }

  enqueue(type: string, source: Exclude<EraEventSource, 'timer'>, args: readonly unknown[] = []): EraAdmissionResult {
    if (!this.accepting || !this.listener) {
      return Object.freeze({
        accepted: false,
        code: 'ERA_APP_SERVICE_UNAVAILABLE',
        message: 'ERA 服务未启动或正在停止。',
      });
    }
    return this.listener({ type, source, args, occurredAt: Date.now() });
  }

  stopAccepting(): void {
    this.accepting = false;
  }

  async notify(notification: EraPreparedNotification, context: EraCapabilityContext): Promise<void> {
    throwIfAborted(context.signal);
    await eventEmit(notification.type, ...notification.args);
    throwIfAborted(context.signal);
  }

  readonly variables = {
    /** 读取时克隆宿主值，避免工作流持有 Tavern 的可变对象引用。 */
    read: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      const scope = variableScope(input.scope);
      const variables = clonePortable(getVariables(scope));
      throwIfAborted(context.signal);
      return { scope, variables };
    },
    /**
     * 只应用工作流明确声明的整对象或 stat/meta 变更；返回回读值供事务节点
     * 严格核对，不能在 adapter 内补做领域合并。
     */
    commit: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      const scope = variableScope(input.scope);
      const explicitVariables = isRecord(input.variables) ? clonePortable(input.variables) : null;
      const changes: Record<string, unknown> = isRecord(input.changes) ? clonePortable(input.changes) : {};
      if (Object.prototype.hasOwnProperty.call(input, 'stat')) changes.stat_data = clonePortable(input.stat);
      if (Object.prototype.hasOwnProperty.call(input, 'meta')) changes.ERAMetaData = clonePortable(input.meta);

      if (explicitVariables) {
        replaceVariables(explicitVariables, scope);
      } else {
        updateVariablesWith(current => Object.assign(current, changes), scope);
      }
      const observed = clonePortable(getVariables(scope));
      throwIfAborted(context.signal);
      if (scope.type === 'script') this.options.onScriptVariablesCommitted?.();
      return { status: 'committed', scope, variables: observed };
    },
  };

  readonly messages = {
    /** 只返回 ERA 严格投影，任何 Tavern 宿主对象都不得跨入工作流。 */
    read_context: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      if (input.projection !== 'era-active-message-v1') {
        throw new TypeError('消息读取请求必须指定 projection=era-active-message-v1。');
      }
      const range =
        typeof input.range === 'string' || typeof input.range === 'number' ? input.range : '0-{{lastMessageId}}';
      const rawMessages = getChatMessages(range, { include_swipes: true });
      if (!Array.isArray(rawMessages)) throw new TypeError('ERA 消息投影失败：Tavern 返回值不是数组。');
      const messages = rawMessages.map(projectMessage);
      throwIfAborted(context.signal);
      return { schemaVersion: 2, messages };
    },
    /**
     * 仅更新工作流指定的文本或消息字段；附件与未知字段必须由 Tavern
     * 原对象保留，避免 API 写入破坏多模态内容。
     */
    update_content: async (
      input: Readonly<Record<string, unknown>>,
      context: EraCapabilityContext,
    ): Promise<unknown> => {
      throwIfAborted(context.signal);
      const updates = Array.isArray(input.updates)
        ? clonePortable(input.updates)
        : isRecord(input.update)
          ? [clonePortable(input.update)]
          : null;
      const refresh = input.refresh === 'affected' || input.refresh === 'all' ? input.refresh : 'none';
      if (updates) {
        await setChatMessages(updates as Array<{ message_id: number }>, { refresh });
      } else {
        const id = messageId(input);
        const content = input.content;
        if (typeof content !== 'string') throw new TypeError('消息更新请求缺少文本 content。');
        const current = getChatMessages(id, { include_swipes: true })[0];
        if (!current) throw new Error(`找不到消息 #${id}。`);
        if (Array.isArray(current.swipes)) {
          const swipes = [...current.swipes];
          swipes[Number(current.swipe_id ?? 0)] = content;
          await setChatMessages([{ message_id: id, swipes }], { refresh });
        } else {
          await setChatMessages([{ message_id: id, message: content }], { refresh });
        }
      }
      throwIfAborted(context.signal);
      return { status: 'committed' };
    },
    refresh: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      if (input.mode === 'all') await SillyTavern.reloadCurrentChat();
      else await refreshOneMessage(messageId(input));
      throwIfAborted(context.signal);
      return { status: 'completed' };
    },
  };

  readonly worldbook = {
    /** 为了避免误覆盖，必须同时读取名称、绑定和条目，供工作流判断冲突与幂等追加。 */
    read: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      const names = clonePortable(getWorldbookNames());
      const bindings = clonePortable(getCharWorldbookNames('current'));
      const requestedName = typeof input.name === 'string' ? input.name : bindings.primary;
      const entries = requestedName ? clonePortable(await getWorldbook(requestedName)) : [];
      throwIfAborted(context.signal);
      return { names, bindings, requestedName, entries };
    },
    /** 创建操作不覆盖同名世界书，并把 exists 作为明确确认状态返回。 */
    create: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      if (typeof input.name !== 'string' || input.name.length === 0) throw new TypeError('世界书创建请求缺少 name。');
      const created = await createWorldbook(input.name);
      throwIfAborted(context.signal);
      return { status: created ? 'created' : 'exists', name: input.name };
    },
    /** 绑定时保留 Tavern 当前附加世界书，仅替换工作流指定的主世界书。 */
    bind: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      if (typeof input.name !== 'string' || input.name.length === 0) throw new TypeError('世界书绑定请求缺少 name。');
      const bindings = getCharWorldbookNames('current');
      await rebindCharWorldbooks('current', { ...bindings, primary: input.name });
      throwIfAborted(context.signal);
      return { status: 'bound', name: input.name };
    },
    /**
     * 工作流必须先合并并保留既有条目；adapter 只执行最终 replace，
     * 否则无法判断同名冲突是否允许覆盖。
     */
    replace_entries: async (
      input: Readonly<Record<string, unknown>>,
      context: EraCapabilityContext,
    ): Promise<unknown> => {
      throwIfAborted(context.signal);
      if (typeof input.name !== 'string' || !Array.isArray(input.entries)) {
        throw new TypeError('世界书写入请求缺少 name 或 entries。');
      }
      await replaceWorldbook(input.name, clonePortable(input.entries) as WorldbookEntry[]);
      throwIfAborted(context.signal);
      return { status: 'committed', name: input.name, count: input.entries.length };
    },
  };

  readonly regex = {
    /** 读取角色局部正则开关与完整列表，选择规则留给纯规划器。 */
    read: async (_input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      const enabled = isCharacterTavernRegexesEnabled();
      const regexes = enabled ? clonePortable(getTavernRegexes({ type: 'character' })) : [];
      return { enabled, regexes };
    },
    /** 仅追加纯规划器判定缺失的正则，不在宿主边界重复比较名称。 */
    upsert: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      const regex = input.regex;
      if (!isRecord(regex)) throw new TypeError('正则写入请求缺少 regex。');
      const updated = await updateTavernRegexesWith(current => [...current, clonePortable(regex) as TavernRegex], {
        type: 'character',
      });
      throwIfAborted(context.signal);
      return { status: 'committed', count: updated.length };
    },
  };

  readonly identity = {
    /** 为了让工作流统一处理单角色、群聊和无角色场景，必须一次返回完整宿主身份快照。 */
    read: (_input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown => {
      throwIfAborted(context.signal);
      return clonePortable({
        characterName: getCurrentCharacterName(),
        // characterId 必须使用 Tavern Helper 的稳定角色卡头像 ID；SillyTavern
        // 导出的当前索引会随切卡/聊天切换变化，不能作为 Sidecar 绑定主键。
        characterId: getCurrentCharacterId(),
        groupId: SillyTavern.groupId || null,
        isGroup: Boolean(SillyTavern.groupId),
        chatId: SillyTavern.getCurrentChatId(),
        scriptId: getScriptId(),
      });
    },
  };

  /** 启动期 raw DTO：脚本树读取只在 workflow 审核的 capability 内发生。 */
  readonly installation_scope = {
    read: (_input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown => {
      throwIfAborted(context.signal);
      return readInstallationScopeFacts();
    },
  };

  /** Sidecar 的文件/身份/UI 机械接线；所有绑定决策由 workflow 完成。 */
  readonly sidecar = createSidecarAdapter();
}
