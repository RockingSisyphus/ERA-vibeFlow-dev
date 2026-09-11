/**
 * 消息内函数调用的交接与恢复接线。
 *
 * 覆盖两段真实接线：交接工作项必须投影为 Host 后置通知；恢复事件必须把调用标记与
 * 操作区写进处理楼层文本，让既有重放链按原文位置应用函数产出。
 */

import { describe, expect, it } from 'vitest';

const preparationUrl = new URL('../../../javascript_project/service/base_lib/dispatch_preparation.ts', import.meta.url)
  .href;
const policyUrl = new URL('../../../javascript_project/service/base_lib/sync_result_policy.ts', import.meta.url).href;
const commitPolicyUrl = new URL('../../../javascript_project/service/base_lib/sync_commit_policy.ts', import.meta.url)
  .href;
const prepareUrl = new URL('../../../javascript_project/service/nodes/sync/prepare_block_step.ts', import.meta.url).href;
const driveUrl = new URL('../../../javascript_project/service/nodes/sync/drive_message_blocks.ts', import.meta.url).href;
const finalizeUrl = new URL('../../../javascript_project/service/nodes/sync/finalize_block_step.ts', import.meta.url).href;

const preparation = await import(/* @vite-ignore */ preparationUrl);
const policy = await import(/* @vite-ignore */ policyUrl);
const commitPolicy = await import(/* @vite-ignore */ commitPolicyUrl);
const prepareBlocks = (await import(/* @vite-ignore */ prepareUrl)).prepare;
const driveBlocks = (await import(/* @vite-ignore */ driveUrl)).run;
const finalizeBlocks = (await import(/* @vite-ignore */ finalizeUrl)).finalize;

type JsonRecord = Record<string, any>;

const CALL_TEXT = [
  '<VariableInsert>{"hp":100}</VariableInsert>',
  '<EraFCall name="attack" args=\'{"damage":30}\' id="c1"/>',
  '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
].join('\n');

/** 同一楼层里两处同名同参调用：第二处交接必须能读到第一处的记录。 */
const TWO_CALL_TEXT = [
  '<VariableInsert>{"mfc":{"hp":100}}</VariableInsert>',
  '<EraFCall name="echo" args=\'{"v":"x"}\' id="c1"/>',
  '<EraFCall name="echo" args=\'{"v":"x"}\' id="c2"/>',
].join('\n');

const IDENTITY = { characterId: 'char-1', groupId: null, chatId: 'chat-1' };

function syncStep(input: {
  readonly type: string;
  readonly args: readonly unknown[];
  readonly sequence: number;
  readonly source: string;
}) {
  const sourceEvent = {
    schemaVersion: 1,
    eventId: `event-${input.sequence}`,
    sequence: input.sequence,
    type: input.type,
    occurredAt: 1_000 + input.sequence,
    source: input.source,
    args: input.args,
    encodedBytes: 64,
  };
  return {
    kind: 'execute',
    stepId: `step:sync:${input.sequence}`,
    index: 0,
    taskRoute: 'sync',
    sourceSequences: [input.sequence],
    events: [sourceEvent],
    task: {
      id: `task:sync:${input.sequence}`,
      sourceEvents: [sourceEvent],
      primaryEvent: sourceEvent,
      context: 'latest-message-with-mk',
      kind: 'sync',
      reason: 'history-changed',
      target: { kind: 'auto' },
      fullRebuild: false,
    },
    sources: [{ event: sourceEvent, relation: 'primary' }],
  };
}

function continueStep(args: readonly unknown[]) {
  return syncStep({ type: 'era.message.invoke_continue', args, sequence: 1, source: 'era-api' });
}

function state(step: JsonRecord) {
  return {
    schemaVersion: 1,
    batchId: 'batch-1',
    throughSequence: 1,
    nextState: {
      schemaVersion: 1,
      collection: [],
      collectionBytes: 0,
      iteration: 1,
      consecutiveProcessingCount: 0,
      consecutiveMk: null,
      timerToken: null,
    },
    sources: [{ eventId: 'event-1', sequence: 1 }],
    steps: [step],
    index: 0,
    settlements: [],
    notifications: [],
    diagnostics: [],
    fatal: false,
    coverageError: null,
  };
}

function messages(activeText: string) {
  return {
    schemaVersion: 2,
    messages: [{ schemaVersion: 1, messageId: 2, role: 'assistant', activeText, swipeIndex: 1 }],
  };
}

function resumePayload(overrides: JsonRecord = {}) {
  return {
    messageId: 2,
    mk: '',
    callId: 'c1',
    status: 'completed',
    message: '',
    unregistered: false,
    operations: [{ edit: { hp: { $expr: 'hp - 30' } } }],
    ...overrides,
  };
}

function preparedPlan(step: JsonRecord, text = CALL_TEXT) {
  const seed = preparation.classifyDispatch(step, state(step)).seed;
  const canonical = preparation.canonicalDispatchContext(
    seed,
    messages(text),
    { variables: { ERAMetaData: { SelectedMks: ['mk-0', null] } } },
    { variables: {} },
  );
  return preparation.planDispatchPreparation(canonical);
}

