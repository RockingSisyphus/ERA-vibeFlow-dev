/*
 * 模块职责：作为 Tavern Helper 与 VibeFlow Host Extension 的唯一生产接线层，
 * 只登记一套事件监听、转交回执和执行声明式 Capability。模块边界：
 * 不得实现领域路由、合并、CRUD、同步、回滚或资源选择，这些规则依赖 AOT workflow。
 */
import {
  generationHandoffs,
  dispatchGenerationHandoff,
  generationAdmission,
  cancelGenerationWaitForEvent,
} from './generation-handoff-host';

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
import { currentEraMessageText, updateEraMessageContent } from './message-writer';
import { assertCurrentMessageBasis } from './message-write-target';
import { prepareMessagePersistence } from './message-persistence';
import { readInstallationScopeFacts } from './installation-scope';
import { projectMessage } from './message-projection';
import { AgentTavernHost } from './agent-tavern-host';
import { TavernListeners } from './tavern-listeners';
import { observeAgentReceipt } from './agent-session-observation';
import {
  currentTavernContext,
  currentCharacterRegexEnabled,
  enableCurrentCharacterRegexes,
  requireMessageId,
  withoutButtonInputEvents,
} from './tavern-browser-host';
import { refreshDisplayedEraTechnicalBlocks, registerEraTechnicalBlockProjection } from './technical-block-projection';
import { createCharacterAdapter } from './character-adapter';
import { verifyEraStatusbarCommitSource } from './statusbar-runtime';

const logger = new Logger();

type VariableScope =
  | { readonly type: 'chat' }
  | { readonly type: 'script'; readonly script_id?: string }
  | { readonly type: 'message'; readonly message_id?: number | 'latest' };

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

/** 9 个 Tavern 生命周期/业务事件与 3 个角色脚本按钮；公共 API 不再注册事件监听。 */
export const ERA_TAVERN_LISTENER_COUNT = 13;

const WINDOW_LIFECYCLE_EVENTS = new Set<string>([
  INPUT_EVENT.MESSAGE_RECEIVED,
  INPUT_EVENT.MESSAGE_EDITED,
  INPUT_EVENT.MESSAGE_DELETED,
  INPUT_EVENT.MESSAGE_UPDATED,
  INPUT_EVENT.MESSAGE_SWIPED,
  INPUT_EVENT.CHAT_CHANGED,
]);

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

