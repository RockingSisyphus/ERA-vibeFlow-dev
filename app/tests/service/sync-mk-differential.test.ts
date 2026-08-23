import { describe, expect, it } from 'vitest';

interface MkSeed {
  readonly timestamp: number;
  readonly token: string;
}

interface Message {
  readonly messageId: number;
  readonly role: string;
  readonly content:
    | { readonly kind: 'text'; readonly text: string }
    | { readonly kind: 'multimodal'; readonly parts: readonly Readonly<Record<string, unknown>>[] };
  readonly [key: string]: unknown;
}

interface EnsureResult {
  readonly status: 'existing' | 'created' | 'invalid' | 'seed-required';
  readonly mk: string;
  readonly isNew: boolean;
  readonly message: Message;
  readonly reason?: string;
  readonly textUpdate: Readonly<Record<string, unknown>> | null;
}

interface MkModule {
  parseMessageKeyData(content: string | null | undefined): { readonly mk: string; readonly messageType: string } | null;
  readMessageKey(message: Message): string | null;
  readMkMessageText(message: Message): string;
  generateMessageKey(seed: MkSeed): string;
  formatMessageKeyBlock(mk: string, role: string): string;
  ensureMessageKey(message: Message, seed?: MkSeed): EnsureResult;
  replaceMessageKey(message: Message, mk: string): Message;
}

interface ConsecutiveState {
  readonly mk: string | null;
  readonly count: number;
}

interface Divergence {
  readonly type: 'FAST_SYNC' | 'FULL_RECALC';
  readonly recalcId?: number;
  readonly firstMismatch?: number;
  readonly cause?: string;
  readonly newSelectedMks?: readonly (string | null)[];
}

interface SyncPlan {
  readonly kind: 'sync';
  readonly status: 'no-op' | 'fast-sync' | 'recalculated' | 'failed';
  readonly committed: boolean;
  readonly divergence: Divergence | null;
  readonly stat: unknown;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly messages: readonly Message[];
  readonly messageUpdates: readonly Readonly<Record<string, unknown>>[];
  readonly recalculatedMessageIndexes: readonly number[];
  readonly rollback: {
    readonly applied: boolean;
    readonly fromMk: string | null;
    readonly toMk: string | null;
  };
  readonly actionsTaken: Readonly<Record<string, boolean>>;
  readonly consecutiveProcessingCount: number | null;
  readonly nextConsecutiveState: ConsecutiveState | null;
  readonly diagnostics: readonly Readonly<Record<string, unknown>>[];
  readonly error?: Readonly<Record<string, unknown>>;
}

interface SyncModule {
  currentSelectedMks(messages: readonly Message[]): readonly (string | null)[];
  findSyncDivergence(
    messages: readonly Message[],
    oldSelectedMks: readonly (string | null)[],
    meta: Readonly<Record<string, unknown>>,
    forceFullRebuild?: boolean,
  ): Divergence;
  createSyncActionsTaken(reason: string, resync?: boolean): Readonly<Record<string, boolean>>;
  advanceConsecutiveMkState(
    previous: ConsecutiveState | null,
    mk: string | null,
  ): { readonly state: ConsecutiveState; readonly count: number };
  planEraSync(input: {
    readonly messages: readonly Message[];
    readonly stat: unknown;
    readonly meta: Readonly<Record<string, unknown>>;
    readonly reason: string;
    readonly forceFullRebuild?: boolean;
    readonly targetMessageId?: number;
    readonly stopAtTarget?: boolean;
    readonly traditionalToSimplified?: boolean;
    readonly mkSeedsByIndex?: readonly (MkSeed | null)[];
    readonly processingMk: string | null;
    readonly consecutiveState: ConsecutiveState | null;
  }): SyncPlan;
}

const mkUrl = new URL('../../../javascript_project/service/base_lib/domain/mk_engine.ts', import.meta.url).href;
const syncUrl = new URL('../../../javascript_project/service/base_lib/domain/sync_engine.ts', import.meta.url).href;
const mkEngine = (await import(/* @vite-ignore */ mkUrl)) as MkModule;
const syncEngine = (await import(/* @vite-ignore */ syncUrl)) as SyncModule;

