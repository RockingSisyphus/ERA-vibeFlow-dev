/*
 * 模块职责：实现 AgentGenerationSession 已声明的 Tavern 宿主能力，
 * 包括角色卡配置、独立模型请求、一次性正文注入与错误消息创建。
 * 本模块不判断阶段是否开启、重试次数或变量操作是否合法；
 * 这些决策只属于 AOT Service workflow。
 */

import { readActiveSidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';
import { currentTavernContext, stopNativeTavernGeneration } from './tavern-browser-host';
import type { EraCapabilityContext, EraTavernAdapter } from './types';
import {
  capturePreset,
  clonePortable,
  currentAgentConfiguration,
  currentCharacterIndex,
  isRecord,
  readConnectionSummaries,
} from './agent-tavern-configuration';
import { createAgentConnectionOperations } from './agent-tavern-connections';
import { auxiliaryApiSettings, resolveAuxiliaryRoute } from './agent-tavern-generation';

type AgentOperations = EraTavernAdapter['agent'];

export interface AgentTavernHostPorts {
  readonly internalMessageWrites: Map<number, string>;
  readonly readIdentity: (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext) => unknown;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException('ERA 宿主操作已取消。', 'AbortError');
  }
}

/**
 * Capability runtime 会刻意隐藏宿主异常文本，因此可重试的辅助请求失败必须作为
 * 普通 JSON 结果返回。这里只公开 ERA 自己定义的错误码和有界消息；未知异常统一
 * 收敛为通用诊断，避免把供应商响应、请求头或密钥带进消息报告。
 */
function auxiliaryFailureResult(error: unknown): Readonly<Record<string, unknown>> {
  const rawMessage = error instanceof Error ? error.message : '';
  const code = rawMessage.match(/\bERA_AGENT_[A-Z0-9_]+\b/)?.[0] ?? 'ERA_AGENT_AUXILIARY_REQUEST_FAILED';
  const message = rawMessage.includes(code)
    ? rawMessage.slice(0, 512)
    : 'ERA_AGENT_AUXILIARY_REQUEST_FAILED：辅助模型请求失败。';
  return {
    status: 'failed',
    diagnostic: { code, message },
  };
}

/** 持有页面实例级会话与辅助生成重入状态，不向 Sidecar 持久化。 */
export class AgentTavernHost {
  private readonly sessions = new Map<string, unknown>();
  private auxiliaryGenerationDepth = 0;
  private deferredNativeGenerationStop: EventOnReturn | null = null;

  readonly operations: AgentOperations;

  constructor(private readonly ports: AgentTavernHostPorts) {
    this.operations = this.createOperations();
  }

  isAuxiliaryGenerationActive(): boolean {
    return this.auxiliaryGenerationDepth > 0;
  }

  clearSessions(): void {
    this.sessions.clear();
  }

  stop(): void {
    this.clearSessions();
    this.clearDeferredNativeGenerationStop();
  }

  private clearDeferredNativeGenerationStop(): void {
    this.deferredNativeGenerationStop?.stop();
    this.deferredNativeGenerationStop = null;
  }

  /**
   * generation_started 时原生 AbortController 尚未建立，因此必须在请求前
   * 的下一栅栏再停止一次，否则规划失败仍可能泄漏一次正文请求。
   */
  private deferNativeGenerationStop(): void {
    this.clearDeferredNativeGenerationStop();
    this.deferredNativeGenerationStop = eventOnce(tavern_events.GENERATION_AFTER_COMMANDS, () => {
      this.deferredNativeGenerationStop = null;
      stopNativeTavernGeneration();
    });
  }

  private async withAuxiliaryGeneration<T>(run: () => Promise<T>): Promise<T> {
    // 计数而非布尔值是必要的：故事重试内部仍可能触发辅助生成事件。
    // finally 必须归还计数，否则一次异常会让后续原生故事永久被判定为重入。
    this.auxiliaryGenerationDepth += 1;
    try {
      return await run();
    } finally {
      this.auxiliaryGenerationDepth = Math.max(0, this.auxiliaryGenerationDepth - 1);
    }
  }

  /**
   * 组合四组互不拥有业务判断的宿主能力。拆组是为了让模型请求、会话内存和消息写回
   * 各自保持单一副作用边界，否则一个大对象会掩盖辅助生成的重入范围。
   */
  private createOperations(): AgentOperations {
    return {
      ...this.createContextOperations(),
      ...this.createGenerationOperations(),
      ...this.createSessionOperations(),
      ...this.createMessageOperations(),
    };
  }

