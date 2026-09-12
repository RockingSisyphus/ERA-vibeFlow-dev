import { describe, expect, it } from 'vitest';

import {
  describeEraFunctionCallBlock,
  findUnprocessedEraFunctionCalls,
  parseEraFunctionCalls,
  parseMessageBlocks,
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

  it('下方紧邻操作区不代替 done 标记，空操作区也不代替', () => {
    const withRegion = parseEraFunctionCalls(CALL_WITH_REGION);
    const withEmptyRegion = parseEraFunctionCalls(
      '<EraFCall name="dice" id="c1"/>\n<EraFCallTx for="c1"></EraFCallTx>',
    );

    expect(withRegion[0].processed).toBe(false);
    expect(withRegion[0].operationsRegionId).toBe('c1');
    expect(withEmptyRegion[0].processed).toBe(false);
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
    expect(parseEraFunctionCalls(CALL_WITH_REGION)[0].processed).toBe(false);
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