function candidateBlock(mk: string, role: string): string {
  const messageType = role === 'user' ? 'user' : 'assistant';
  return `<era_data>{"era-message-key"="${mk}","era-message-type"="${messageType}"}</era_data>`;
}

function candidateReadMk(content: string): string {
  const block = content.match(/<era_data>({.*?})<\/era_data>/)?.[1];
  if (!block) return '';
  const key = block.match(/"era-message-key"\s*=\s*"(.*?)"/)?.[1];
  const type = block.match(/"era-message-type"\s*=\s*"(.*?)"/)?.[1];
  return key && type ? key : '';
}

function command(type: 'Insert' | 'Edit' | 'Delete', value: unknown): string {
  return `<Variable${type}>${JSON.stringify(value)}</Variable${type}>`;
}

function message(
  messageId: number,
  mk: string | null,
  body = '',
  role = 'assistant',
  extra: Readonly<Record<string, unknown>> = {},
): Message {
  const suffix = mk === null ? '' : `\n${candidateBlock(mk, role)}`;
  return {
    ...extra,
    messageId,
    role,
    content: { kind: 'text', text: `${body}${suffix}` },
  };
}

function baseMessages() {
  return [
    message(0, 'mk-0', command('Insert', { a: 1 })),
    message(1, 'mk-1', command('Insert', { b: 2 })),
    message(2, 'mk-2', command('Insert', { c: 3 })),
  ] as const;
}

function baseMeta(): Readonly<Record<string, unknown>> {
  return {
    frameworkUnknown: { keep: true, nested: [null, { value: 9 }] },
    SelectedMks: ['mk-0', 'mk-1', 'mk-2'],
    EditLogs: {
      unknownLogField: { keep: 'yes' },
      'mk-0': [{ op: 'insert', path: 'a', value_new: 1, unknown: 'log-0' }],
      'mk-1': [{ op: 'insert', path: 'b', value_new: 2, unknown: 'log-1' }],
      'mk-2': [{ op: 'insert', path: 'c', value_new: 3, unknown: 'log-2' }],
    },
  };
}

function runSync(overrides: Readonly<Record<string, unknown>> = {}): SyncPlan {
  return syncEngine.planEraSync({
    messages: baseMessages(),
    stat: { a: 1, b: 2, c: 3 },
    meta: baseMeta(),
    reason: 'history-changed',
    processingMk: 'mk-2',
    consecutiveState: null,
    ...overrides,
  });
}