function toRegexScriptData(regex: TavernRegex): Readonly<Record<string, unknown>> {
  const source = regex.source ?? {
    user_input: false,
    ai_output: false,
    slash_command: false,
    world_info: false,
    reasoning: false,
  };
  const destination = regex.destination ?? { display: false, prompt: false };
  return {
    id: regex.id,
    scriptName: regex.script_name,
    disabled: !regex.enabled,
    runOnEdit: regex.run_on_edit,
    findRegex: regex.find_regex,
    trimStrings: regex.trim_strings ?? [],
    replaceString: regex.replace_string,
    placement: [
      ...(source.user_input ? [1] : []),
      ...(source.ai_output ? [2] : []),
      ...(source.slash_command ? [3] : []),
      ...(source.world_info ? [5] : []),
      ...(source.reasoning ? [6] : []),
    ],
    substituteRegex: 0,
    minDepth: regex.min_depth,
    maxDepth: regex.max_depth,
    markdownOnly: destination.display,
    promptOnly: destination.prompt,
  };
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
  const agentPlanningBlocked = result.outcomes.some(({ outcome }) => {
    if (outcome.status !== 'failed' || !isRecord(outcome.error)) return false;
    return outcome.error.code === 'ERA_AGENT_PLANNING_EXHAUSTED';
  });
  if (agentPlanningBlocked) {
    logger.warn('generationBarrier', 'Agent 规划尝试耗尽，原生故事生成已按会话合同阻断。', result);
    return;
  }
  logger.error('generationBarrier', '生成前 ERA 状态任务执行失败，按兼容的 fail-open 策略放行。', result);
  try {
    toastr.error('ERA 生成前状态同步失败，本次请求可能读到旧变量；请查看 Console。', 'ERA 生成栅栏');
  } catch (error) {
    console.error('ERA 生成栅栏错误提示失败。', error);
  }
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
  private lifecycleToken = 1;
  private readonly internalMessageWrites = new Map<number, string>();
  private readonly agentHost: AgentTavernHost;
  readonly agent: EraTavernAdapter['agent'];

  constructor(private readonly options: EraTavernAdapterOptions = {}) {
    this.startupGate = new Promise<EraStartupGateDecision>(resolve => {
      this.resolveStartupGate = resolve;
    });
    this.agentHost = new AgentTavernHost({
      internalMessageWrites: this.internalMessageWrites,
      readIdentity: (input, context) => this.identity.read(input, context),
    });
    this.agent = this.agentHost.operations;
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

  currentLifecycleToken(): number {
    return this.lifecycleToken;
  }

  private rotateLifecycleWindow(): void {
    if (this.lifecycleToken >= Number.MAX_SAFE_INTEGER) this.lifecycleToken = 1;
    else this.lifecycleToken += 1;
  }

  /** ERA 自己的 MK/API/压缩写回不能制造新业务窗口，也不能重新入队同步。 */
  private consumeInternalMessageUpdate(eventType: string, args: readonly unknown[]): boolean {
    if (eventType !== INPUT_EVENT.MESSAGE_UPDATED) return false;
    const rawId = args[0];
    if (!Number.isSafeInteger(rawId) || Number(rawId) < 0) return false;
    const id = Number(rawId);
    const expected = this.internalMessageWrites.get(id);
    if (expected === undefined) return false;
    if (currentEraMessageText(id) !== expected) {
      this.internalMessageWrites.delete(id);
      return false;
    }
    this.internalMessageWrites.delete(id);
    return true;
  }

  /**
   * 一次性登记 12 个生产监听器。重复订阅必须失败，否则同一 Tavern 事件
   * 会产生两个 receipt，并破坏 FIFO 与 high-water barrier。
   */
  subscribe(listener: (event: EraInboundEvent) => EraAdmissionResult): () => void {
    if (this.listener) throw new Error('ERA 服务适配器不允许重复注册。');
    this.listener = listener;
    this.accepting = true;
    const registrations = new TavernListeners();
    let stopTechnicalProjection: (() => void) | undefined;
    let stopNativeCompletion: (() => void) | undefined;
    /** 登记失败和正常卸载必须使用相同的释放顺序，避免遗留收尾等待。 */
    const releaseListeners = () => {
      stopNativeCompletion?.();
      stopTechnicalProjection?.();
      registrations.release();
    };

    try {
      stopTechnicalProjection = registerEraTechnicalBlockProjection();
      stopNativeCompletion = this.agentHost.nativeGeneration.observe();
      for (const type of withoutButtonInputEvents(LISTENED_EVENT_TYPES, BUTTON_INPUT_EVENTS)) {
        const definition = getEventDefinition(type);
        /** 只有 generation barrier 事件返回 Promise，普通通知保持 Tavern 原时序。 */
        const handler = (...args: unknown[]): void | Promise<void> => {
          if (type === INPUT_EVENT.GENERATION_STARTED && this.agentHost.isAuxiliaryGenerationActive()) return undefined;
          cancelGenerationWaitForEvent(type, args);
          if (type === INPUT_EVENT.GENERATION_STARTED && args[2] !== true) this.agentHost.nativeGeneration.start();
          if (this.consumeInternalMessageUpdate(type, args)) return undefined;
          if (type === INPUT_EVENT.GENERATION_STOPPED) this.agentHost.nativeGeneration.clear('stopped');
          if (type === INPUT_EVENT.CHAT_CHANGED) this.agentHost.clearSessions();
          if (WINDOW_LIFECYCLE_EVENTS.has(type)) this.rotateLifecycleWindow();
          const result = this.enqueue(type, eventSource(type), args);
          if (
            !result.accepted ||
            definition?.awaitMode !== 'generation-barrier' ||
            !shouldCloseCollectionWindow(type, args)
          )
            return undefined;
          return result
            .waitThrough()
            .then(async barrier => {
              (this.options.onBarrierFailure ?? reportBarrierFailure)(barrier);
              await generationHandoffs.waitCurrent();
            })
            .catch(error => {
              logger.error('generationBarrier', '生成栅栏回执异常，按 fail-open 策略放行。', error);
            });
        };
        registrations.register(type, handler, definition?.listenerOrder ?? 'normal');
      }

      for (const [buttonName, type] of BUTTON_EVENTS) {
        const eventType = getButtonEvent(buttonName);
        /** 按钮只负责入队，结果统一由 receipt 和 UI 呈现。 */
        const handleButton = () => {
          this.enqueue(type, 'ui', []);
        };
        registrations.register(eventType, handleButton, 'normal');
      }

      if (registrations.count !== ERA_TAVERN_LISTENER_COUNT) {
        throw new Error(`ERA 生产监听数量应为 ${ERA_TAVERN_LISTENER_COUNT}，实际为 ${registrations.count}。`);
      }
    } catch (error) {
      releaseListeners();
      this.listener = null;
      this.accepting = false;
      throw error;
    }

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      this.accepting = false;
      this.agentHost.stop();
      releaseListeners();
      if (this.listener === listener) this.listener = null;
    };
  }

  /** 统一送入 FIFO；为了避免显示层改变生成时序，报告观察必须旁路且不改写正式回执。 */
  enqueue(type: string, source: Exclude<EraEventSource, 'timer'>, args: readonly unknown[] = []): EraAdmissionResult {
    if (!this.accepting || !this.listener) {
      return Object.freeze({
        accepted: false,
        code: 'ERA_APP_SERVICE_UNAVAILABLE',
        message: 'ERA 服务未启动或正在停止。',
      });
    }
    const admission = this.listener({ type, source, args, occurredAt: Date.now() });
    if (admission.accepted) {
      // 被动旁路，不 await、不改写正式回执；没有明确事件绑定的请求不会被关联。
      observeAgentReceipt(admission.done, this.agentHost.readSessionForViewer.bind(this.agentHost));
    }
    return generationAdmission(type, admission);
  }

  stopAccepting(): void {
    this.accepting = false;
    this.internalMessageWrites.clear();
    this.agentHost.stop();
  }

  /** 后置通知在 FIFO 片段结束后执行，因此订阅回调可以提交新的正常任务。 */
  async notify(notification: EraPreparedNotification, context: EraCapabilityContext): Promise<void> {
    throwIfAborted(context.signal);
    if (notification.type === 'era.agent.stage_completed')
      return dispatchGenerationHandoff(notification, context.signal, this.enqueue.bind(this));
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
      const range = typeof input.range === 'string' || typeof input.range === 'number' ? input.range : '0--1';
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
      const confirmPersistence = prepareMessagePersistence(input, context.signal);
      const affectedMessageIds = await updateEraMessageContent(input, this.internalMessageWrites);
      const persistence = await confirmPersistence();
      if (persistence.status !== 'committed') return persistence;
      if (input.projectTechnicalBlocks !== false) refreshDisplayedEraTechnicalBlocks(affectedMessageIds);
      throwIfAborted(context.signal);
      return { status: 'committed' };
    },
    refresh: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      if (input.sourceBasis !== undefined) assertCurrentMessageBasis(input.sourceBasis);
      if (input.mode === 'all') await SillyTavern.reloadCurrentChat();
      else await refreshOneMessage(requireMessageId(input));
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
    /** 绑定时必须保留 Tavern 当前附加世界书，否则快速初始化会覆盖作者已有资源。 */
    bind: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      if (typeof input.name !== 'string' || input.name.length === 0) throw new TypeError('世界书绑定请求缺少 name。');
      const tavern = currentTavernContext();
      const characterId = Number(tavern.characterId);
      if (!Number.isSafeInteger(characterId) || characterId < 0) {
        throw new TypeError('当前聊天没有可写入世界书绑定的角色索引。');
      }
      // Tavern Helper 的 rebindCharWorldbooks 最后会无条件排队
      // saveCharacterDebounced。该延迟保存会在初始化事务写完主开场白后再次
      // 保存并重绘角色，从而把仅有一楼、尚未污染的当前聊天替换成新开场白。
      // 主世界书绑定本质上就是角色扩展字段 `world`；通过 SillyTavern 的
      // 原生字段接口原子写入，可保留角色卡导出语义，同时不产生第二次角色保存。
      await tavern.writeExtensionField(characterId, 'world', input.name);
      const topDocument = window.top?.document;
      const field = topDocument?.querySelector<HTMLSelectElement | HTMLInputElement>('#character_world');
      if (field) field.value = input.name;
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
      const enabled = currentCharacterRegexEnabled();
      const regexes = clonePortable(getTavernRegexes({ type: 'character' }));
      return { enabled, regexes };
    },
    /**
     * 仅追加纯规划器判定缺失的正则；否则宿主层再次按名称判断会让规划结果与实际写入分叉。
     */
    upsert: async (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> => {
      throwIfAborted(context.signal);
      const regex = input.regex;
      if (!isRecord(regex)) throw new TypeError('正则写入请求缺少 regex。');
      const updated = [...getTavernRegexes({ type: 'character' }), clonePortable(regex) as TavernRegex];
      const tavern = currentTavernContext();
      const characterId = Number(tavern.characterId);
      if (!Number.isSafeInteger(characterId) || characterId < 0) {
        throw new TypeError('当前聊天没有可写入局部正则的角色索引。');
      }
      // Tavern Helper 的 updateTavernRegexesWith 会把 saveSettings/聊天重绘延迟
      // 1 秒执行，随后可能用旧角色快照覆盖紧接着写入的主开场白。这里使用
      // 酒馆同一底层字段接口，并显式等待聊天 reload，形成真实的顺序提交点。
      await tavern.writeExtensionField(characterId, 'regex_scripts', updated.map(toRegexScriptData));
      await enableCurrentCharacterRegexes();
      await tavern.reloadCurrentChat();
      throwIfAborted(context.signal);
      return { status: 'committed', count: updated.length, enabled: true };
    },
  };

  readonly character = createCharacterAdapter(throwIfAborted);

  readonly identity = {
    /** 为了让工作流统一处理单角色、群聊和无角色场景，必须一次返回完整宿主身份快照。 */
    read: (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown => {
      throwIfAborted(context.signal);
      const identity: Record<string, unknown> = {
        characterName: getCurrentCharacterName(),
        // characterId 必须使用 Tavern Helper 的稳定角色卡头像 ID；SillyTavern
        // 导出的当前索引会随切卡/聊天切换变化，不能作为 Sidecar 绑定主键。
        characterId: getCurrentCharacterId(),
        groupId: SillyTavern.groupId || null,
        isGroup: Boolean(SillyTavern.groupId),
        chatId: SillyTavern.getCurrentChatId(),
        scriptId: getScriptId(),
        lifecycleToken: this.lifecycleToken,
      };
      if (Object.prototype.hasOwnProperty.call(input, 'sourceContext')) {
        identity.statusbarSource = verifyEraStatusbarCommitSource(input.sourceContext);
      }
      return clonePortable(identity);
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