/**
 * 跑一步真实的同步步骤：派发准备 → 块步进循环 → 收口。
 *
 * 与生产接线一致：`prepare_block_step` 吃 `SyncContextV1`（其 `dispatchContext` 由
 * `planDispatchPreparation` 产出），`drive_message_blocks` 每次只推进一个块，
 * `finalize_block_step` 决定提交还是交接。
 */
function stepOnce(input: {
  readonly step: JsonRecord;
  readonly text: string;
  readonly stat: JsonRecord;
  readonly meta: JsonRecord;
}) {
  const seed = preparation.classifyDispatch(input.step, state(input.step)).seed;
  const canonical = preparation.canonicalDispatchContext(
    seed,
    messages(input.text),
    { variables: { stat_data: input.stat, ERAMetaData: input.meta } },
    { variables: {} },
    IDENTITY,
  );
  const prepared = preparation.planDispatchPreparation(canonical);
  // 生产接线里 dispatchContext 由 `preserveDispatchPreparation → dispatchContextOf` 产出；
  // 少了这一步，messageChanged/variablesChanged 缺失，V3 上下文校验会拒绝它。
  const dispatch = preparation.dispatchContextOf(preparation.preserveDispatchPreparation(prepared));
  const context = {
    schemaVersion: 1,
    step: { ...input.step, dispatchContext: dispatch },
    consecutive: { mk: null, count: 0 },
    status: 'ready',
    messagesRaw: { schemaVersion: 2, messages: dispatch.messages },
    variablesRaw: { stat_data: input.stat, statFunc: {}, ERAMetaData: input.meta },
    failure: null,
  };
  let blockState = prepareBlocks({ 'era.sync.context': { value: context } }).block_step_state;
  let done = false;
  let guard = 0;
  while (!done && guard < 12) {
    const stepped = driveBlocks({ 'era.sync.block.step.state': { value: blockState } });
    blockState = stepped.block_step_state_next;
    done = stepped.block_step_done;
    guard += 1;
  }
  const finished = finalizeBlocks({ 'era.sync.block.step.state.next': { value: blockState } });
  return {
    route: finished.function_invocation_route as string,
    work: finished.expression_command_result as JsonRecord,
    blockState,
  };
}

/** 交接提交的请求必须能过真实提交契约校验；返回它写出的楼层文本。 */
function committedText(work: JsonRecord): string {
  const request = commitPolicy.buildSyncCommitRequest(work);
  expect(commitPolicy.validateSyncCommitEnvelope({ mode: 'commit', request }).route).toBe('valid');
  const write = request.messageWrites.find((item: JsonRecord) => item.messageId === 2);
  expect(write).toBeDefined();
  return write.content as string;
}

describe('消息内函数调用：交接与恢复接线', () => {
  it('交接事实投影为 Host 后置通知，且不带任何提交', () => {
    const step = continueStep([]);
    const work = {
      schemaVersion: 1,
      step,
      disposition: 'no-op',
      plan: null,
      payload: null,
      failure: null,
      handoff: {
        schemaVersion: 1,
        messageId: 2,
        mk: 'mk-1',
        blockIndex: 1,
        callId: 'c1',
        name: 'attack',
        args: { damage: 30 },
        stat: { hp: 100 },
        statFunc: {},
      },
    };

    const result = policy.buildSyncNonCommitResult(work);
    expect(result.status).toBe('no-op');
    // 未完成的消息不得推进连续处理状态，否则恢复批次会以为它已经处理过。
    expect(result.stateUpdate).toBeUndefined();
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].type).toBe('era.message.invoke_required');
    expect(result.notifications[0].args[0]).toMatchObject({
      kind: 'json',
      value: { callId: 'c1', name: 'attack', blockIndex: 1 },
    });
  });

  it('恢复事件把调用标记与操作区写进处理楼层文本', () => {
    const plan = preparedPlan(continueStep([{ kind: 'json', value: resumePayload() }]));

    expect(plan.status).toBe('ready');
    const text = plan.processingMessage.activeText;
    expect(text).toContain('status="done"');
    // 操作区不带 applied：它随消息重放才是函数效果唯一一次生效。
    expect(text).toContain('<EraFCallTx for="c1">');
    expect(text).not.toContain('applied="1"');
    expect(text).toContain('hp - 30');
    // 原文靠后的块保持在操作区之后，顺序不因注入而改变。
    expect(text.indexOf('<EraFCallTx')).toBeLessThan(text.indexOf('hp-10'));
    expect(plan.messageUpdate?.content).toBe(text);
  });

  it('恢复事件的身份只认 messageId：楼层对不上不写记录，MK 变化照常写记录', () => {
    const otherMessage = preparedPlan(continueStep([{ kind: 'json', value: resumePayload({ messageId: 9 }) }]));
    expect(otherMessage.processingMessage.activeText).not.toContain('<EraFCallTx');
    expect(otherMessage.processingMessage.activeText).not.toContain('status="done"');

    // MK 不是楼层身份：真机实测同一条楼层的两次交接 MK 不同，用它做等值判断会让记录被
    // 静默跳过、调用块永不标记，于是每轮同步都再交接一次（无限循环）。因此这里断言
    // 「MK 不同仍然写记录」，这是刻意行为而不是宽松匹配。
    const otherMk = preparedPlan(continueStep([{ kind: 'json', value: resumePayload({ mk: 'mk-other' }) }]));
    expect(otherMk.processingMessage.activeText).toContain('status="done"');
    expect(otherMk.processingMessage.activeText).toContain('<EraFCallTx for="c1">');
  });

  it('失败终态同样落成已处理记录，后续块照常继续', () => {
    const plan = preparedPlan(
      continueStep([
        {
          kind: 'json',
          value: resumePayload({ status: 'failed', message: 'boom', operations: [] }),
        },
      ]),
    );

    const text = plan.processingMessage.activeText;
    expect(text).toContain('error="ERA_FCALL_FAILED"');
    expect(text).toContain('<EraFCallTx for="c1"></EraFCallTx>');
  });

  it('非恢复事件不注入任何记录', () => {
    const step = continueStep([]);
    step.task.primaryEvent = { ...step.task.primaryEvent, type: 'manual_sync' };
    step.task.sourceEvents = [step.task.primaryEvent];
    step.events = [step.task.primaryEvent];
    step.sources = [{ event: step.task.primaryEvent, relation: 'primary' }];

    const plan = preparedPlan(step);
    expect(plan.processingMessage.activeText).not.toContain('<EraFCallTx');
    expect(plan.processingMessage.activeText).toContain('<EraFCall name="attack"');
  });
});