describe('VibeFlow MK 纯文本引擎差分', () => {
  it('保持候选解析、注入 token/time 与末尾 append 格式', () => {
    const existing = message(3, 'candidate-mk', '正文');
    expect(mkEngine.readMessageKey(existing)).toBe('candidate-mk');
    expect(candidateReadMk(mkEngine.readMkMessageText(existing))).toBe('candidate-mk');
    expect(mkEngine.ensureMessageKey(existing)).toMatchObject({
      status: 'existing',
      mk: 'candidate-mk',
      isNew: false,
      textUpdate: null,
    });

    const missing = message(4, null, '正文');
    const seed = { timestamp: 1_759_246_942_209, token: 'jipmrj' };
    const created = mkEngine.ensureMessageKey(missing, seed);
    const expectedMk = 'era_mk_1759246942209_jipmrj';
    expect(mkEngine.generateMessageKey(seed)).toBe(expectedMk);
    expect(mkEngine.formatMessageKeyBlock(expectedMk, 'assistant')).toBe(candidateBlock(expectedMk, 'assistant'));
    expect(created).toMatchObject({ status: 'created', mk: expectedMk, isNew: true });
    expect(mkEngine.readMkMessageText(created.message)).toBe(`正文\n${candidateBlock(expectedMk, 'assistant')}`);
  });

  it('损坏 MK 按缺失处理；无 seed 返回 typed seed-required', () => {
    const corrupt = message(5, null, '正文\n<era_data>{"era-message-key"="broken"}</era_data>');
    expect(mkEngine.readMessageKey(corrupt)).toBeNull();
    expect(mkEngine.parseMessageKeyData(mkEngine.readMkMessageText(corrupt))).toBeNull();
    expect(mkEngine.ensureMessageKey(corrupt)).toMatchObject({
      status: 'seed-required',
      mk: null,
      isNew: false,
      textUpdate: null,
    });
    const repaired = mkEngine.ensureMessageKey(corrupt, { timestamp: 10, token: 'abc123' });
    expect(repaired.status).toBe('created');
    expect(mkEngine.readMkMessageText(repaired.message)).toBe(
      `正文\n<era_data>{"era-message-key"="broken"}</era_data>\n${candidateBlock('era_mk_10_abc123', 'assistant')}`,
    );
    expect(mkEngine.ensureMessageKey(corrupt, { timestamp: -1, token: 'INVALID!' })).toMatchObject({
      status: 'invalid',
      mk: null,
      isNew: false,
      textUpdate: null,
    });
  });

  it('同 MID 的不同内容各自解析/生成 MK，不共享任何缓存', () => {
    const first = message(7, 'swipe-mk-a', 'A');
    const second = message(7, 'swipe-mk-b', 'B');
    expect(mkEngine.readMessageKey(first)).toBe('swipe-mk-a');
    expect(mkEngine.readMessageKey(second)).toBe('swipe-mk-b');

    const missingA = mkEngine.ensureMessageKey(message(8, null, 'A'), { timestamp: 20, token: 'aaaaaa' });
    const missingB = mkEngine.ensureMessageKey(message(8, null, 'B'), { timestamp: 20, token: 'bbbbbb' });
    expect(missingA.mk).toBe('era_mk_20_aaaaaa');
    expect(missingB.mk).toBe('era_mk_20_bbbbbb');
    expect(missingA.message).not.toBe(missingB.message);
  });

  it('多模态仅修改命中文本 part，附件值和未知字段完整保留', () => {
    const multimodal: Message = {
      messageId: 9,
      role: 'assistant',
      messageUnknown: { keep: 1 },
      content: {
        kind: 'multimodal',
        parts: [
          { type: 'text', text: `第一段\n${candidateBlock('old-mk', 'assistant')}`, style: 'keep' },
          { type: 'image', url: 'asset://image', detail: { width: 512 } },
          { type: 'text', text: '末尾文本', language: 'zh' },
          { type: 'audio', url: 'asset://audio' },
        ],
      },
    };
    const before = structuredClone(multimodal);
    const replaced = mkEngine.replaceMessageKey(multimodal, 'new-mk');
    expect(mkEngine.readMessageKey(replaced)).toBe('new-mk');
    expect((replaced.content as { parts: readonly unknown[] }).parts[1]).toEqual(
      (multimodal.content as { parts: readonly unknown[] }).parts[1],
    );
    expect((replaced.content as { parts: readonly unknown[] }).parts[3]).toEqual(
      (multimodal.content as { parts: readonly unknown[] }).parts[3],
    );
    expect(multimodal).toEqual(before);

    const missing: Message = {
      ...multimodal,
      content: {
        kind: 'multimodal',
        parts: [
          { type: 'image', url: 'asset://image' },
          { type: 'text', text: '末尾文本', language: 'zh' },
          { type: 'audio', url: 'asset://audio' },
        ],
      },
    };
    const created = mkEngine.ensureMessageKey(missing, { timestamp: 30, token: 'cccccc' });
    expect(created.status).toBe('created');
    const parts = (created.message.content as { parts: readonly Readonly<Record<string, unknown>>[] }).parts;
    expect(parts[0]).toEqual({ type: 'image', url: 'asset://image' });
    expect(parts[1]).toEqual({
      type: 'text',
      text: `末尾文本\n${candidateBlock('era_mk_30_cccccc', 'assistant')}`,
      language: 'zh',
    });
    expect(parts[2]).toEqual({ type: 'audio', url: 'asset://audio' });
  });
});

