import { describe, expect, it } from 'vitest';

interface NodeModule {
  run(inputs?: unknown, params?: unknown, context?: unknown): unknown;
}

interface AsyncNodeModule {
  run(inputs?: unknown, params?: unknown, context?: unknown): Promise<unknown>;
}

type JsonRecord = Record<string, any>;

const nodeRoot = new URL('../../../javascript_project/service/nodes/update_mk/', import.meta.url);

async function loadNode(file: string): Promise<NodeModule> {
  return (await import(/* @vite-ignore */ new URL(file, nodeRoot).href)) as NodeModule;
}

const readMessageMetadata = (await loadNode('read_message_metadata.ts')) as AsyncNodeModule;
const deriveMkCandidate = await loadNode('derive_mk_candidate.ts');
const routeMkCommit = await loadNode('route_mk_commit.ts');
const preserveMk = await loadNode('preserve_mk.ts');
const buildMkCommit = await loadNode('build_mk_commit.ts');
const commitMk = (await loadNode('commit_mk.ts')) as AsyncNodeModule;
const buildMkResult = await loadNode('build_mk_result.ts');

function envelope(value: unknown) {
  return { value };
}

function mkBlock(mk: string, role: 'user' | 'assistant' = 'assistant'): string {
  return `<era_data>{"era-message-key"="${mk}","era-message-type"="${role}"}</era_data>`;
}

function updateMkStep(sequence = 7, sourceCount = 1): JsonRecord {
  const events = Array.from({ length: sourceCount }, (_, offset) => ({
    schemaVersion: 1,
    eventId: `event-${sequence + offset}`,
    sequence: sequence + offset,
    type: offset === 0 ? 'MESSAGE_SENT' : 'MESSAGE_RECEIVED',
    occurredAt: 1_725_000_000_000 + sequence,
    source: 'tavern',
    args: [],
    encodedBytes: 64,
  }));
  return {
    kind: 'execute',
    stepId: `step:${sequence}`,
    index: 0,
    taskRoute: 'update-mk',
    sourceSequences: events.map(event => event.sequence),
    events,
    task: {
      id: `task:update-mk:${events[0].eventId}`,
      sourceEvents: events,
      primaryEvent: events[0],
      context: 'latest-message-with-mk',
      kind: 'update-mk',
    },
    sources: events.map((event, index) => ({
      event,
      relation: index === 0 ? 'primary' : 'combined',
    })),
  };
}

interface FakeOptions {
  readonly messageFailure?: 'throw' | 'cancel-late';
  readonly variableFailure?: 'throw' | 'cancel';
  /** 未提供时模拟酒馆没有保存过设置，由工作流采用候选默认值。 */
  readonly scriptVariables?: JsonRecord;
}

function fakeTavern(message: JsonRecord, initialMeta: JsonRecord, options: FakeOptions = {}) {
  const state = {
    message: structuredClone(message),
    meta: structuredClone(initialMeta),
    scriptVariables: structuredClone(options.scriptVariables ?? {}),
  };
  const counters = {
    messageReads: 0,
    variableReads: 0,
    messageUpdates: 0,
    variableCommits: 0,
    lateResults: 0,
    refreshAffectedWrites: 0,
  };
  const order: string[] = [];
  const capabilities = {
    'era.tavern.messages': {
      read_context: async () => {
        counters.messageReads += 1;
        order.push('messages.read_context');
        return { messages: [structuredClone(state.message)] };
      },
      update_content: async (input: JsonRecord) => {
        counters.messageUpdates += 1;
        order.push('messages.update_content');
        if (input.refresh === 'affected') counters.refreshAffectedWrites += 1;
        if (options.messageFailure === 'throw') throw new Error('消息写入故障');
        if (options.messageFailure === 'cancel-late') {
          queueMicrotask(() => {
            counters.lateResults += 1;
          });
          const error = new Error('消息写入已取消');
          error.name = 'AbortError';
          throw error;
        }
        if (Array.isArray(state.message.swipes)) {
          const swipeId = Number(state.message.swipe_id ?? 0);
          state.message.swipes[swipeId] = String(input.content);
        } else {
          state.message.message = String(input.content);
          if (typeof state.message.mes === 'string') state.message.mes = String(input.content);
        }
        return { status: 'committed' };
      },
    },
    'era.tavern.variables': {
      read: async (input: JsonRecord) => {
        counters.variableReads += 1;
        order.push('variables.read');
        if (input.scope?.type === 'script') {
          return {
            scope: { type: 'script' },
            variables: structuredClone(state.scriptVariables),
          };
        }
        return {
          scope: { type: 'chat' },
          variables: { ERAMetaData: structuredClone(state.meta) },
        };
      },
      commit: async (input: JsonRecord) => {
        counters.variableCommits += 1;
        order.push('variables.commit');
        if (options.variableFailure === 'throw') throw new Error('变量写入故障');
        if (options.variableFailure === 'cancel') {
          const error = new Error('变量写入已取消');
          error.name = 'AbortError';
          throw error;
        }
        state.meta = structuredClone(input.meta);
        return {
          status: 'committed',
          variables: { ERAMetaData: structuredClone(state.meta) },
        };
      },
    },
  };
  return { state, counters, order, capabilities };
}

