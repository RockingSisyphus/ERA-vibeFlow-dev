import { describe, expect, it } from 'vitest';

import {
  isDisplayedMessageBeingEdited,
  parseEraTechnicalProjection,
  projectEraPromptMessages,
  stripEraTechnicalBlocks,
} from '../../src/ERA变量框架/service/technical-block-projection';

describe('ERA technical block projection', () => {
  it('leaves SillyTavern message editors under host ownership', () => {
    const editor = {} as Element;
    let currentEditor: Element | null = editor;
    const message = {
      querySelector: () => currentEditor,
    } as unknown as Element;
    const root = {
      closest: () => message,
      matches: () => false,
      querySelector: () => null,
    } as unknown as Element;

    expect(isDisplayedMessageBeingEdited(root)).toBe(true);
    currentEditor = null;
    expect(isDisplayedMessageBeingEdited(root)).toBe(false);
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
});
