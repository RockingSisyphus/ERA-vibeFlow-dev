import { describe, expect, it } from 'vitest';

import { applyMessageCommands } from '../../../javascript_project/service/base_lib/domain/crud_engine';

import {
  appliedCommandPrefix,
  advanceEraBlockSession,
  createEraBlockCursor,
  describeEraFunctionCallBlock,
  findUnprocessedEraFunctionCalls,
  hasAppliedBlockRecords,
  parseEraFunctionCalls,
  parseMessageBlocks,
  renderEraFunctionCallOperationsRegion,
  startEraBlockSession,
  unwrapAppliedRecords,
  wrapBlockAsAppliedRecord,
  type EraFunctionCallSite,
} from '../../../javascript_project/service/base_lib/domain/message_function_calls';

const CALL_WITH_REGION = [
  '<EraFCall name="dice" id="c1"/>',
  '<EraFCallTx for="c1">',
  '<VariableEdit>{"hp":{"$expr":"hp-1"}}</VariableEdit>',
  '</EraFCallTx>',
].join('\n');

function site(overrides: Partial<EraFunctionCallSite>): EraFunctionCallSite {
  const base = {
    callId: 'c1',
    name: 'dice',
    args: {},
    processed: false,
    nested: false,
    operationsRegionId: null,
    error: null,
    start: 0,
    end: 0,
    diagnostics: [],
  };
  return { ...base, ...overrides } as EraFunctionCallSite;
}

describe('ERA 消息内函数调用：调用块解析', () => {
  it('解析顶层自闭合调用块并保留名称、参数与锚点', () => {
    const calls = parseEraFunctionCalls('<EraFCall name="attack" args=\'{"damage":30}\' id="c1"/>');

    expect(calls).toHaveLength(1);
    expect(calls[0].callId).toBe('c1');
    expect(calls[0].name).toBe('attack');
    expect(calls[0].args).toEqual({ damage: 30 });
    expect(calls[0].processed).toBe(false);
    expect(calls[0].error).toBe(null);
  });

  it('大小写不敏感，且无 args 时默认为空对象', () => {
    const calls = parseEraFunctionCalls('<erafcall name="dice"/>');

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('dice');
    expect(calls[0].args).toEqual({});
  });

  it('缺少 name 或 name 为空时报诊断且不产生可执行调用', () => {
    const calls = parseEraFunctionCalls('<EraFCall args=\'{"a":1}\'/>');

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe(null);
    expect(calls[0].diagnostics.map(item => item.code)).toContain('ERA_FCALL_NAME_REQUIRED');
  });

  it('args 不是 JSON 对象时报诊断且不产生可执行参数', () => {
    const calls = parseEraFunctionCalls('<EraFCall name="dice" args=\'[1,2]\'/>');

    expect(calls).toHaveLength(1);
    expect(calls[0].args).toBe(null);
    expect(calls[0].diagnostics.map(item => item.code)).toContain('ERA_FCALL_ARGS_INVALID');
  });

  it('无标记调用未处理；status="done" 视为已处理', () => {
    const pending = parseEraFunctionCalls('<EraFCall name="dice"/>');
    const handled = parseEraFunctionCalls('<EraFCall name="dice" status="done"/>');

    expect(pending[0].processed).toBe(false);
    expect(handled[0].processed).toBe(true);
  });

  it('下方紧邻操作区存在时视为已处理，空操作区同样成立', () => {
    const withRegion = parseEraFunctionCalls(CALL_WITH_REGION);
    const withEmptyRegion = parseEraFunctionCalls(
      '<EraFCall name="dice" id="c1"/>\n<EraFCallTx for="c1"></EraFCallTx>',
    );

    expect(withRegion[0].processed).toBe(true);
    expect(withRegion[0].operationsRegionId).toBe('c1');
    expect(withEmptyRegion[0].processed).toBe(true);
  });

  it('操作区不属于自己的调用块时不算已处理', () => {
    const calls = parseEraFunctionCalls('<EraFCall name="dice" id="c1"/>\n<EraFCallTx for="c2"></EraFCallTx>');

    expect(calls[0].processed).toBe(false);
    expect(calls[0].operationsRegionId).toBe(null);
  });

  it('嵌套在六类指令块内部的调用块报诊断且不执行', () => {
    const calls = parseEraFunctionCalls('<VariableEdit>{"note":"<EraFCall name=\\"dice\\"/>"}</VariableEdit>');

    expect(calls).toHaveLength(1);
    expect(calls[0].nested).toBe(true);
    expect(calls[0].diagnostics.map(item => item.code)).toContain('ERA_FCALL_NESTED');
  });

  it('两个同名同参调用各自独立，不按名称或参数去重', () => {
    const calls = parseEraFunctionCalls(
      '<EraFCall name="dice" args=\'{"n":1}\'/>\n<EraFCall name="dice" args=\'{"n":1}\'/>',
    );

    expect(calls).toHaveLength(2);
    expect(calls[0].start).toBeLessThan(calls[1].start);
  });
});

