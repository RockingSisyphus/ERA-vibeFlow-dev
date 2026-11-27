import lodash from 'lodash';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { formatEraReportForDisplay } from '../../src/ERA变量框架/service/technical-report-display';

let parseEraTechnicalProjection: typeof import('../../src/ERA变量框架/service/technical-block-syntax').parseEraTechnicalProjection;
let projectEraPromptMessages: typeof import('../../src/ERA变量框架/service/technical-block-projection').projectEraPromptMessages;
let stripEraTechnicalBlocks: typeof import('../../src/ERA变量框架/service/technical-block-syntax').stripEraTechnicalBlocks;
let createEraLazyMacroToken: typeof import('../../src/ERA变量框架/macro/syntax').createEraLazyMacroToken;
let createEraMacroSnapshot: typeof import('../../src/ERA变量框架/macro/registration').createEraMacroSnapshot;

beforeAll(async () => {
  vi.stubGlobal('_', lodash);
  ({ parseEraTechnicalProjection, stripEraTechnicalBlocks } =
    await import('../../src/ERA变量框架/service/technical-block-syntax'));
  ({ projectEraPromptMessages } = await import('../../src/ERA变量框架/service/technical-block-projection'));
  ({ createEraLazyMacroToken } = await import('../../src/ERA变量框架/macro/syntax'));
  ({ createEraMacroSnapshot } = await import('../../src/ERA变量框架/macro/registration'));
});