describe('VibeFlow 历史同步纯引擎差分', () => {
  it('current SelectedMks 完全匹配时回滚并重算最新消息', () => {
    const plan = runSync();
    expect(plan).toMatchObject({
      status: 'recalculated',
      committed: true,
      divergence: { type: 'FULL_RECALC', recalcId: 2, cause: 'no-divergence' },
      stat: { a: 1, b: 2, c: 3 },
      recalculatedMessageIndexes: [2],
      rollback: { applied: true, fromMk: 'mk-2', toMk: 'mk-1' },
      actionsTaken: { rollback: false, apply: false, resync: true },
      consecutiveProcessingCount: 1,
      nextConsecutiveState: { mk: 'mk-2', count: 1 },
    });
    expect(plan.meta.SelectedMks).toEqual(['mk-0', 'mk-1', 'mk-2']);
    expect(plan.meta.frameworkUnknown).toEqual(baseMeta().frameworkUnknown);
    expect((plan.meta.EditLogs as Record<string, unknown>).unknownLogField).toEqual({ keep: 'yes' });
  });

  it('纯无害删除走 fast path，只修正 SelectedMks 并保留 stat/log/未知字段', () => {
    const messages = [baseMessages()[0], baseMessages()[2]];
    const meta = {
      ...baseMeta(),
      EditLogs: {
        ...(baseMeta().EditLogs as Record<string, unknown>),
        'mk-1': [],
      },
    };
    expect(syncEngine.findSyncDivergence(messages, ['mk-0', 'mk-1', 'mk-2'], meta)).toMatchObject({
      type: 'FAST_SYNC',
      firstMismatch: 1,
      newSelectedMks: ['mk-0', 'mk-2'],
    });
    const plan = runSync({ messages, meta });
    expect(plan).toMatchObject({
      status: 'fast-sync',
      committed: true,
      stat: { a: 1, b: 2, c: 3 },
      messageUpdates: [],
      recalculatedMessageIndexes: [],
    });
    expect(plan.meta.SelectedMks).toEqual(['mk-0', 'mk-2']);
    expect(plan.meta.EditLogs).toEqual(meta.EditLogs);
    expect(plan.meta.frameworkUnknown).toEqual((meta as Record<string, unknown>).frameworkUnknown);
  });

  it('首个 divergence 回滚到前一 MK，再从分歧点顺序重算', () => {
    const divergent = [baseMessages()[0], message(1, 'mk-1-new', command('Insert', { d: 4 })), baseMessages()[2]];
    const plan = runSync({ messages: divergent });
    expect(plan).toMatchObject({
      status: 'recalculated',
      divergence: { type: 'FULL_RECALC', recalcId: 1, cause: 'divergence' },
      stat: { a: 1, d: 4, c: 3 },
      recalculatedMessageIndexes: [1, 2],
      rollback: { applied: true, fromMk: 'mk-2', toMk: 'mk-0' },
    });
    expect(plan.meta.SelectedMks).toEqual(['mk-0', 'mk-1-new', 'mk-2']);
    expect((plan.meta.EditLogs as Record<string, unknown>)['mk-1']).toEqual(
      (baseMeta().EditLogs as Record<string, unknown>)['mk-1'],
    );
    expect((plan.meta.EditLogs as Record<string, unknown>)['mk-1-new']).toEqual([
      { op: 'insert', path: 'd', value_new: 4 },
    ]);
  });

  it('force full 从 0 回滚并重放全部消息', () => {
    const plan = runSync({ forceFullRebuild: true, reason: 'manual' });
    expect(plan).toMatchObject({
      status: 'recalculated',
      divergence: { type: 'FULL_RECALC', recalcId: 0, cause: 'forced' },
      stat: { a: 1, b: 2, c: 3 },
      recalculatedMessageIndexes: [0, 1, 2],
      rollback: { applied: true, fromMk: 'mk-2', toMk: null },
      actionsTaken: {
        rollback: false,
        apply: false,
        resync: true,
        api: false,
        apiWrite: false,
        editedResync: false,
        swipedRollback: false,
      },
    });
  });

  it('directed rollback 精确处理目标消息后停止，并保留其他 EditLogs', () => {
    const plan = runSync({ targetMessageId: 1, stopAtTarget: true, reason: 'manual' });
    expect(plan).toMatchObject({
      status: 'recalculated',
      divergence: { type: 'FULL_RECALC', recalcId: 1, cause: 'targeted' },
      stat: { a: 1, b: 2 },
      recalculatedMessageIndexes: [1],
      rollback: { applied: true, fromMk: 'mk-2', toMk: 'mk-0' },
    });
    expect(plan.meta.SelectedMks).toEqual(['mk-0', 'mk-1']);
    expect((plan.meta.EditLogs as Record<string, unknown>)['mk-2']).toEqual(
      (baseMeta().EditLogs as Record<string, unknown>)['mk-2'],
    );
  });

  it('缺失/损坏 MK 使用逐 index seed 生成；缺 seed 时显式 null 并继续', () => {
    const messages = [
      message(0, 'mk-0', command('Insert', { a: 1 })),
      message(1, null, command('Insert', { b: 2 })),
      message(2, null, `${command('Insert', { c: 3 })}\n<era_data>{"era-message-key"="bad"}</era_data>`),
    ];
    const plan = runSync({
      forceFullRebuild: true,
      messages,
      mkSeedsByIndex: [null, { timestamp: 100, token: 'seedaa' }, null],
    });
    expect(plan).toMatchObject({
      status: 'recalculated',
      stat: { a: 1, b: 2 },
      recalculatedMessageIndexes: [0, 1],
      diagnostics: [{ code: 'ERA_SYNC_MK_SEED_REQUIRED', messageIndex: 2 }],
    });
    expect(plan.meta.SelectedMks).toEqual(['mk-0', 'era_mk_100_seedaa', null]);
    // `planEraSync` now only carries a sealed-layer candidate. The separate
    // command-compaction Nodeset may later add a message-0 rewrite, while this
    // pure planner must only write the deterministic MK for message 1.
    expect(plan.messageUpdates.map(update => update.messageId).sort()).toEqual([1]);
    expect(plan.messages[2]).toEqual(messages[2]);
  });

  it('SelectedMks 的 null 位置和 metadata/log 未知字段在末楼重算后保真', () => {
    const messages = [baseMessages()[0], message(1, null, '', 'user'), baseMessages()[2]];
    const meta = {
      ...baseMeta(),
      SelectedMks: ['mk-0', null, 'mk-2'],
      EditLogs: {
        ...(baseMeta().EditLogs as Record<string, unknown>),
        preservedUnknownMk: [{ arbitrary: { nested: true } }],
      },
    };
    const plan = runSync({ messages, meta });
    expect(plan.meta.SelectedMks).toEqual(['mk-0', null, 'mk-2']);
    expect((plan.meta.EditLogs as Record<string, unknown>).preservedUnknownMk).toEqual([
      { arbitrary: { nested: true } },
    ]);
    expect(plan.meta.frameworkUnknown).toEqual((meta as Record<string, unknown>).frameworkUnknown);
  });

  it('同一 MID 出现多个独立 MK 时仍按消息序列分别重放和记录', () => {
    const messages = [
      message(5, 'same-mid-a', command('Insert', { swipeA: 1 })),
      message(5, 'same-mid-b', command('Insert', { swipeB: 2 })),
    ];
    const plan = syncEngine.planEraSync({
      messages,
      stat: {},
      meta: { SelectedMks: [], EditLogs: {}, unknown: { keep: true } },
      reason: 'manual',
      forceFullRebuild: true,
      processingMk: 'same-mid-b',
      consecutiveState: null,
    });
    expect(plan).toMatchObject({
      status: 'recalculated',
      stat: { swipeA: 1, swipeB: 2 },
      recalculatedMessageIndexes: [0, 1],
    });
    expect(plan.meta.SelectedMks).toEqual(['same-mid-a', 'same-mid-b']);
    expect(plan.meta.unknown).toEqual({ keep: true });
  });

  it('ActionsTaken 与 consecutiveProcessingCount 保持候选状态机语义', () => {
    expect(syncEngine.createSyncActionsTaken('edited', true)).toEqual({
      rollback: false,
      apply: false,
      resync: true,
      api: false,
      apiWrite: false,
      editedResync: true,
      swipedRollback: false,
    });
    expect(syncEngine.createSyncActionsTaken('swipe-regeneration', true)).toMatchObject({
      swipedRollback: true,
    });
    expect(syncEngine.createSyncActionsTaken('api-write', true)).toMatchObject({ apiWrite: true });
    expect(syncEngine.advanceConsecutiveMkState({ mk: 'same', count: 2 }, 'same')).toEqual({
      state: { mk: 'same', count: 3 },
      count: 3,
    });
    expect(syncEngine.advanceConsecutiveMkState({ mk: 'same', count: 3 }, 'new')).toEqual({
      state: { mk: 'new', count: 1 },
      count: 1,
    });
    expect(syncEngine.advanceConsecutiveMkState({ mk: '', count: 9 }, '')).toEqual({
      state: { mk: '', count: 1 },
      count: 1,
    });
  });
});