  /** 读取角色卡、Sidecar 和当前会话事实；这些值必须一次克隆后再交给工作流。 */
  private createContextOperations(): Pick<
    AgentOperations,
    | 'read_context'
    | 'write_configuration'
    | 'capture_preset'
    | 'read_configuration_sources'
    | 'upsert_connection_profile'
    | 'delete_connection_profile'
    | 'clear_connection_profile_key'
    | 'list_connection_models'
    | 'list_connection_models_draft'
  > {
    return {
      read_context: async (_input, context) => {
        throwIfAborted(context.signal);
        const identity = this.ports.readIdentity({}, context) as Record<string, unknown>;
        const chatKey = typeof identity.chatId === 'string' ? identity.chatId : '';
        const snapshot = readActiveSidecarRuntimeSnapshot();
        throwIfAborted(context.signal);
        return clonePortable({
          identity,
          groupChat: typeof identity.groupId === 'string' && identity.groupId.length > 0,
          configuration: currentAgentConfiguration(),
          session: chatKey.length > 0 ? (this.sessions.get(chatKey) ?? null) : null,
          latestMessage: getChatMessages(-1, { include_swipes: false })[0] ?? null,
          messages: getChatMessages('0-{{lastMessageId}}', {
            include_swipes: false,
          }).slice(-64),
          state:
            snapshot === null
              ? null
              : {
                  revision: snapshot.revision,
                  statData: snapshot.statData,
                  statFunc: snapshot.statFunc,
                  eraMeta: snapshot.eraMeta,
                },
        });
      },
      ...this.createConfigurationOperations(),
      ...createAgentConnectionOperations(),
    };
  }

  /** 角色卡配置与预设快照必须共享当前角色边界，否则切卡时可能捕获错误预设。 */
  private createConfigurationOperations(): Pick<
    AgentOperations,
    'write_configuration' | 'capture_preset' | 'read_configuration_sources'
  > {
    return {
      write_configuration: async (input, context) => {
        throwIfAborted(context.signal);
        if (!isRecord(input.configuration)) {
          throw new TypeError('Agent 配置写入缺少 configuration。');
        }
        const configuration = clonePortable(input.configuration);
        const tavern = currentTavernContext();
        if (typeof tavern.groupId === 'string' && tavern.groupId.length > 0) {
          throw new TypeError('群聊不支持写入 ERA 多阶段生成配置。');
        }
        const characterIndex = currentCharacterIndex();
        if (characterIndex === null) {
          throw new TypeError('当前没有可写入 Agent 配置的角色卡。');
        }
        await currentTavernContext().writeExtensionField(characterIndex, 'era_agent', configuration);
        throwIfAborted(context.signal);
        return { status: 'committed', configuration };
      },
      capture_preset: (input, context) => {
        throwIfAborted(context.signal);
        return capturePreset(input);
      },
      read_configuration_sources: (_input, context) => {
        throwIfAborted(context.signal);
        return clonePortable({
          presetNames: getPresetNames(),
          currentPresetName: getLoadedPresetName(),
          connectionProfiles: readConnectionSummaries(),
        });
      },
    };
  }

  /**
   * 独立模型请求都进入同一个重入计数器；否则 generateRaw 自己发出的生成事件
   * 会被误认成新的故事会话，再次启动规划。
   */
  private createGenerationOperations(): Pick<AgentOperations, 'generate' | 'generate_story' | 'inject_once'> {
    return {
      generate: async (input, context) => {
        throwIfAborted(context.signal);
        if (typeof input.userInput !== 'string' || !Array.isArray(input.orderedPrompts)) {
          throw new TypeError('Agent 模型请求缺少 userInput 或 orderedPrompts。');
        }
        try {
          return await this.generateAuxiliaryJson(input, input.userInput, context);
        } catch (error) {
          if (context.signal.aborted) throw error;
          return auxiliaryFailureResult(error);
        }
      },
      generate_story: async (input, context) => {
        throwIfAborted(context.signal);
        return this.generateStoryRetry(input, context);
      },
      inject_once: (input, context) => {
        throwIfAborted(context.signal);
        if (typeof input.content !== 'string' || typeof input.id !== 'string') {
          throw new TypeError('Agent 一次性注入缺少 id 或 content。');
        }
        injectPrompts(
          [
            {
              id: input.id,
              position: 'in_chat',
              depth: 0,
              role: 'system',
              content: input.content,
              should_scan: false,
            },
          ],
          { once: true },
        );
        return { status: 'injected', id: input.id };
      },
    };
  }