describe('ERA technical block projection', () => {
  it('expands only known response JSON in the display copy and preserves raw message bytes', () => {
    const raw = JSON.stringify({
      attempts: [{ response: JSON.stringify({ scene: '森林', nested: { hp: 7 } }) }, { response: '<b>plain</b>' }],
      other: '{"keep":"string"}',
    });
    const message = `<era_plan>${raw}</era_plan>story`;
    const displayed = formatEraReportForDisplay(raw);
    expect(displayed).toContain('\n  "attempts": [\n');
    expect(JSON.parse(displayed).attempts[0].response).toEqual({ scene: '森林', nested: { hp: 7 } });
    expect(JSON.parse(displayed).attempts[1].response).toBe('<b>plain</b>');
    expect(JSON.parse(displayed).other).toBe('{"keep":"string"}');
    expect(parseEraTechnicalProjection(message).segments[0]).toMatchObject({
      text: raw,
      source: `<era_plan>${raw}</era_plan>`,
    });
    expect(formatEraReportForDisplay('invalid {')).toBe('invalid {');
  });
  it('strips every paired technical block while preserving the story', () => {
    const source = [
      '<era_plan>{"plan":1}</era_plan>',
      '正式故事',
      '<VariableEdit>{"path":"x"}</VariableEdit>',
      '<era_update>done</era_update>',
      '<era_tx s="m">[]</era_tx>',
    ].join('\n');
    expect(stripEraTechnicalBlocks(source)).toBe('\n正式故事\n\n\n');
  });

  it('treats a self-closing function call as a complete block instead of an unclosed tag', () => {
    const source = [
      '正式故事',
      '<EraFCall name="dice"/>',
      '<EraFCallTx for="c1"><VariableEdit>{"hp":{"$expr":"hp-1"}}</VariableEdit></EraFCallTx>',
    ].join('\n');
    const projection = parseEraTechnicalProjection(source);
    expect(projection.valid).toBe(true);
    expect(projection.technicalBlockCount).toBe(2);
    expect(stripEraTechnicalBlocks(source)).toBe('正式故事\n\n');
  });

  it('does not greedily remove malformed or misordered blocks', () => {
    const malformed = '开头<era_plan>未闭合故事<era_update>报告</era_plan>结尾';
    expect(stripEraTechnicalBlocks(malformed)).toBe(malformed);
    expect(parseEraTechnicalProjection(malformed).valid).toBe(false);
  });

  it('builds ordered display segments from nested authoritative technical blocks', () => {
    const source = [
      '<era_plan>{"plan":1}</era_plan>',
      '正式故事',
      '<era_update>done</era_update>',
      '<era_tx s="m"><VariableInsert>{"path":"x"}</VariableInsert></era_tx>',
    ].join('\n');
    expect(parseEraTechnicalProjection(source)).toEqual({
      valid: true,
      technicalBlockCount: 3,
      segments: [
        {
          kind: 'folded',
          name: 'era_plan',
          label: 'ERA 规划报告',
          text: '{"plan":1}',
          source: '<era_plan>{"plan":1}</era_plan>',
        },
        { kind: 'story', text: '\n正式故事\n' },
        {
          kind: 'folded',
          name: 'era_update',
          label: 'ERA 变量解析报告',
          text: 'done',
          source: '<era_update>done</era_update>',
        },
        { kind: 'story', text: '\n' },
        {
          kind: 'hidden',
          name: 'era_tx',
          label: undefined,
          text: '<VariableInsert>{"path":"x"}</VariableInsert>',
          source: '<era_tx s="m"><VariableInsert>{"path":"x"}</VariableInsert></era_tx>',
        },
      ],
    });
  });

  it('projects text and multimodal text without mutating the source messages', () => {
    const messages: SillyTavern.SendingMessage[] = [
      { role: 'assistant', content: '故事<era_update>报告</era_update>' },
      {
        role: 'user',
        content: [
          { type: 'text', text: '提问<variablethink>思考</variablethink>' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==', detail: 'auto' } },
        ],
      },
    ];
    const projected = projectEraPromptMessages(messages);
    expect(projected[0].content).toBe('故事');
    expect(projected[1].content?.[0]).toEqual({ type: 'text', text: '提问' });
    expect(messages[0].content).toContain('era_update');
    expect(projected).not.toBe(messages);
  });

  it('把「已应用记录」与函数调用块一起从显示与提示词里隐藏', () => {
    const applied = [
      '正式故事',
      '<era_block mk="era_mk_1" applied="1" draws="2"><VariableInsert>{"hp":100}</VariableInsert></era_block>',
      `<EraFCall name="recorder" args='{"value":"x"}' id="c1" status="done"/>`,
      '<EraFCallTx for="c1"><VariableEdit>{"hp":90}</VariableEdit></EraFCallTx>',
    ].join('\n');

    const stripped = stripEraTechnicalBlocks(applied);
    expect(stripped).toContain('正式故事');
    expect(stripped).not.toMatch(/era_block|EraFCall/);

    const projection = parseEraTechnicalProjection(applied);
    expect(projection.valid).toBe(true);
    expect(projection.technicalBlockCount).toBe(3);
    expect(
      projection.segments
        .filter(segment => segment.kind === 'story')
        .map(segment => segment.text)
        .join(''),
    ).toBe(stripped);

    const projected = projectEraPromptMessages([{ role: 'assistant', content: applied }])[0].content as string;
    expect(projected).toContain('正式故事');
    expect(projected).not.toMatch(/era_block|EraFCall/);
  });

  it('发给模型的普通与多模态文本使用最新已提交状态解析惰性宏', () => {
    const token = createEraLazyMacroToken('{{ERA:player.hp}}');
    const messages: SillyTavern.SendingMessage[] = [
      { role: 'assistant', content: `HP=${token}` },
      {
        role: 'user',
        content: [
          { type: 'text', text: `再读=${token}` },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==', detail: 'auto' } },
        ],
      },
    ];
    const projected = projectEraPromptMessages(messages, createEraMacroSnapshot({ player: { hp: 42 } }));
    expect(projected[0].content).toBe('HP=42');
    expect(projected[1].content?.[0]).toEqual({ type: 'text', text: '再读=42' });
    expect(projected[1].content?.[1]).toEqual(messages[1].content?.[1]);
    expect(messages[0].content).toContain('__ERA_LAZY_MACRO_V2_');
  });
});
