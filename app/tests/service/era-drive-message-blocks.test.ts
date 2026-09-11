import { describe, expect, it } from 'vitest';

import { run } from '../../../javascript_project/service/nodes/sync/drive_message_blocks';

function contextWith(text: string) {
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
        messages: [
          {
            schemaVersion: 1,
            messageId: 1,
            role: 'assistant',
            activeText: text,
            swipeIndex: 0,
          },
        ],
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
      stat_data: { hp: 100 },
      statFunc: {},
      ERAMetaData: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
    },
    failure: null,
  };
}

describe('era.sync.drive_message_blocks 节点', () => {
  it('产出同步工作项与函数调用路由，供下游既有节点消费', async () => {
    const result = await run({
      'era.sync.context': { value: contextWith('<VariableInsert>{"hp":100}</VariableInsert>') },
    });

    expect(result.expression_command_result).toBeTruthy();
    expect(result.expression_command_result.schemaVersion).toBe(1);
    expect(result.function_invocation_route).toBe('none');
  });

  it('无可执行块时路由为 none，且不改写工作项', async () => {
    const result = await run({
      'era.sync.context': { value: contextWith('纯故事，没有指令块。') },
    });

    expect(result.function_invocation_route).toBe('none');
    expect(result.pending_function_call).toBe(null);
    // 工作项原样来自登记规划库：本节点只做块驱动，不伪造同步结论。
    expect(result.expression_command_result.schemaVersion).toBe(1);
    expect(['no-op', 'commit', 'failed']).toContain(result.expression_command_result.disposition);
  });

  it('遇到无标记调用时路由为 invoke，并报出待调用块', async () => {
    const result = await run({
      'era.sync.context': {
        value: contextWith(
          ['<VariableInsert>{"hp":100}</VariableInsert>', '<EraFCall name="attack" id="c1"/>'].join('\n'),
        ),
      },
    });

    expect(result.function_invocation_route).toBe('invoke');
    expect(result.pending_function_call).toMatchObject({ callId: 'c1', name: 'attack' });
  });

  it('游标反映按块推进到的位置，而不是停在起点', async () => {
    const result = await run({
      'era.sync.context': {
        value: contextWith(
          ['<VariableInsert>{"hp":100}</VariableInsert>', '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>'].join(
            '\n',
          ),
        ),
      },
    });

    // 两个指令块都已推进：游标应越过它们，而不是停在 0。
    expect(result.block_cursor.blockIndex).toBeGreaterThan(0);
    expect(result.block_cursor.done).toBe(true);
  });

  it('有未处理调用时明确回报「未完成」，不得声称本消息处理完毕', async () => {
    const result = await run({
      'era.sync.context': {
        value: contextWith(
          [
            '<VariableInsert>{"hp":100}</VariableInsert>',
            '<EraFCall name="attack" id="c1"/>',
            '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
          ].join('\n'),
        ),
      },
    });

    // 调用未执行，因此这条消息**没有**处理完：游标不得报 done。
    expect(result.function_invocation_route).toBe('invoke');
    expect(result.block_cursor.done).toBe(false);
    expect(result.message_incomplete).toBe(true);
  });

  it('没有待调用时才算本消息处理完毕', async () => {
    const result = await run({
      'era.sync.context': {
        value: contextWith('<VariableInsert>{"hp":100}</VariableInsert>'),
      },
    });

    expect(result.block_cursor.done).toBe(true);
    expect(result.message_incomplete).toBe(false);
  });

  it('交接工作项声明为不提交，并携带调用位置事实', async () => {
    const result = await run({
      'era.sync.context': {
        value: contextWith(
          [
            '<VariableInsert>{"gold":5}</VariableInsert>',
            '<EraFCall name="attack" args=\'{"damage":30}\' id="c1"/>',
            '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
          ].join('\n'),
        ),
      },
    });

    // 函数效果只能由它自己的操作区记录带来，因此本批次不得提交任何状态。
    const work = result.expression_command_result;
    expect(work.disposition).toBe('no-op');
    expect(work.plan).toBe(null);
    expect(work.failure).toBe(null);
    expect(work.handoff).toMatchObject({
      messageId: 1,
      mk: 'mk-1',
      callId: 'c1',
      name: 'attack',
      args: { damage: 30 },
    });
    expect(result.function_handoff).toMatchObject({ callId: 'c1' });
  });

  it('交接事实里的位置状态包含调用之前的块效果', async () => {
    const result = await run({
      'era.sync.context': {
        value: contextWith(
          [
            '<VariableInsert>{"gold":5}</VariableInsert>',
            '<EraFCall name="attack" id="c1"/>',
          ].join('\n'),
        ),
      },
    });

    // 函数读取的是自己所在位置的状态：已提交基线 + 本条消息调用之前的块。
    expect(result.function_handoff.stat).toEqual({ hp: 100, gold: 5 });
    expect(result.block_cursor.done).toBe(false);
  });

  it('报出块步进游标，作为跨步骤续做的依据', async () => {
    const result = await run({
      'era.sync.context': {
        value: contextWith('<VariableInsert>{"hp":100}</VariableInsert>'),
      },
    });

    expect(result.block_cursor).toMatchObject({
      messageId: 1,
      blockIndex: expect.any(Number),
    });
    expect(result.block_cursor.done).toBe(true);
  });
});
