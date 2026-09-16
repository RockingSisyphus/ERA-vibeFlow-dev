const sync_commit_policy = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/base_lib/sync_commit_policy.ts', import.meta.url).href
);
const sync_result_policy = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/base_lib/sync_result_policy.ts', import.meta.url).href
);
const sync_contracts = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/base_lib/sync_contracts.ts', import.meta.url).href
);
import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateEraMessageContent } from '../../src/ERA变量框架/service/message-writer';
import { assertCurrentMessageBasis } from '../../src/ERA变量框架/service/message-write-target';
import { prepareMessagePersistence } from '../../src/ERA变量框架/service/message-persistence';

const transaction = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/base_lib/sync_planning.ts', import.meta.url).href
);
const preparation = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/base_lib/dispatch_preparation.ts', import.meta.url)
    .href
);
const commit = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/nodes/sync/commit_sync.ts', import.meta.url).href
);
const savedBatch = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/nodes/sync/settle_saved_batch.ts', import.meta.url).href
);
const presentation = await import(
  /* @vite-ignore */ new URL(
    '../../../javascript_project/service/nodes/sync/present_finalized_floor.ts',
    import.meta.url,
  ).href
);
const sidecar = await import(
  /* @vite-ignore */ new URL('../../../javascript_project/service/base_lib/sidecar_binding.ts', import.meta.url).href
);

const identity = { characterId: 'card-a', chatId: 'chat-a', groupId: null };
const sidecarId = 'era_chat_12345678-1234-4234-8234-123456789abc';

function fixture(source = 'tavern', eventType = 'message_swiped', placeholder = true) {
  const original = '<VariableInsert>{"branch":"B"}</VariableInsert>';
  const event = {
    schemaVersion: 1,
    eventId: 'swipe-b',
    sequence: 1,
    type: eventType,
    source,
    occurredAt: 1000,
    args: [],
    encodedBytes: 1,
  };
  const step = {
    kind: 'execute',
    stepId: 'sync-b',
    index: 0,
    taskRoute: 'sync',
    sourceSequences: [1],
    events: [event],
    sources: [{ event, relation: 'primary' }],
    task: {
      id: 'sync-b',
      kind: 'sync',
      context: 'latest-message-with-mk',
      reason: source === 'era-api' ? 'facade-commit' : 'swipe-regeneration',
      primaryEvent: event,
      sourceEvents: [event],
      target: { kind: 'auto' },
      fullRebuild: false,
    },
  };
  const state = { schemaVersion: 1, nextState: { consecutiveProcessingCount: 0, consecutiveMk: null } };
  const messages = [{ schemaVersion: 1, messageId: 0, role: 'assistant', swipeIndex: 1, activeText: original }];
  const seed = preparation.classifyDispatch(step, state).seed;
  const plan = preparation.planDispatchPreparation(
    preparation.canonicalDispatchContext(
      seed,
      { schemaVersion: 2, messages },
      { variables: {} },
      { variables: { 在ai消息尾部生成特殊符号: placeholder, 特殊符号值: '<StatusPlaceHolderImpl/>' } },
      identity,
    ),
  );
  const dispatchContext = preparation.dispatchContextOf(preparation.preserveDispatchPreparation(plan));
  const work = transaction.planSyncWork({
    schemaVersion: 1,
    step: { ...step, dispatchContext },
    consecutive: sync_contracts.consecutiveFacts(state),
    status: 'ready',
    messagesRaw: { schemaVersion: 2, messages: dispatchContext.messages },
    variablesRaw: { stat_data: {}, statFunc: {}, ERAMetaData: {} },
    failure: null,
  });
  expect(work.disposition).toBe('commit');
  const request = sync_commit_policy.buildSyncCommitRequest(work);
  const current = { chatId: identity.chatId, swipe: 1, texts: ['A', original, 'C'], deleted: false };
  vi.stubGlobal('getCurrentCharacterId', () => identity.characterId);
  vi.stubGlobal('SillyTavern', { getCurrentChatId: () => current.chatId, groupId: null });
  vi.stubGlobal('getChatMessages', () =>
    current.deleted ? [] : [{ message_id: 0, role: 'assistant', swipe_id: current.swipe, swipes: [...current.texts] }],
  );
  const trace: string[] = [];
  vi.stubGlobal(
    'setChatMessages',
    vi.fn(async (updates: Array<{ message_id: number; message: string }>) => {
      trace.push('message');
      for (const update of updates) current.texts[current.swipe] = update.message;
    }),
  );
  let record = sidecar.recordFor(sidecarId, identity, { statData: {}, statFunc: {}, eraMeta: {} }, null);
  const hooks = { beforeFile: () => {}, afterFile: () => {} };
  const capabilities = {
    'era.tavern.messages': {
      update_content: async (input: Record<string, unknown>) => {
        await updateEraMessageContent(input, new Map());
        return { status: 'committed' };
      },
      refresh: vi.fn(async () => {
        trace.push('render');
      }),
    },
    'era.tavern.sidecar': {
      read_working: () => ({ working: null }),
      read_current: async () => ({ identity, meta: { SidecarId: sidecarId }, stat: null }),
      read_record: async () => ({ status: 'found', record }),
      write_record: async (input: Record<string, any>) => {
        hooks.beforeFile();
        assertCurrentMessageBasis(input.sourceBasis);
        record = input.record;
        trace.push('file');
        hooks.afterFile();
        return { status: 'committed' };
      },
      commit_metadata: async (input: Record<string, unknown>) => {
        assertCurrentMessageBasis(input.sourceBasis);
        trace.push('publish');
        return { status: 'committed' };
      },
      present_prompt: vi.fn(),
    },
  };
  return {
    current,
    request,
    trace,
    hooks,
    capabilities,
    original,
    usePersistence: (save: () => Promise<void>) => {
      vi.stubGlobal('SillyTavern', {
        ...SillyTavern,
        characterId: '0',
        characters: [
          {
            name: 'A',
            avatar: 'A.png',
            get chat() {
              return current.chatId;
            },
          },
        ],
        get chat() {
          return [{ mes: current.texts[current.swipe], swipe_id: current.swipe, swipes: current.texts }];
        },
        saveChat: save,
        getRequestHeaders: () => ({}),
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => [
            {},
            { mes: current.texts[current.swipe], swipe_id: current.swipe, swipes: [...current.texts] },
          ],
        })),
      );
      capabilities['era.tavern.messages'].update_content = async input => {
        const confirm = prepareMessagePersistence(input, new AbortController().signal);
        await updateEraMessageContent(input, new Map());
        return confirm();
      };
    },
    run: async () =>
      (await commit.run({ 'era.tavern.commit.request': { value: { mode: 'commit', request } } }, {}, { capabilities }))
        .sync_commit_result,
  };
}

