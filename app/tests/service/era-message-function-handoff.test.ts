/**
 * 消息内函数调用的交接与恢复接线。
 *
 * 覆盖两段真实接线：交接工作项必须投影为 Host 后置通知；恢复事件必须把调用标记与
 * 操作区写进处理楼层文本，让既有重放链按原文位置应用函数产出。
 */

import { describe, expect, it } from 'vitest';

const preparationUrl = new URL(
  '../../../javascript_project/service/base_lib/dispatch_preparation.ts',
  import.meta.url,
).href;
const policyUrl = new URL(
  '../../../javascript_project/service/base_lib/sync_result_policy.ts',
  import.meta.url,
).href;

const preparation = await import(/* @vite-ignore */ preparationUrl);
const policy = await import(/* @vite-ignore */ policyUrl);

type JsonRecord = Record<string, any>;

const CALL_TEXT = [
  '<VariableInsert>{"hp":100}</VariableInsert>',
  '<EraFCall name="attack" args=\'{"damage":30}\' id="c1"/>',
  '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
].join('\n');

function continueStep(args: readonly unknown[]) {
  const sourceEvent = {
    schemaVersion: 1,
    eventId: 'event-1',
    sequence: 1,
    type: 'era.message.invoke_continue',
    occurredAt: 1_001,
    source: 'era-api',
    args,
    encodedBytes: 64,
  };
  return {
    kind: 'execute',
    stepId: 'step:sync:1',
    index: 0,
    taskRoute: 'sync',
    sourceSequences: [1],
    events: [sourceEvent],
    task: {
      id: 'task:sync:1',
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
    messages: [
      { schemaVersion: 1, messageId: 2, role: 'assistant', activeText, swipeIndex: 1 },
    ],
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

  it('恢复事件的身份不匹配时保持待处理，不写入半份记录', () => {
    const otherMessage = preparedPlan(
      continueStep([{ kind: 'json', value: resumePayload({ messageId: 9 }) }]),
    );
    expect(otherMessage.processingMessage.activeText).not.toContain('<EraFCallTx');
    expect(otherMessage.processingMessage.activeText).not.toContain('status="done"');

    const otherMk = preparedPlan(
      continueStep([{ kind: 'json', value: resumePayload({ mk: 'mk-other' }) }]),
    );
    expect(otherMk.processingMessage.activeText).not.toContain('<EraFCallTx');
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
