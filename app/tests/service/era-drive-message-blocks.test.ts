import { describe, expect, it } from 'vitest';

import { run } from '../../../javascript_project/service/nodes/sync/drive_message_blocks';
import { prepare } from '../../../javascript_project/service/nodes/sync/prepare_block_step';
import { finalize } from '../../../javascript_project/service/nodes/sync/finalize_block_step';

function contextWith(text: string, statData: Record<string, unknown> = { hp: 100 }) {
  return {
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
        schemaVersion: 2,
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
        extra: {},
      },
    ],
    variablesRaw: {
      stat_data: statData,
      statFunc: {},
      ERAMetaData: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
    },
    failure: null,
  };
}

/** 从初始状态按块迭代，直到本次块驱动结束；返回每次迭代后的状态。 */
function driveToStop(text: string, statData?: Record<string, unknown>) {
  const context = contextWith(text, statData);
  let state = prepare({ 'era.sync.context': { value: context } }).block_step_state;
  const states: any[] = [];
  let done = false;
  let guard = 0;
  while (!done && guard < 12) {
    const stepped = run({
      'era.sync.block.step.state': { value: state },
    });
    state = stepped.block_step_state_next;
    done = stepped.block_step_done;
    states.push(state);
    guard += 1;
  }
  return { context, state, states };
}

describe('era.sync 块步进循环的三个节点', () => {
  it('prepare 从已提交侧车状态建立初始状态', () => {
    const context = contextWith('<VariableInsert>{"gold":5}</VariableInsert>', { hp: 100 });
    const prepared = prepare({ 'era.sync.context': { value: context } });

    expect(prepared.block_step_state).toMatchObject({
      messageId: 1,
      mk: 'mk-1',
      blockIndex: 0,
      done: false,
      stat: { hp: 100 },
      route: 'none',
      handoff: null,
    });
  });

  it('每次迭代只推进一个块，累计状态随状态传递', () => {
    const { states } = driveToStop(
      ['<VariableInsert>{"gold":5}</VariableInsert>', '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>'].join(
        '\n',
      ),
    );

    // 第一块只插入 gold；第二块才把 hp 减到 70：一步一块，状态逐次累积。
    expect(states[0]).toMatchObject({ blockIndex: 1, stat: { hp: 100, gold: 5 }, done: false });
    expect(states[1]).toMatchObject({ blockIndex: 2, stat: { hp: 70, gold: 5 }, done: true });
  });

  it('遇到无标记调用即断开本批次，并把调用位置写成交接事实', () => {
    const { state } = driveToStop(
      [
        '<VariableInsert>{"gold":5}</VariableInsert>',
        '<EraFCall name="attack" args=\'{"damage":30}\' id="c1"/>',
        '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
      ].join('\n'),
    );

    expect(state.route).toBe('invoke');
    expect(state.handoff).toMatchObject({
      messageId: 1,
      mk: 'mk-1',
      callId: 'c1',
      name: 'attack',
      args: { damage: 30 },
      // 位置状态必须包含调用之前的块效果。
      stat: { hp: 100, gold: 5 },
    });
  });

  it('已处理的调用被跳过，不产生新的交接', () => {
    const { state } = driveToStop(
      [
        '<EraFCall name="attack" id="c1" status="done"/>',
        '<EraFCallTx for="c1">',
        '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
        '</EraFCallTx>',
      ].join('\n'),
    );

    expect(state.route).toBe('none');
    expect(state.done).toBe(true);
    // 操作区按位置重放：100 - 30 = 70。
    expect(state.stat).toMatchObject({ hp: 70 });
  });

  it('finalize 在没有交接时使用既有规划库的工作项', () => {
    const { state } = driveToStop('<VariableInsert>{"gold":5}</VariableInsert>');
    const finished = finalize({
      'era.sync.block.step.state.next': { value: state },
    });

    expect(finished.function_invocation_route).toBe('none');
    expect(finished.expression_command_result.schemaVersion).toBe(1);
    expect(['no-op', 'commit', 'failed']).toContain(finished.expression_command_result.disposition);
  });

  it('finalize 在有待交接调用时把工作项声明为不提交', () => {
    const { state } = driveToStop(
      ['<VariableInsert>{"gold":5}</VariableInsert>', '<EraFCall name="attack" id="c1"/>'].join('\n'),
    );
    const finished = finalize({
      'era.sync.block.step.state.next': { value: state },
    });

    // 函数效果只能由操作区记录带来：本批次不得提交任何状态。
    expect(finished.function_invocation_route).toBe('invoke');
    expect(finished.expression_command_result.disposition).toBe('no-op');
    expect(finished.expression_command_result.plan).toBe(null);
    expect(finished.expression_command_result.payload).toBe(null);
    expect(finished.expression_command_result.handoff).toMatchObject({
      callId: 'c1',
      name: 'attack',
    });
  });

  it('没有处理楼层时不空转，也不伪造工作项结论', () => {
    const context = contextWith('纯故事。');
    delete (context.step.dispatchContext as Record<string, unknown>).processingMessage;
    const prepared = prepare({ 'era.sync.context': { value: context } });

    expect(prepared.block_step_state).toMatchObject({ done: true, blockIndex: 0, route: 'none' });
  });
});
