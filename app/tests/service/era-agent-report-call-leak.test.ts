import { describe, expect, it, vi, beforeEach } from 'vitest';

import { readMessageStageReport } from '../../src/ERA变量框架/service/agent-message-report';

/**
 * 消息内函数调用块与其操作区属于技术块：阶段报告的可见正文里不得出现它们的字节。
 * 这条回归守住「调用块不会以原始标签形式泄漏到报告或提示投影」。
 */
describe('ERA 消息内函数调用：阶段报告不泄漏调用块', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  function stubMessage(text: string): void {
    vi.stubGlobal('SillyTavern', { chat: [{ mes: text, message: text }] });
  }

  it('story 阶段只返回可见故事，不含调用块与操作区', () => {
    stubMessage(
      [
        '正式故事正文',
        '<EraFCall name="attack" args=\'{"damage":30}\' id="c1" status="done"/>',
        '<EraFCallTx for="c1" applied="1">',
        '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
        '</EraFCallTx>',
      ].join('\n'),
    );

    const report = readMessageStageReport(0, null, 'story');

    expect(report).toContain('正式故事正文');
    expect(report).not.toContain('EraFCall');
    expect(report).not.toContain('hp-30');
  });

  it('settlement 阶段不把调用块当成未识别标签原样吐出', () => {
    stubMessage(
      [
        '<EraFCall name="attack" id="c1" status="done"/>',
        '<EraFCallTx for="c1" applied="1">',
        '<VariableEdit>{"hp":70}</VariableEdit>',
        '</EraFCallTx>',
      ].join('\n'),
    );

    const report = readMessageStageReport(0, null, 'settlement');

    expect(report).not.toContain('EraFCallTx');
    expect(report).not.toContain('status=');
  });
});
