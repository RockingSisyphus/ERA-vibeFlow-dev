import { describe, expect, it } from 'vitest';
import {
  calculateFloatingBallPlacement,
  clampFloatingBallTop,
} from '../../src/ERA变量框架/ui/utils/floating-ball-position';

describe('ERA 悬浮球视口位置', () => {
  it('以可见酒馆输入栏顶部作为下边界', () => {
    const bounds = calculateFloatingBallPlacement({
      viewportTop: 0,
      viewportHeight: 812,
      ballHeight: 50,
      safeTop: 0,
      safeBottom: 0,
      sendFormTop: 700,
    });
    expect(bounds).toEqual({ minTop: 12, maxTop: 638, defaultTop: 397.24 });
    expect(clampFloatingBallTop(760, bounds)).toBe(638);
  });

  it('输入栏不可见时保留底部按钮区域', () => {
    const bounds = calculateFloatingBallPlacement({
      viewportTop: 0,
      viewportHeight: 568,
      ballHeight: 50,
      safeTop: 20,
      safeBottom: 16,
      sendFormTop: null,
    });
    expect(bounds.minTop).toBe(32);
    expect(bounds.maxTop).toBe(410);
    expect(bounds.defaultTop).toBeCloseTo(270.36);
  });

  it('软键盘缩小且平移可视视口后仍限制在有效范围', () => {
    const bounds = calculateFloatingBallPlacement({
      viewportTop: 180,
      viewportHeight: 360,
      ballHeight: 50,
      safeTop: 0,
      safeBottom: 0,
      sendFormTop: 480,
    });
    expect(bounds.minTop).toBe(192);
    expect(bounds.maxTop).toBe(418);
    expect(clampFloatingBallTop(Number.NaN, bounds)).toBe(bounds.defaultTop);
    expect(clampFloatingBallTop(-100, bounds)).toBe(bounds.minTop);
  });

  it('极窄可用高度时收敛为单一安全位置', () => {
    const bounds = calculateFloatingBallPlacement({
      viewportTop: 0,
      viewportHeight: 80,
      ballHeight: 50,
      safeTop: 20,
      safeBottom: 20,
      sendFormTop: 50,
    });
    expect(bounds.minTop).toBe(32);
    expect(bounds.maxTop).toBe(32);
    expect(bounds.defaultTop).toBe(32);
  });
});