/**
 * 回归：同一楼层两处调用的交接必须前进。
 *
 * 曾经的缺陷（真机 MSG-FCALL-004）：交接批次什么都不提交，于是先前调用块上的
 * `status="done"` 随批次一起丢掉；恢复后仍停在同一处调用上，两处调用互相覆盖对方的
 * 标记，形成 41 次重复调用、零落盘的死循环。修法是交接批次提交**记录**（消息文本 +
 * 已落盘的操作区），状态停在已提交世界，恢复时整楼重放恰好一次。
 */
describe('同名同参两处调用：交接记录必须落盘，恢复必须前进', () => {
  it('第一步交接 c1 并把记录提交出去，第二步推进到 c2，第三步收口', () => {
    const stat = {};
    const meta = { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} };

    // 1. 收到新楼层：推进到 c1 并交接；本批次必须把记录写出去。
    const first = stepOnce({
      step: syncStep({ type: 'message_received', args: [], sequence: 1, source: 'tavern' }),
      text: TWO_CALL_TEXT,
      stat,
      meta,
    });
    expect(first.route).toBe('invoke');
    expect(first.work.disposition).toBe('commit');
    expect(first.work.handoff).toMatchObject({ callId: 'c1', name: 'echo' });
    // 状态停在已提交世界：本楼层的 VariableInsert 还没有提交。
    expect(first.work.plan.stat).toEqual({});
    // 未完成楼层不得推进连续处理事实。
    expect(first.work.plan.nextConsecutiveState).toEqual({ mk: null, count: 0 });
    const firstRequest = commitPolicy.buildSyncCommitRequest(first.work);
    expect(firstRequest.handoff).toMatchObject({ callId: 'c1' });
    // 交接提交不呈现楼层：这条楼层还没处理完。
    expect(firstRequest.initialPresentation).toBe(null);
    const textAfterFirst = committedText(first.work);

    // 2. c1 的函数回送：c1 的标记必须先落盘，本步推进到 c2 而不是再次 c1。
    const second = stepOnce({
      step: continueStep([{ kind: 'json', value: resumePayload() }]),
      text: textAfterFirst,
      stat,
      meta,
    });
    expect(second.route).toBe('invoke');
    expect(second.work.handoff).toMatchObject({ callId: 'c2' });
    const textAfterSecond = committedText(second.work);
    expect(textAfterSecond).toContain('status="done"');
    expect(textAfterSecond).toContain('<EraFCallTx for="c1">');

    // 3. c2 的函数回送：两处都处理完，本楼层收口，不再有交接。
    const third = stepOnce({
      step: continueStep([{ kind: 'json', value: resumePayload({ callId: 'c2' }) }]),
      text: textAfterSecond,
      stat,
      meta,
    });
    expect(third.route).toBe('none');
    expect(third.work.handoff).toBeUndefined();
    const finalText = third.work.plan.messageUpdates
      .map((update: JsonRecord) => update.content.text as string)
      .join('\n');
    expect(finalText).toContain('<EraFCallTx for="c1">');
    expect(finalText).toContain('<EraFCallTx for="c2">');
  });
});
