import { describe, expect, it } from 'vitest';
import { run as advance } from '../../../javascript_project/service/nodes/sync/drive_message_blocks';
import { prepare } from '../../../javascript_project/service/nodes/sync/prepare_block_step';
import { run as prepareWork } from '../../../javascript_project/service/nodes/sync/prepare_block_work';
import { run as build } from '../../../javascript_project/service/nodes/sync/build_block_commit';
import { run as commit } from '../../../javascript_project/service/nodes/sync/commit_sync';
import { run as fold } from '../../../javascript_project/service/nodes/sync/fold_block_commit';
import { finalize } from '../../../javascript_project/service/nodes/sync/finalize_block_step';
import { applySealedCommandCompactionToWork } from '../../../javascript_project/service/base_lib/command_compaction';
import { recordFor } from '../../../javascript_project/service/base_lib/sidecar_binding';
import { planEraSync } from '../../../javascript_project/service/base_lib/domain/sync_engine';
import * as preparation from '../../../javascript_project/service/base_lib/dispatch_preparation';
const identity = { characterId: 'card-a', chatId: 'chat-a', groupId: null };
const sidecarId = 'era_chat_12345678-1234-4234-8234-123456789abc';
function contextWith(text: string, statData: Record<string, unknown> = { hp: 100 }, syncCursor: unknown = undefined) {
  const context: any = {
    schemaVersion: 1,
    step: {
      kind: 'execute',
      stepId: 's1',
      index: 0,
      taskRoute: 'sync',
      sourceSequences: [1],
      events: [],
      task: {
        id: 't1',
        kind: 'sync',
        reason: 'manual',
        target: { kind: 'auto' },
        fullRebuild: false,
        context: 'latest-message-with-mk',
        primaryEvent: {
          schemaVersion: 1,
          eventId: 'e1',
          sequence: 1,
          type: 'manual_sync',
          occurredAt: 1,
          source: 'tavern',
          args: [],
          encodedBytes: 2,
        },
        sourceEvents: [],
      },
      sources: [
        {
          relation: 'primary',
          event: {
            schemaVersion: 1,
            eventId: 'e1',
            sequence: 1,
            type: 'manual_sync',
            occurredAt: 1,
            source: 'tavern',
            args: [],
            encodedBytes: 2,
          },
        },
      ],
      dispatchContext: {
        schemaVersion: 3,
        floorIdentity: null,
        agentFloorCandidate: null,
        sourceBasis: {
          identity,
          messages: [{ schemaVersion: 1, messageId: 1, role: 'assistant', activeText: text, swipeIndex: 0 }],
        },
        status: 'ready',
        dispatchClass: 'sync',
        requirement: 'latest-message-with-mk',
        messages: [{ schemaVersion: 1, messageId: 1, role: 'assistant', activeText: text, swipeIndex: 0 }],
        processingMessage: {
          schemaVersion: 1,
          messageId: 1,
          role: 'assistant',
          activeText: text,
          swipeIndex: 0,
        },
        processingMk: 'mk-1',
        messageChanged: false,
        variablesChanged: false,
        failure: null,
      },
    },
    consecutive: { mk: null, count: 0 },
    status: 'ready',
    messagesRaw: [
      {
        schemaVersion: 1,
        messageId: 1,
        role: 'assistant',
        swipeIndex: 0,
        activeText: text,
      },
    ],
    variablesRaw: {
      stat_data: statData,
      statFunc: {},
      ERAMetaData: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
    },
    failure: null,
    ...(syncCursor === undefined ? {} : { syncCursor }),
  };
  const seed = preparation.classifyDispatch(context.step, {
    schemaVersion: 1,
    nextState: { consecutiveMk: null, consecutiveProcessingCount: 0 },
  } as any).seed;
  const planned = preparation.planDispatchPreparation(
    preparation.canonicalDispatchContext(
      seed,
      { schemaVersion: 2, messages: context.messagesRaw },
      { variables: {} },
      { variables: { 在ai消息尾部生成特殊符号: false } },
      identity,
    ),
  );
  context.step.dispatchContext = preparation.dispatchContextOf(preparation.preserveDispatchPreparation(planned));
  context.messagesRaw = context.step.dispatchContext.messages;
  return context;
}