async function executeUpdateMk(step: JsonRecord, fake: ReturnType<typeof fakeTavern>) {
  const context = (await readMessageMetadata.run(
    { 'era.step.request.routed': envelope(step) },
    {},
    { capabilities: fake.capabilities },
  )) as JsonRecord;
  const candidate = deriveMkCandidate.run({
    'era.mk.context': envelope(context.mk_context),
  }) as JsonRecord;
  const routed = routeMkCommit.run({
    'era.mk.candidate': envelope(candidate.mk_candidate),
  }) as JsonRecord;
  let commitResult: JsonRecord;
  if (routed.mk_commit_route === 'commit') {
    const request = buildMkCommit.run({
      'era.mk.candidate.routed': envelope(routed.routed_mk_candidate),
    }) as JsonRecord;
    commitResult = (await commitMk.run(
      { 'era.mk.commit.request': envelope(request.mk_commit_request) },
      {},
      { capabilities: fake.capabilities },
    )) as JsonRecord;
  } else {
    commitResult = preserveMk.run({
      'era.mk.candidate.routed': envelope(routed.routed_mk_candidate),
    }) as JsonRecord;
  }
  const outcome = commitResult.mk_commit_outcome ?? commitResult.mk_noop_outcome;
  const taskResult = buildMkResult.run({
    'era.mk.commit.result': envelope(outcome),
  }) as JsonRecord;
  return {
    context: context.mk_context,
    candidate: candidate.mk_candidate,
    route: routed.mk_commit_route,
    outcome,
    taskResult: taskResult.update_mk_task_result,
  };
}

