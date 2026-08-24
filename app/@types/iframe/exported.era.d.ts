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

interface EraApi {
  commit(operations: readonly EraCommitOperation[], options?: { scope?: EraCommitScope }): Promise<EraCommitReceipt>;
  get(): EraState;
  subscribe(listener: (state: EraState) => void): () => void;
  sync(options?: { mode?: 'auto' | 'latest' | 'full'; rollbackTo?: number }): Promise<EraState>;
  history: {
    atMessage(messageId: number): Promise<EraState>;
  };
}

/** 由 ERA 角色卡脚本通过 initializeGlobal 发布。 */
declare const ERA: EraApi;