async function execute(text: string, options: { failAt?: number; staleAt?: number; context?: any; max?: number } = {}) {
  const context = options.context ?? contextWith(text);
  let state = prepare({ 'era.sync.context': { value: context } }).block_step_state;
  let stored: any = recordFor(
    sidecarId,
    identity,
    {
      statData: context.variablesRaw.stat_data,
      statFunc: context.variablesRaw.statFunc,
      eraMeta: context.variablesRaw.ERAMetaData,
    },
    null,
  );
  let currentText = context.step.dispatchContext.sourceBasis.messages[0].activeText;
  const saves: any[] = [];
  const publications: any[] = [];
  let attempts = 0;
  let messageAttempts = 0;
  const capabilities = {
    'era.tavern.messages': {
      update_content: async (input: any) => {
        messageAttempts += 1;
        if (messageAttempts === options.staleAt)
          throw Object.assign(new Error('edited'), { code: 'ERA_MESSAGE_WRITE_TARGET_CHANGED' });
        expect(input.sourceBasis.messages[0].activeText).toBe(currentText);
        currentText = input.updates[0]?.message ?? currentText;
        return { status: 'committed' };
      },
    },
    'era.tavern.sidecar': {
      read_current: async () => ({ identity, meta: { SidecarId: sidecarId }, stat: null }),
      read_record: async () => ({ status: 'found', record: stored }),
      write_record: async (input: any) => {
        attempts += 1;
        if (attempts === options.failAt) throw new Error('injected-save-failure');
        stored = input.record;
        saves.push(structuredClone(stored));
        return { status: 'committed' };
      },
      commit_metadata: async (input: any) => {
        publications.push(input);
        return { status: 'committed' };
      },
      present_prompt: () => undefined,
    },
  };
  let iterations = 0;
  do {
    const pending = advance({ 'era.sync.block.step.state': { value: state } }).block_step_pending;
    const work = prepareWork({ 'era.sync.block.step.pending': { value: pending } }).expression_command_result;
    const request = build({
      'era.command_compaction.result': { value: applySealedCommandCompactionToWork(work) },
    }).block_commit_request;
    const outcome = (await commit({ 'era.tavern.commit.request': { value: request } }, {}, { capabilities }))
      .sync_commit_result;
    const folded = fold({ 'era.tavern.commit.result': { value: outcome } });
    state = folded.folded_block_step_state;
    iterations += 1;
    if (iterations > 200) throw new Error('loop did not terminate');
  } while (!state.done && iterations < (options.max ?? Infinity));
  return {
    state,
    saves,
    publications,
    stored,
    currentText,
    outcome: finalize({ 'era.sync.block.step.state.next': { value: state } }).completed_sync_result,
  };
}

describe('正式节点单块保存链', () => {
  it('正式提交构造拒绝错配的公开消息身份，保持可恢复失败', () => {
    const context = contextWith('<VariableEdit>{"hp":70}</VariableEdit>');
    const state = prepare({ 'era.sync.context': { value: context } }).block_step_state;
    const pending = advance({ 'era.sync.block.step.state': { value: state } }).block_step_pending;
    const work = prepareWork({ 'era.sync.block.step.pending': { value: pending } }).expression_command_result;
    const request = build({
      'era.command_compaction.result': { value: { ...work, payload: { ...work.payload, mk: 'wrong-floor' } } },
    }).block_commit_request;
    expect(request.mode).toBe('non-commit');
    expect(request.work.failure.code).toBe('ERA_SYNC_COMMIT_CONTRACT_INVALID');
    expect(request.work.blockStepState.done).toBe(true);
    expect(request.work.plan).toBeNull();
  });

  it('首块来源改变时不发布未提交的候选状态', async () => {
    const result = await execute('<VariableEdit>{"hp":70}</VariableEdit>', { staleAt: 1 });
    expect(result.saves).toHaveLength(0);
    expect(result.outcome.work.plan).toBeNull();
    expect(result.outcome.work.disposition).toBe('no-op');
  });
  it('后块来源改变时只保留最后成功块的状态和游标', async () => {
    const result = await execute('<VariableEdit>{"hp":70}</VariableEdit><VariableEdit>{"hp":5}</VariableEdit>', {
      staleAt: 2,
    });
    expect(result.saves).toHaveLength(1);
    expect(result.outcome.work.plan.stat.hp).toBe(70);
    expect(result.outcome.work.syncCursor).not.toBeNull();
  });

  it('超过64块逐个保存，最后一次清除进度且尾链不写状态', async () => {
    const result = await execute(
      Array.from({ length: 100 }, () => '<VariableEdit>{"hp":{"$expr":"hp+1"}}</VariableEdit>').join(''),
    );
    expect(result.saves).toHaveLength(101);
    expect(result.saves[0].state.statData.hp).toBe(101);
    expect(result.stored.state.statData.hp).toBe(200);
    expect(result.currentText).not.toContain('era_block');
    expect(result.outcome.syncCursor).toBe(null);
  });
  it('消息起点快照不随当前值更新', async () => {
    const result = await execute(
      '<VariableEdit>{"hp":70}</VariableEdit><VariableEdit>{"hp":{"$expr":"@hp*2"}}</VariableEdit>',
    );
    expect(result.stored.state.statData.hp).toBe(200);
  });
  it('无 done 调用失败，保留前块进度且不执行后块；旧操作区不能代替 done', async () => {
    const result = await execute(
      '<VariableEdit>{"hp":70}</VariableEdit><EraFCall name="a" id="c"/><EraFCallTx for="c"><VariableEdit>{"hp":5}</VariableEdit></EraFCallTx>',
    );
    expect(result.outcome.work.failure.code).toBe('ERA_FCALL_NOT_IMPLEMENTED');
    expect(result.stored.state.statData.hp).toBe(70);
    expect(result.currentText).toContain('era_block');
    expect(result.currentText).not.toContain('status="done"');
  });
  it('done 调用跳过，旧 applied 操作区中的普通操作照常应用', async () => {
    const result = await execute(
      '<EraFCall name="a" status="done"/><EraFCallTx for="c" applied="1"><VariableEdit>{"hp":70}</VariableEdit></EraFCallTx><VariableEdit>{"hp":{"$expr":"hp*2"}}</VariableEdit>',
    );
    expect(result.stored.state.statData.hp).toBe(140);
    expect(result.currentText).toContain('status="done"');
  });
  it.each([2, 3, 4])('第 %i 次保存失败留下完整日志，可由新上下文重算恢复', async failAt => {
    const text = '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>'.repeat(3);
    const failed = await execute(text, { failAt });
    expect(failed.outcome.work.disposition).toBe('failed');
    expect(failed.stored.state.statData.hp).toBe(100 - Math.min(failAt - 1, 3) * 10);
    const fresh = contextWith(failed.currentText, failed.stored.state.statData);
    fresh.variablesRaw.ERAMetaData = failed.stored.state.eraMeta;
    const resumed = await execute(failed.currentText, { context: fresh });
    expect(resumed.stored.state.statData.hp).toBe(70);
    expect(resumed.currentText).not.toContain('era_block');
    const replay = planEraSync({
      messages: [{ messageId: 1, role: 'assistant', content: { kind: 'text', text: resumed.currentText } }],
      stat: resumed.stored.state.statData,
      statFunc: {},
      meta: resumed.stored.state.eraMeta,
      reason: 'manual',
      processingMk: null,
      consecutiveState: null,
    });
    expect(replay.stat).toEqual(resumed.stored.state.statData);
  });
});