describe('VibeFlow update-mk 工作流切片', () => {
  it('关闭占位符时，已有 MK 与 SelectedMks 一致严格 no-op，且不产生 writeDone/stateUpdate', async () => {
    const fake = fakeTavern(
      { message_id: 1, role: 'assistant', mes: `正文\n${mkBlock('mk-existing')}` },
      { SelectedMks: [null, 'mk-existing'], EditLogs: {}, unknown: { keep: true } },
      { scriptVariables: { 在ai消息尾部生成特殊符号: false } },
    );
    const result = await executeUpdateMk(updateMkStep(), fake);
    expect(result.route).toBe('no-op');
    expect(result.taskResult.status).toBe('no-op');
    expect(result.taskResult.settlements).toEqual([
      expect.objectContaining({ status: 'completed', sequence: 7, relation: 'primary' }),
    ]);
    expect(result.taskResult.notifications).toEqual([]);
    expect(result.taskResult).not.toHaveProperty('stateUpdate');
    expect(result.taskResult.diagnostics[0].code).toBe('ERA_UPDATE_MK_CONSECUTIVE_STATE_UNCHANGED');
    expect(fake.counters).toEqual({
      messageReads: 1,
      variableReads: 2,
      messageUpdates: 0,
      variableCommits: 0,
      lateResults: 0,
      refreshAffectedWrites: 0,
    });
  });

  it('新 user 消息使用稳定事件 seed，先写消息再提交并回读变量，保留 null 与未知字段', async () => {
    const step = updateMkStep(11, 2);
    const initialMeta = {
      SelectedMks: [null, 'mk-old', null],
      EditLogs: { 'mk-old': [] },
      unknown: { keep: ['x', null] },
    };
    const fake = fakeTavern({ message_id: 3, role: 'user', message: '用户正文' }, initialMeta);
    const result = await executeUpdateMk(step, fake);
    expect(result.route).toBe('commit');
    expect(result.candidate.mk).toMatch(/^era_mk_1725000000011_[a-z0-9]+$/);
    expect(fake.state.message.message).toContain(mkBlock(result.candidate.mk, 'user'));
    expect(fake.state.meta.SelectedMks).toEqual([null, 'mk-old', null, result.candidate.mk]);
    expect(fake.state.meta.unknown).toEqual(initialMeta.unknown);
    expect(fake.order).toEqual([
      'messages.read_context',
      'variables.read',
      'variables.read',
      'messages.update_content',
      'variables.commit',
      'variables.read',
    ]);
    expect(result.taskResult.status).toBe('committed');
    expect(result.taskResult.settlements).toHaveLength(2);
    expect(new Set(result.taskResult.settlements.map((item: JsonRecord) => item.sequence))).toEqual(new Set([11, 12]));
    expect(result.taskResult.notifications).toEqual([]);

    const sameSeedFake = fakeTavern({ message_id: 3, role: 'user', message: '用户正文' }, initialMeta);
    const sameSeed = await executeUpdateMk(step, sameSeedFake);
    expect(sameSeed.candidate.mk).toBe(result.candidate.mk);
  });

  it('swipe 只扫描和改写当前激活文本，不继承其他 swipe 的旧 MK', async () => {
    const fake = fakeTavern(
      {
        message_id: 1,
        role: 'assistant',
        swipes: [`旧分支\n${mkBlock('stale-swipe')}`, '当前激活分支'],
        swipe_id: 1,
      },
      { SelectedMks: [null, 'stale-swipe'], EditLogs: {} },
    );
    const result = await executeUpdateMk(updateMkStep(21), fake);
    expect(result.candidate.mk).not.toBe('stale-swipe');
    expect(fake.state.message.swipes[0]).toContain('stale-swipe');
    expect(fake.state.message.swipes[1]).toContain(result.candidate.mk);
    expect(fake.state.meta.SelectedMks[1]).toBe(result.candidate.mk);
  });

  it('默认设置会在非用户消息的 MK 块后追加占位符，并请求受影响消息刷新', async () => {
    const fake = fakeTavern(
      { message_id: 1, role: 'assistant', mes: `正文\n${mkBlock('mk-existing')}` },
      { SelectedMks: [null, 'mk-existing'], EditLogs: {} },
    );
    const result = await executeUpdateMk(updateMkStep(29), fake);
    expect(result.route).toBe('commit');
    expect(result.outcome).toMatchObject({
      status: 'committed',
      messageChanged: true,
      variablesChanged: false,
    });
    expect(fake.state.message.mes).toBe(`正文\n${mkBlock('mk-existing')}\n<StatusPlaceHolderImpl/>`);
    expect(fake.counters.refreshAffectedWrites).toBe(1);
  });

  it('关闭占位符后，已有消息 MK 但 SelectedMks 不符时只提交变量并回读确认', async () => {
    const fake = fakeTavern(
      { message_id: 2, role: 'assistant', mes: `正文\n${mkBlock('mk-current')}` },
      { SelectedMks: [null, null, 'mk-stale'], EditLogs: {}, unknown: 1 },
      { scriptVariables: { 在ai消息尾部生成特殊符号: false } },
    );
    const result = await executeUpdateMk(updateMkStep(31), fake);
    expect(result.route).toBe('commit');
    expect(result.outcome).toMatchObject({ status: 'committed', messageChanged: false, variablesChanged: true });
    expect(fake.counters.messageUpdates).toBe(0);
    expect(fake.counters.variableCommits).toBe(1);
    expect(fake.state.meta).toEqual({
      SelectedMks: [null, null, 'mk-current'],
      EditLogs: {},
      unknown: 1,
    });
  });

  it('消息写入失败是普通 failed，且绝不调用 variables.commit', async () => {
    const fake = fakeTavern(
      { message_id: 0, role: 'assistant', message: '正文' },
      { SelectedMks: [], EditLogs: {} },
      { messageFailure: 'throw' },
    );
    const result = await executeUpdateMk(updateMkStep(41), fake);
    expect(result.outcome).toMatchObject({
      status: 'failed',
      messageChanged: false,
      variablesChanged: false,
      failure: { code: 'ERA_UPDATE_MK_MESSAGE_COMMIT_FAILED' },
    });
    expect(result.taskResult.status).toBe('failed');
    expect(result.taskResult.settlements[0]).toMatchObject({
      status: 'failed',
      error: { code: 'ERA_UPDATE_MK_MESSAGE_COMMIT_FAILED' },
    });
    expect(fake.counters.variableCommits).toBe(0);
    expect(fake.counters.variableReads).toBe(2);
  });

  it('消息已确认后变量失败进入 fatal，不伪报部分成功', async () => {
    const fake = fakeTavern(
      { message_id: 0, role: 'assistant', message: '正文' },
      { SelectedMks: [], EditLogs: {}, unknown: true },
      { variableFailure: 'throw' },
    );
    const result = await executeUpdateMk(updateMkStep(51), fake);
    expect(result.outcome).toMatchObject({
      status: 'fatal',
      messageChanged: true,
      variablesChanged: false,
      failure: { code: 'ERA_UPDATE_MK_VARIABLES_COMMIT_FAILED' },
    });
    expect(result.taskResult.status).toBe('fatal');
    expect(result.taskResult.settlements[0].status).toBe('failed');
    expect(fake.state.message.message).toContain('era_mk_');
    expect(fake.state.meta.SelectedMks).toEqual([]);
  });

  it('取消消息写入后忽略迟到结果，不启动变量写入并结算 cancelled', async () => {
    const fake = fakeTavern(
      { message_id: 0, role: 'assistant', message: '正文' },
      { SelectedMks: [], EditLogs: {} },
      { messageFailure: 'cancel-late' },
    );
    const result = await executeUpdateMk(updateMkStep(61), fake);
    await Promise.resolve();
    expect(result.outcome).toMatchObject({
      status: 'failed',
      failure: { code: 'ERA_UPDATE_MK_MESSAGE_CANCELLED', category: 'cancelled' },
    });
    expect(result.taskResult.settlements[0]).toMatchObject({ status: 'cancelled', sequence: 61 });
    expect(fake.counters.lateResults).toBe(1);
    expect(fake.counters.variableCommits).toBe(0);
    expect(fake.counters.variableReads).toBe(2);
  });
});
