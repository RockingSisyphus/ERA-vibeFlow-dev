/** 当前原生生成的机械收尾事实；不调度阶段、不保存业务状态。 */
export interface NativeGenerationIdentity {
  readonly chatId: string;
  readonly executionId: string;
}

export type NativeGenerationTerminal =
  | { readonly status: 'completed'; readonly messageId: number }
  | { readonly status: 'cancelled'; readonly reason: string };

interface NativeCycle {
  readonly identity: NativeGenerationIdentity;
  readonly completion: Promise<NativeGenerationTerminal>;
  readonly resolve: (terminal: NativeGenerationTerminal) => void;
}

function sameIdentity(left: NativeGenerationIdentity, right: NativeGenerationIdentity): boolean {
  return left.chatId === right.chatId && left.executionId === right.executionId;
}

export class NativeGenerationCompletion {
  private current: NativeCycle | null = null;

  get identity(): NativeGenerationIdentity | null {
    return this.current?.identity ?? null;
  }

  begin(identity: NativeGenerationIdentity): void {
    if (this.current && sameIdentity(this.current.identity, identity)) return;
    this.clear('superseded');
    let resolve!: NativeCycle['resolve'];
    const completion = new Promise<NativeGenerationTerminal>(done => {
      resolve = done;
    });
    this.current = { identity: Object.freeze({ ...identity }), completion, resolve };
  }

  complete(identity: NativeGenerationIdentity, messageId: number): void {
    if (this.current && sameIdentity(this.current.identity, identity)) {
      this.current.resolve({ status: 'completed', messageId });
    }
  }

  clear(reason: string): void {
    this.current?.resolve({ status: 'cancelled', reason });
    this.current = null;
  }

  /** 必须只等待匹配执行，避免借用其他生成的结束；取消监听随等待结束释放。 */
  async wait(identity: NativeGenerationIdentity, signal: AbortSignal): Promise<NativeGenerationTerminal> {
    signal.throwIfAborted();
    const cycle = this.current;
    if (!cycle || !sameIdentity(cycle.identity, identity)) {
      return { status: 'cancelled', reason: 'generation-not-current' };
    }
    let abort!: () => void;
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
    });
    try {
      return await Promise.race([cycle.completion, cancelled]);
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
}
