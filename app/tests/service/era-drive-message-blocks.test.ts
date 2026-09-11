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
        text,
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

  it('宿主能力可用时在此完成一次完整交接并回报终态', async () => {
    const released: unknown[] = [];
    const capability = {
      invoke: async (input: Readonly<Record<string, unknown>>) => ({
        status: 'accepted',
        invocationId: input.invocationId,
      }),
      result: async () => ({
        status: 'completed',
        name: 'attack',
        result: 'ok',
        message: '',
        unregistered: false,
        appliedCount: 1,
      }),
      release: (input: Readonly<Record<string, unknown>>) => {
        released.push(input.invocationId);
        return { released: true };
      },
    };

    const result = await run(
      {
        'era.sync.context': {
          value: contextWith(
            ['<VariableInsert>{"hp":100}</VariableInsert>', '<EraFCall name="attack" id="c1"/>'].join('\n'),
          ),
        },
      },
      {},
      { capabilities: { 'era.tavern.functions': capability } },
    );

    // 交接完成后不再需要外部执行：不再声称未完成，并带回终态。
    expect(result.message_incomplete).toBe(false);
    expect(result.function_outcome).toMatchObject({ status: 'completed' });
    expect(released).toHaveLength(1);
  });

  it('宿主能力不可用时保持待调用与未完成，不伪造成功', async () => {
    const result = await run({
      'era.sync.context': {
        value: contextWith(
          ['<VariableInsert>{"hp":100}</VariableInsert>', '<EraFCall name="attack" id="c1"/>'].join('\n'),
        ),
      },
    });

    expect(result.function_outcome).toBe(null);
    expect(result.message_incomplete).toBe(true);
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
