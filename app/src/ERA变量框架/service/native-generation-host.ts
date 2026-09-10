import { TavernListeners } from './tavern-listeners';
import { isRecord, clonePortable } from './agent-tavern-configuration';
import { NativeGenerationCompletion } from './native-generation-completion';
import type { EraCapabilityContext } from './types';

interface NativeGenerationPorts {
  readonly isAuxiliary: () => boolean;
  readonly readSession: (chatId: string) => unknown;
  readonly readIdentity: (context: EraCapabilityContext) => unknown;
}

/** 记录原生生成的机械生命周期；是否进入辅助阶段仍由 Service 决定。 */
export class NativeGenerationHost {
  private readonly completion = new NativeGenerationCompletion();
  private active = false;

  constructor(private readonly ports: NativeGenerationPorts) {}

  /** 新一轮原生生成取代旧等待，但不创建业务会话。 */
  start(): void {
    this.clear('superseded');
    this.active = true;
  }

  clear(reason: string): void {
    this.active = false;
    this.completion.clear(reason);
  }

  /** 必须排除辅助请求的结束，避免过早释放原生世界书清理等待。 */
  observe(): () => void {
    const ended = (messageId: number) => {
      if (this.ports.isAuxiliary()) return;
      this.active = false;
      const identity = this.completion.identity;
      if (identity && identity.chatId === SillyTavern.getCurrentChatId()) {
        this.completion.complete(identity, messageId);
      }
    };
    const listeners = new TavernListeners();
    const stop = () => {
      listeners.release();
      this.clear('unsubscribed');
    };
    try {
      listeners.register(tavern_events.GENERATION_ENDED, ended, 'normal');
      return stop;
    } catch (error) {
      stop();
      throw error;
    }
  }

  /** 只投影即时关联事实，避免把宿主会话对象或控制器交给 Service。 */
  readBinding(chatId: string): unknown {
    const previous = this.ports.readSession(chatId);
    return clonePortable({
      active: this.active,
      previous: isRecord(previous)
        ? {
            execution: isRecord(previous.execution) ? { id: previous.execution.id } : previous.execution,
            storyRequestId: previous.storyRequestId,
            nativeGeneration: previous.nativeGeneration,
          }
        : null,
    });
  }

  /** 按 Service 的明确执行身份登记原生等待，不补写会话字段。 */
  begin(chatId: string, executionId: unknown): void {
    if (typeof executionId === 'string') this.completion.begin({ chatId, executionId });
  }

  /** 等待真实结束后重新读取上下文，不能把等待前的会话当成仍然有效。 */
  async wait(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): Promise<unknown> {
    if (typeof input.chatId !== 'string' || typeof input.executionId !== 'string') {
      throw new TypeError('原生生成收尾等待缺少聊天及执行来源。');
    }
    const session = this.ports.readSession(input.chatId);
    const terminal =
      isRecord(session) && session.nativeGeneration === false
        ? { status: 'not-native' as const }
        : await this.completion.wait({ chatId: input.chatId, executionId: input.executionId }, context.signal);
    context.signal.throwIfAborted();
    const current = this.ports.readSession(input.chatId);
    return clonePortable({
      ...terminal,
      executionId: isRecord(current) && isRecord(current.execution) ? current.execution.id : null,
      identity: this.ports.readIdentity(context),
      latestMessage: getChatMessages(-1, { include_swipes: false })[0] ?? null,
    });
  }
}
