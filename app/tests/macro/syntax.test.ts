import _ from 'lodash';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  containsEraMacro,
  parseEraMacroContent,
  parseEraMacroPrompt,
  parseEraMacroText,
  type EraMacroSnapshot,
} from '../../src/ERA变量框架/macro/syntax';

let createEraMacroSnapshot: typeof import('../../src/ERA变量框架/macro/registration').createEraMacroSnapshot;

beforeAll(async () => {
  // registration 复用旧数据模块；生产环境由酒馆助手提供 `_`，Node 测试在导入前显式注入。
  vi.stubGlobal('_', _);
  ({ createEraMacroSnapshot } = await import('../../src/ERA变量框架/macro/registration'));
});

const snapshot: EraMacroSnapshot = {
  statWithMeta: {
    character: {
      hp: 7,
      label: '含元数据',
      $meta: { source: 'swipe-2' },
    },
  },
  statWithoutMeta: {
    character: {
      hp: 7,
      label: '纯净状态',
    },
  },
};

describe('ERA 宏纯解析器', () => {
  it('快速识别大小写和空白形式的 ERA 宏', () => {
    expect(containsEraMacro('普通文本')).toBe(false);
    expect(containsEraMacro('{{ERA:character.hp}}')).toBe(true);
    expect(containsEraMacro('{{ era-withmeta : character.hp }}')).toBe(true);
  });

  it('一次替换多个普通宏和 withmeta 宏', () => {
    const text =
      'HP={{ERA: character.hp }}，普通={{era:character.label}}，元数据={{ERA-withmeta: character.$meta.source}}';

    expect(parseEraMacroText(text, snapshot)).toBe('HP=7，普通=纯净状态，元数据=swipe-2');
  });

  it('将对象和 $ALLDATA 序列化为 JSON，并把不存在的路径替换为空字符串', () => {
    expect(parseEraMacroText('{{ERA:character}}', snapshot)).toBe('{"hp":7,"label":"纯净状态"}');
    expect(parseEraMacroText('{{ERA:$ALLDATA}}', snapshot)).toBe('{"character":{"hp":7,"label":"纯净状态"}}');
    expect(parseEraMacroText('before{{ERA:missing.path}}after', snapshot)).toBe('beforeafter');
  });

  it('建立运行时快照时反转义 ERA 的内部点号与引号占位符', () => {
    const runtimeSnapshot = createEraMacroSnapshot({
      character: {
        label: 'Mr__DOT__ X said __DQUOTE__hello__DQUOTE__ and it__SQUOTE__s fine',
      },
      display__DOT__name: '带点号的键',
    });

    expect(parseEraMacroText('{{ERA:character.label}}', runtimeSnapshot)).toBe(`Mr. X said "hello" and it's fine`);
    expect(parseEraMacroText('{{ERA:["display.name"]}}', runtimeSnapshot)).toBe('带点号的键');
  });

  it('快照不可用时保留原宏，无宏时保持文本内容不变', () => {
    const macro = '{{ERA:character.hp}}';
    const missingSnapshot: EraMacroSnapshot = {
      statWithMeta: null,
      statWithoutMeta: undefined,
    };

    expect(parseEraMacroText(macro, missingSnapshot)).toBe(macro);
    expect(parseEraMacroText('没有任何宏', snapshot)).toBe('没有任何宏');
  });

  it('只替换多模态内容中的文本片段，不修改图片、视频和输入数组', () => {
    const imagePart = {
      type: 'image_url' as const,
      image_url: { url: 'https://example.invalid/image.png', detail: 'low' as const },
    };
    const videoPart = {
      type: 'video_url' as const,
      video_url: { url: 'https://example.invalid/video.mp4' },
    };
    const textPart = { type: 'text' as const, text: 'HP={{ERA:character.hp}}' };
    const original = [textPart, imagePart, videoPart];

    const parsed = parseEraMacroContent(original, snapshot);

    expect(parsed).toEqual([{ type: 'text', text: 'HP=7' }, imagePart, videoPart]);
    expect(textPart.text).toBe('HP={{ERA:character.hp}}');
    expect(Array.isArray(parsed) && parsed).not.toBe(original);
  });

  it('对所有提示词 role 使用同一规则，并且不原地修改提示词', () => {
    const prompt: SillyTavern.SendingMessage[] = [
      { role: 'system', content: 'system={{ERA:character.label}}' },
      { role: 'user', content: 'user={{ERA:character.hp}}' },
      { role: 'assistant', content: 'assistant={{ERA-withmeta:character.$meta.source}}' },
      { role: 'tool', content: [{ type: 'text', text: 'tool={{ERA:character.hp}}' }] },
    ];

    const parsed = parseEraMacroPrompt(prompt, snapshot);

    expect(parsed).toEqual([
      { role: 'system', content: 'system=纯净状态' },
      { role: 'user', content: 'user=7' },
      { role: 'assistant', content: 'assistant=swipe-2' },
      { role: 'tool', content: [{ type: 'text', text: 'tool=7' }] },
    ]);
    expect(prompt[0].content).toBe('system={{ERA:character.label}}');
    expect(parsed).not.toBe(prompt);
  });
});
