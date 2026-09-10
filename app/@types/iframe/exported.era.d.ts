type EraCommitScope = 'message' | 'branch' | 'always';

type EraCommitOperation =
  | { insert: Record<string, unknown> }
  | { edit: Record<string, unknown> }
  | { delete: Record<string, unknown> }
  | { functionInsert: Record<string, unknown> }
  | { functionEdit: Record<string, unknown> }
  | { functionDelete: Record<string, unknown> };

interface EraState {
  status: 'ready' | 'loading';
  sidecarId: string | null;
  revision: number | null;
  statData: unknown;
  statFunc: Record<string, unknown>;
  eraMeta: Record<string, unknown>;
  stat: unknown;
  statWithoutMeta: unknown;
  selectedMks: readonly (string | null)[];
  editLogs: Record<string, unknown>;
  functionEditLogs: Record<string, unknown>;
  mk: string | null;
  message_id: number | null;
}

interface EraCommitReceipt {
  status: 'committed' | 'skipped';
  scope: EraCommitScope;
  messageId: number;
  state: EraState;
}

/** 成功阶段结束时的只读通知；返回 Promise 可暂缓后续生成。 */
type EraGenerationStage = 'planning' | 'story' | 'settlement';
type EraGenerationEvent = {
  readonly executionId: string;
  readonly completionId: string;
  readonly trigger: string;
  readonly chatKey: string;
  readonly messageId?: number;
  readonly mk?: string;
  readonly swipeId?: number;
  readonly signal: AbortSignal;
} & (
  | {
      readonly stage: 'planning';
      readonly result: {
        readonly plan: Readonly<Record<string, unknown>>;
        readonly functionResults: readonly unknown[];
      };
    }
  | { readonly stage: 'story'; readonly result: { readonly story: string } }
  | {
      readonly stage: 'settlement';
      readonly result: { readonly operations: readonly Readonly<Record<string, unknown>>[] };
    }
);

interface EraApi {
  readonly generation: {
    subscribe(
      listener: (event: EraGenerationEvent) => void | Promise<void>,
      options?: { stages?: readonly EraGenerationStage[] },
    ): () => void;
  };
  commit(operations: readonly EraCommitOperation[], options?: { scope?: EraCommitScope }): Promise<EraCommitReceipt>;
  get(options?: { force?: boolean; overflow?: 'placeholder' | 'empty' | 'hidden' }): EraState;
  ready(options?: { force?: boolean; overflow?: 'placeholder' | 'empty' | 'hidden' }): Promise<EraState>;
  subscribe(listener: (state: EraState) => void): () => void;
  sync(options?: { mode?: 'auto' | 'latest' | 'full'; rollbackTo?: number }): Promise<EraState>;
  history: {
    atMessage(messageId: number): Promise<EraState>;
  };
  statusbar: {
    mount(frameWindow: Window): Promise<void>;
    list(): readonly { messageId: number; mk: string; active: boolean; selected: boolean; summary: string }[];
    select(messageId: number): Promise<void>;
    clearSelection(): void;
  };
}

/** 由 ERA 角色卡脚本通过 initializeGlobal 发布。 */
declare const ERA: EraApi;
