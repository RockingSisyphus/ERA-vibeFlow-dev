// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { reconcileSingleFloor } from '../../src/ERA变量框架/service/single-floor-window';
import { createSingleFloorHelper } from '../../src/ERA变量框架/service/single-floor-helper';

describe('single floor presentation', () => {
  it('keeps the same AI node when a user message follows and does not change history', () => {
    document.body.innerHTML =
      '<div id="chat"><div class="mes" mesid="0"></div><div class="mes" mesid="1"><input value="draft"></div><div class="mes" mesid="2"></div></div>';
    const ai = document.querySelector('[mesid="1"]');
    const messages = [{ is_user: false }, { is_user: false }, { is_user: true }];
    expect(reconcileSingleFloor(document, messages)).toEqual({ messageId: 1, removed: true, mounted: true });
    expect(document.querySelector('.mes')).toBe(ai);
    expect(document.querySelector('input')?.value).toBe('draft');
    expect(messages).toHaveLength(3);
    expect(reconcileSingleFloor(document, messages).removed).toBe(false);
  });
  it('removes presentation for empty history', () => {
    document.body.innerHTML = '<div id="chat"><div class="mes" mesid="0"></div></div>';
    expect(reconcileSingleFloor(document, []).messageId).toBe(-1);
    expect(document.querySelector('.mes')).toBeNull();
  });
  it('sets Helper depth once through native input and restores it', () => {
    document.body.innerHTML =
      '<div id="tavern_helper"><div><div><span class="TH-Item--title">渲染深度</span></div><input type="number" value="3"></div></div>';
    const input = document.querySelector('input')!;
    const values: string[] = [];
    input.addEventListener('input', () => values.push(input.value));
    const helper = createSingleFloorHelper(document);
    helper.acquire();
    helper.release();
    expect(values).toEqual(['0', '3']);
  });
});