describe('ERA 消息内函数调用：块序列', () => {
  it('六类指令与调用块合并为按原文位置有序的块列表', () => {
    const blocks = parseMessageBlocks({
      content: [
        '<VariableInsert>{"hp":100}</VariableInsert>',
        '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
        '<EraFCall name="attack" id="c1"/>',
        '<VariableDelete>{"tmp":true}</VariableDelete>',
      ].join('\n'),
    });

    expect(blocks.map(block => block.kind)).toEqual(['command', 'command', 'call', 'command']);
    expect(blocks.map(block => block.blockIndex)).toEqual([0, 1, 2, 3]);
  });

  it('操作区内部的操作块作为同权普通块各自独立出现', () => {
    const blocks = parseMessageBlocks({
      content: [
        '<EraFCall name="attack" id="c1"/>',
        '<EraFCallTx for="c1">',
        '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
        '<VariableInsert>{"dead":true}</VariableInsert>',
        '</EraFCallTx>',
        '<VariableDelete>{"tmp":true}</VariableDelete>',
      ].join('\n'),
    });

    expect(blocks.map(block => block.kind)).toEqual(['call', 'command', 'command', 'command']);
    expect(blocks.slice(1).map(block => block.insideOperationsRegion)).toEqual([true, true, false]);
  });

  it('块序列跳过只有围栏或空白而无法解析出数据的指令块', () => {
    const blocks = parseMessageBlocks({
      content: '<VariableInsert>```\n```</VariableInsert>\n<VariableInsert>{"hp":100}</VariableInsert>',
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('command');
  });
});

describe('ERA 消息内函数调用：未处理清单与操作区渲染', () => {
  it('未处理清单只包含非嵌套且未处理的调用', () => {
    const pending = findUnprocessedEraFunctionCalls([
      site({ callId: 'c1' }),
      site({ callId: 'c2', processed: true }),
      site({ callId: 'c3', nested: true }),
    ]);

    expect(pending.map(call => call.callId)).toEqual(['c1']);
  });

  it('已处理判定由解析结果直接给出', () => {
    expect(parseEraFunctionCalls('<EraFCall name="dice" status="done"/>')[0].processed).toBe(true);
    expect(parseEraFunctionCalls('<EraFCall name="dice"/>')[0].processed).toBe(false);
    expect(parseEraFunctionCalls(CALL_WITH_REGION)[0].processed).toBe(true);
  });

  it('渲染操作区保留作者提交含义：$expr 原样、固定值原样', () => {
    const region = renderEraFunctionCallOperationsRegion('c1', [
      { edit: { hp: { $expr: 'hp - 30' } } },
      { insert: { dead: true } },
    ]);

    expect(region).toContain('<EraFCallTx for="c1">');
    expect(region).toContain('</EraFCallTx>');
    expect(region).toContain('<VariableEdit>');
    expect(region).toContain('<VariableInsert>');
    expect(region).toContain('"$expr":"hp - 30"');
    expect(region).toContain('"dead":true');
  });

  it('无操作时渲染空操作区，作为已处理证据', () => {
    expect(renderEraFunctionCallOperationsRegion('c1', [])).toBe('<EraFCallTx for="c1"></EraFCallTx>');
  });

  it('调用块可读描述用于诊断与展示', () => {
    expect(describeEraFunctionCallBlock(site({}))).toContain('dice');
    expect(
      describeEraFunctionCallBlock(
        site({
          name: null,
          diagnostics: [{ code: 'ERA_FCALL_NAME_REQUIRED', message: '缺少 name。', path: '' }],
        }),
      ),
    ).toContain('ERA_FCALL_NAME_REQUIRED');
  });
});

describe('ERA 消息内函数调用：提示词规则', () => {
  it('变量操作规则必须写明调用块语法，否则模型不会产出该标签', async () => {
    const rule = await import('../../src/ERA变量框架/initer/manual/worldbook_entries/era_var_operation_rule');
    const content = String(rule.eraVarOperationRuleEntry.content ?? '');

    expect(content).toContain('<EraFCall');
    expect(content).toContain('args');
    expect(content).toContain('顶层');
  });
});

/**
 * 逐块提交的「已应用」记录（切片 1b 的记录面）。
 *
 * 凭据包住已经提交进 sidecar 的块，只在计算期间存在：还在 → 重放跳过它（否则同一变化
 * 会在下一批次生效两次）；楼层算完 → 删掉标签，原文与「从楼层起点重算」完全一致。
 */
describe('逐块提交的已应用记录', () => {
  // 全部用非幂等操作：重复应用会立刻反映在终值上，跳过语义才测得出来。
  const BLOCKS = [
    '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
    '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
    '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
  ];
  const TEXT = BLOCKS.join('\n');

  function wrap(content: string, needle: string) {
    const start = content.indexOf(needle);
    return wrapBlockAsAppliedRecord({
      content,
      start,
      end: start + needle.length,
      mk: 'mk-1',
    });
  }

  /** 单独应用一个块，得到「该块之后」的已提交世界。 */
  function afterBlock(stat: Record<string, unknown>, block: string) {
    const applied = applyMessageCommands({
      content: block,
      messageId: 1,
      initialStat: stat,
      meta: {},
      randomSourceKey: 'mk-1',
      commandRange: { fromIndex: 0, toIndex: 1 },
    });
    return applied.finalStat as Record<string, unknown>;
  }

  function driveToDone(content: string, stat: Record<string, unknown>, blockIndex: number) {
    let session = startEraBlockSession({
      content,
      messageId: 1,
      mk: 'mk-1',
      initialStat: stat,
      meta: {},
      cursor: { ...createEraBlockCursor({ messageId: 1, mk: 'mk-1' }), blockIndex, done: false },
    });
    let guard = 0;
    while (!session.done && guard < 8) {
      session = advanceEraBlockSession(session);
      guard += 1;
    }
    return session;
  }

  it('包住一个块后：块数不变、该块标记为已应用、前缀计数生效', () => {
    const wrapped = wrap(TEXT, BLOCKS[0]);
    const blocks = parseMessageBlocks({ content: wrapped });

    expect(wrapped).toContain('<era_block mk="mk-1" applied="1">');
    // 块的数量与顺序不因包一层记录而改变（游标下标才有意义）。
    expect(blocks).toHaveLength(3);
    expect(blocks.map(block => block.operationsRegionApplied)).toEqual([true, false, false]);
    expect(appliedCommandPrefix({ content: wrapped })).toBe(1);
    expect(hasAppliedBlockRecords(wrapped)).toBe(true);
  });

  it('已提交的块不再重放：包住第一块后从已提交世界继续，终值只算一次', () => {
    const committed = afterBlock({ hp: 100 }, BLOCKS[0]);
    expect(committed).toEqual({ hp: 90 });

    const advanced = driveToDone(wrap(TEXT, BLOCKS[0]), committed, 0);

    // 从「第一块已提交」的世界继续：只应再应用 -30、-10；若重放第一块会得到 40。
    expect(advanced.stat).toEqual({ hp: 50 });
    expect(advanced.done).toBe(true);
  });

  it('删掉记录后与「从楼层起点重算」终值一致（锁定的等价性）', () => {
    const plain = driveToDone(TEXT, { hp: 100 }, 0);
    // 逐块提交的模拟：先把第一块提交出去，再从那个世界继续。
    const committed = afterBlock({ hp: 100 }, BLOCKS[0]);
    const incremental = driveToDone(wrap(TEXT, BLOCKS[0]), committed, 0);

    expect(incremental.stat).toEqual(plain.stat);
    expect(unwrapAppliedRecords(wrap(TEXT, BLOCKS[0]))).toBe(TEXT);
    expect(hasAppliedBlockRecords(TEXT)).toBe(false);
    expect(appliedCommandPrefix({ content: TEXT })).toBe(0);
  });

  it('没有 applied="1" 的容器不产生跳过语义', () => {
    const inert = `<era_block mk="mk-1">${TEXT}</era_block>`;

    expect(appliedCommandPrefix({ content: inert })).toBe(0);
    expect(hasAppliedBlockRecords(inert)).toBe(false);
    expect(parseMessageBlocks({ content: inert }).map(b => b.operationsRegionApplied)).toEqual([false, false, false]);
  });
});
