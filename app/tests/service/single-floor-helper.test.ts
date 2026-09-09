// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createSingleFloorHelper } from '../../src/ERA变量框架/service/single-floor-helper';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML =
    '<div id="tavern_helper"><div><div><span class="TH-Item--title">渲染深度</span></div><input type="number" value="3"></div></div>';
});
const input = () => document.querySelector<HTMLInputElement>('input')!;

describe('单层模式 Helper 偏好恢复', () => {
  it('页面重建后仍恢复原值，而不是将临时 0 当成原偏好', () => {
    const first = createSingleFloorHelper(document);
    first.acquire();
    expect(input().value).toBe('0');
    first.release(true);
    // 模拟页面退出前 Helper 的延迟保存未落盘，重载仍读取到 0。
    input().value = '0';
    const reloaded = createSingleFloorHelper(document);
    reloaded.acquire();
    reloaded.release();
    expect(input().value).toBe('3');
    expect(localStorage.getItem('era.single-floor.helper-original-depth')).toBeNull();
  });
  it('重开的是未启用角色时也可完成待恢复偏好', () => {
    const first = createSingleFloorHelper(document);
    first.acquire();
    first.release(true);
    input().value = '0';
    createSingleFloorHelper(document).release();
    expect(input().value).toBe('3');
  });
  it('当前非零偏好优先于旧恢复记录，不覆盖后来用户的设置', () => {
    localStorage.setItem('era.single-floor.helper-original-depth', '3');
    input().value = '7';
    const helper = createSingleFloorHelper(document);
    helper.acquire();
    helper.release();
    expect(input().value).toBe('7');
  });
  it('运行期间明确用户输入不被关闭模式覆盖', () => {
    const helper = createSingleFloorHelper(document);
    helper.acquire();
    input().value = '5';
    const event = new Event('input', { bubbles: true });
    Object.defineProperty(event, 'isTrusted', { value: true });
    input().dispatchEvent(event);
    helper.release();
    expect(input().value).toBe('5');
    expect(localStorage.getItem('era.single-floor.helper-original-depth')).toBeNull();
  });
});