describe('逐块表达式与刷新一致性', () => {
  it('函数库快照 @f 与当前 f 分开', async () => {
    const text =
      '<FunctionEdit>{"f":{"params":["x"],"expr":"x*3"}}</FunctionEdit><VariableEdit>{"hp":{"$expr":"@f(hp)"}}</VariableEdit>';
    const context = contextWith(text);
    context.variablesRaw.statFunc = { f: { params: ['x'], expr: 'x*2' } };
    const result = await execute(text, { context });
    expect(result.stored.state.statData.hp).toBe(200);
    expect(result.stored.state.statFunc.f.expr).toBe('x*3');
  });
  it('连续随机抽取在完整执行、重载与历史重算中一致', async () => {
    const text = '<VariableEdit>{"hp":{"$expr":"random()"}}</VariableEdit>'.repeat(4);
    const whole = await execute(text);
    const prefix = await execute(text, { max: 2 });
    const fresh = contextWith(prefix.currentText, prefix.stored.state.statData);
    fresh.variablesRaw.ERAMetaData = prefix.stored.state.eraMeta;
    const resumed = await execute(prefix.currentText, { context: fresh });
    expect(resumed.stored.state.statData).toEqual(whole.stored.state.statData);
    expect(resumed.stored.state.statData.hp).not.toBe(100);
    const replay = planEraSync({
      messages: [{ messageId: 1, role: 'assistant', content: { kind: 'text', text: resumed.currentText } }],
      stat: resumed.stored.state.statData,
      statFunc: {},
      meta: resumed.stored.state.eraMeta,
      reason: 'manual',
      processingMk: null,
      consecutiveState: null,
    });
    expect(replay.stat).toEqual(whole.stored.state.statData);
  });
});

it('正式逐块提交只在消息清理进度后通知订阅者', async () => {
  const result = await execute('<VariableEdit>{"hp":70}</VariableEdit><VariableEdit>{"hp":80}</VariableEdit>');
  expect(result.publications.length).toBeGreaterThanOrEqual(3);
  expect(result.publications.slice(0, -1).every(item => item.notifySubscribers === false)).toBe(true);
  expect(result.publications.at(-1).notifySubscribers).toBe(true);
  expect(result.currentText).not.toContain('<era_block');
});