  /** 执行一个规划或结算请求，并在响应终态后才释放辅助生成重入保护。 */
  private generateAuxiliaryJson(
    input: Readonly<Record<string, unknown>>,
    userInput: string,
    context: EraCapabilityContext,
  ): Promise<unknown> {
    /** 辅助请求必须包在计数器内，否则它发出的事件会重入主会话。 */
    const runAuxiliaryRequest = async (): Promise<unknown> => {
      const generationId =
        typeof input.generationId === 'string' && input.generationId.length > 0
          ? input.generationId
          : `era-agent-${Date.now()}`;
      const settings = isRecord(input.settings) ? input.settings : {};
      const route = resolveAuxiliaryRoute(input);
      let response: Awaited<ReturnType<typeof generateRaw>>;
      try {
        response = await generateRaw({
          generation_id: generationId,
          user_input: userInput,
          ordered_prompts: clonePortable(input.orderedPrompts) as GenerateRawConfig['ordered_prompts'],
          should_stream: false,
          should_silence: true,
          custom_api: auxiliaryApiSettings(route, settings),
        });
      } catch (error) {
        if (context.signal.aborted) throw error;
        throw new TypeError(
          route.profile
            ? `ERA_AGENT_AUXILIARY_REQUEST_FAILED：本机方案“${route.profile.name}”请求失败。`
            : 'ERA_AGENT_AUXILIARY_REQUEST_FAILED：酒馆当前连接请求失败。',
          { cause: error },
        );
      }
      throwIfAborted(context.signal);
      if (typeof response !== 'string') {
        throw new TypeError('Agent 独立阶段必须返回文本 JSON。');
      }
      return {
        generationId,
        response,
        route:
          route.profile === null
            ? { kind: 'tavern-current', ...(route.model ? { model: route.model } : {}) }
            : { kind: 'custom-profile', profileId: route.profile.id, model: route.model },
      };
    };
    return this.withAuxiliaryGeneration(runAuxiliaryRequest);
  }

  /** 故事重试必须使用酒馆当前预设，因为角色卡与思维链技巧不属于 ERA 预设。 */
  private generateStoryRetry(
    input: Readonly<Record<string, unknown>>,
    context: EraCapabilityContext,
  ): Promise<unknown> {
    return this.withAuxiliaryGeneration(async () => {
      const userInput = typeof input.userInput === 'string' ? input.userInput : '';
      const injection = typeof input.injection === 'string' ? input.injection : '';
      const response = await generate({
        user_input: userInput,
        should_stream: true,
        should_silence: false,
        ...(injection.length > 0
          ? {
              injects: [
                {
                  role: 'system',
                  content: injection,
                  position: 'in_chat',
                  depth: 0,
                  should_scan: false,
                },
              ],
            }
          : {}),
      });
      throwIfAborted(context.signal);
      if (typeof response !== 'string') {
        throw new TypeError('故事重试必须返回正文文本。');
      }
      return { response };
    });
  }

  /** 会话证据只在当前页面内按聊天身份保存，切换聊天或停止服务时必须整体清除。 */
  private createSessionOperations(): Pick<AgentOperations, 'write_session' | 'clear_session'> {
    return {
      write_session: (input, context) => {
        throwIfAborted(context.signal);
        if (typeof input.chatKey !== 'string' || input.chatKey.length === 0) {
          throw new TypeError('Agent 会话写入缺少 chatKey。');
        }
        this.sessions.set(input.chatKey, clonePortable(input.session ?? null));
        return { status: 'committed', chatKey: input.chatKey };
      },
      clear_session: (input, context) => {
        throwIfAborted(context.signal);
        const chatKey = typeof input.chatKey === 'string' ? input.chatKey : null;
        if (chatKey === null) this.sessions.clear();
        else this.sessions.delete(chatKey);
        return { status: 'cleared', chatKey };
      },
    };
  }

  /**
   * Agent Host 只保留“规划尚未产生 assistant 楼层”时的系统错误消息与停止生成能力。
   * 正常故事和结算结果必须作为楼层候选进入同步事务，不能从这里直接写入聊天。
   */
  private createMessageOperations(): Pick<AgentOperations, 'create_error_message' | 'stop_native_generation'> {
    return {
      create_error_message: async (input, context) => {
        throwIfAborted(context.signal);
        if (typeof input.message !== 'string') {
          throw new TypeError('Agent 错误消息缺少 message。');
        }
        await createChatMessages(
          [
            {
              role: 'system',
              message: input.message,
              extra: {
                era_agent: {
                  status: 'planning-failed',
                  swipeLocked: true,
                },
              },
            },
          ],
          { insert_before: 'end', refresh: 'affected' },
        );
        throwIfAborted(context.signal);
        return { status: 'created' };
      },
      stop_native_generation: (_input, context) => {
        throwIfAborted(context.signal);
        const auxiliaryStopped = stopAllGeneration();
        const nativeStopped = stopNativeTavernGeneration();
        if (nativeStopped) this.clearDeferredNativeGenerationStop();
        else this.deferNativeGenerationStop();
        return {
          status: nativeStopped ? 'stopped' : 'deferred',
          nativeStopped,
          auxiliaryStopped,
        };
      },
    };
  }
}