describe('sync source survives asynchronous host interleaving', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['tavern', 'era-api', 'agent'])(
    'separates saved B from current C through the real persistence boundary (%s)',
    async source => {
      const f = fixture(source === 'agent' ? 'tavern' : source);
      if (source === 'agent')
        f.request.agentFloorCandidate = {
          ...f.request.floorIdentity,
          content: f.request.messageWrites[0].content,
          extra: {},
          terminalStatus: 'settled',
          requiresInitialPresentation: true,
        };
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      f.usePersistence(async () => {
        entered.resolve();
        await release.promise;
      });
      const pending = f.run();
      await entered.promise;
      expect(f.current.texts[1]).toBe(f.request.messageWrites[0].content);
      f.current.swipe = 2;
      release.resolve();
      const outcome = await pending;
      expect(outcome).toMatchObject({
        status: 'failed',
        confirmedMessageWrites: 1,
        sourceChanged: true,
        variablesCommitted: false,
        failure: { code: 'ERA_SYNC_SOURCE_CHANGED', details: { persistenceConfirmed: true } },
      });
      expect(f.trace).toEqual(['message']);
      expect(f.capabilities['era.tavern.sidecar'].present_prompt).not.toHaveBeenCalled();
      expect(sync_result_policy.buildSyncCommittedResult(outcome)).not.toHaveProperty('stateUpdate');
      expect(f.current.texts[2]).toBe('C');
    },
  );

  it('presents a native finalized floor only after message, Sidecar and publication', async () => {
    const f = fixture('tavern', 'message_received');
    expect(f.request.agentFloorCandidate).toBeNull();
    expect(f.request.initialPresentation).toEqual(f.request.floorIdentity);
    expect(sync_commit_policy.validateSyncCommitEnvelope({ mode: 'commit', request: f.request }).route).toBe('valid');
    expect(
      sync_commit_policy.validateSyncCommitEnvelope({
        mode: 'commit',
        request: {
          ...f.request,
          initialPresentation: { ...f.request.initialPresentation, messageId: 99 },
        },
      }),
    ).toMatchObject({ route: 'failed', failure: { failure: { code: 'ERA_FLOOR_IDENTITY_MISMATCH' } } });
    const outcome = await f.run();
    await presentation.run({ 'era.tavern.commit.result': { value: outcome } }, {}, { capabilities: f.capabilities });
    expect(f.trace).toEqual(['message', 'file', 'publish', 'render']);
  });

  it.each(['message_swiped', 'message_edited', 'chat_changed', 'ui:sync'])('does not redraw for %s', type => {
    expect(fixture('tavern', type).request.initialPresentation).toBeNull();
  });

  it('does not render an MK-only write or an API commit as initial presentation', () => {
    expect(fixture('tavern', 'message_received', false).request.initialPresentation).toBeNull();
    expect(fixture('era-api', 'message_received').request.initialPresentation).toBeNull();
  });

  it('presents a per-block-committed floor from a non-commit tail when an intent is carried', async () => {
    const f = fixture('tavern', 'message_received');
    const work = {
      schemaVersion: 1,
      disposition: 'no-op',
      plan: null,
      payload: null,
      failure: null,
      initialPresentation: { chatId: 'chat-a', messageId: 1, swipeId: 0, mk: 'mk-1' },
    };
    await presentation.run(
      { 'era.tavern.commit.result': { value: { mode: 'non-commit', work } } },
      {},
      { capabilities: f.capabilities },
    );
    expect(f.capabilities['era.tavern.messages'].refresh).toHaveBeenCalledTimes(1);
    const calls = (
      f.capabilities['era.tavern.messages'].refresh as {
        mock: { calls: unknown[][] };
      }
    ).mock.calls;
    expect(calls[0]?.[0]).toMatchObject({ messageId: 1, mode: 'affected' });

    // 不带意图（null）时不刷新：逐块提交的普通收尾不该产生额外宿主调用。
    const withoutIntent = fixture('tavern', 'message_received');
    await presentation.run(
      {
        'era.tavern.commit.result': {
          value: { mode: 'non-commit', work: { ...work, initialPresentation: null } },
        },
      },
      {},
      { capabilities: withoutIntent.capabilities },
    );
    expect(withoutIntent.capabilities['era.tavern.messages'].refresh).not.toHaveBeenCalled();
  });

  it('does not present a failed or unpublished native floor', async () => {
    const f = fixture('tavern', 'message_received');
    const outcome = { ...f.request, status: 'failed', variablesCommitted: false };
    await presentation.run({ 'era.tavern.commit.result': { value: outcome } }, {}, { capabilities: f.capabilities });
    expect(f.capabilities['era.tavern.messages'].refresh).not.toHaveBeenCalled();
  });

  it('keeps an unconfirmed disk save recoverable without committing or presenting Sidecar', async () => {
    const f = fixture('tavern', 'message_received');
    f.capabilities['era.tavern.messages'].update_content = async () => {
      f.trace.push('message');
      return {
        status: 'failed',
        writeState: 'memory-written',
        message: 'disk still has old MK',
      };
    };
    const outcome = await f.run();
    expect(outcome).toMatchObject({
      status: 'failed',
      variablesCommitted: false,
      confirmedMessageWrites: 0,
      failure: { code: 'ERA_SYNC_MESSAGE_PERSISTENCE_UNCONFIRMED', details: { memoryWritten: true } },
    });
    await presentation.run({ 'era.tavern.commit.result': { value: outcome } }, {}, { capabilities: f.capabilities });
    expect(f.trace).toEqual(['message']);
    expect(f.capabilities['era.tavern.sidecar'].present_prompt).toHaveBeenCalledWith({
      prompt: expect.objectContaining({ kind: 'repair', reason: 'message-persistence-unconfirmed' }),
    });
  });

  it('retains the source before MK/placeholder preparation and commits the matching branch', async () => {
    const f = fixture();
    expect(f.request.sourceBasis.messages[0].activeText).toBe(f.original);
    expect(f.request.messageWrites[0].content).not.toBe(f.original);
    expect(await f.run()).toMatchObject({ status: 'committed', confirmedMessageWrites: 1, variablesCommitted: true });
    expect(f.trace).toEqual(['message', 'file', 'publish']);
    expect(f.current.texts[0]).toBe('A');
    expect(f.current.texts[2]).toBe('C');
  });

  it.each(['swipe', 'edit', 'delete', 'chat'])(
    'settles ordinary stale %s without writing or publishing old state',
    async kind => {
      const f = fixture();
      if (kind === 'swipe') f.current.swipe = 2;
      if (kind === 'edit') f.current.texts[1] = 'user edited B';
      if (kind === 'delete') f.current.deleted = true;
      if (kind === 'chat') f.current.chatId = 'chat-b';
      const outcome = await f.run();
      expect(outcome).toMatchObject({
        status: 'no-op',
        confirmedMessageWrites: 0,
        variablesCommitted: false,
        sourceChanged: true,
      });
      expect(f.trace).toEqual([]);
      expect(f.current.texts[2]).toBe('C');
      const settled = sync_result_policy.buildSyncCommittedResult(outcome);
      expect(settled.status).toBe('no-op');
      expect(settled.notifications).toEqual([]);
      expect(settled).not.toHaveProperty('stateUpdate');
      expect(settled.settlements[0].status).toBe('completed');
      const schedule = vi.fn();
      savedBatch.run({ 'era.tavern.commit.result': { value: outcome } }, {}, {
        capabilities: {
          'era.lifecycle.admission': { schedule, cancel: vi.fn() },
          'era.tavern.sidecar': { read_working: () => ({ working: { dirty: true } }) },
        },
      });
      expect(schedule).toHaveBeenCalledWith(expect.objectContaining({
        key: 'era-working-save', delayMs: 0,
        event: { type: 'era.facade.sync', source: 'era-api', args: [{ mode: 'full' }] },
      }));

    },
  );

  it.each(['api', 'agent'])('does not silently discard an explicit %s operation', async kind => {
    const f = fixture(kind === 'api' ? 'era-api' : 'tavern');
    if (kind === 'agent')
      f.request.agentFloorCandidate = {
        ...f.request.floorIdentity,
        content: f.request.messageWrites[0].content,
        extra: {},
        terminalStatus: 'settled',
        requiresInitialPresentation: true,
      };
    f.current.swipe = 2;
    expect(await f.run()).toMatchObject({ status: 'failed', confirmedMessageWrites: 0, sourceChanged: true });
    expect(f.trace).toEqual([]);
  });

  it('does not write an old Sidecar after a branch change following a confirmed message write', async () => {
    const f = fixture();
    f.hooks.beforeFile = () => {
      f.current.swipe = 2;
    };
    expect(await f.run()).toMatchObject({
      status: 'failed',
      confirmedMessageWrites: 1,
      variablesCommitted: false,
      sourceChanged: true,
    });
    expect(f.trace).toEqual(['message']);
    expect(f.current.texts[2]).toBe('C');
    expect(f.current.texts[1]).toBe(f.request.messageWrites[0].content);
  });

  it('reports a committed old branch without publishing or presenting it into a newly selected branch', async () => {
    const f = fixture();
    f.request.agentFloorCandidate = {
      ...f.request.floorIdentity,
      content: f.request.messageWrites[0].content,
      extra: {},
      terminalStatus: 'settled',
      requiresInitialPresentation: true,
    };
    f.hooks.afterFile = () => {
      f.current.swipe = 2;
    };
    const outcome = await f.run();
    expect(outcome).toMatchObject({ status: 'committed', variablesCommitted: true, sourceChanged: true });
    await presentation.run({ 'era.tavern.commit.result': { value: outcome } }, {}, { capabilities: f.capabilities });
    expect(f.trace).toEqual(['message', 'file']);
    expect(sync_result_policy.buildSyncCommittedResult(outcome)).not.toHaveProperty('stateUpdate');
  });
});

it('函数执行发现目标失效而尚未形成消息写回时，也进入普通历史恢复', async () => {
  const work = { disposition: 'failed', plan: null, failure: { code: 'ERA_MESSAGE_WRITE_TARGET_CHANGED', message: 'source-text (#3)', source: 'tavern' } };
  const committed = await commit.run({ 'era.tavern.commit.request': { value: { mode: 'non-commit', work } } }, {}, { capabilities: {} });
  const schedule = vi.fn();
  const settled = savedBatch.run({ 'era.tavern.commit.result': { value: committed.sync_commit_result } }, {}, { capabilities: { 'era.lifecycle.admission': { schedule } } });
  expect(schedule).toHaveBeenCalledWith(expect.objectContaining({ event: { type: 'era.facade.sync', source: 'era-api', args: [{ mode: 'full' }] } }));
  expect(settled.completed_sync_result.work.failure).toEqual(work.failure);
});
