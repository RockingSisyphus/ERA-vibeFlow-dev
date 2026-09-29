import lodash from 'lodash';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

let installEraPublicApi: typeof import('../../src/ERA变量框架/service/public-api').installEraPublicApi;

beforeAll(async () => {
  vi.stubGlobal('_', lodash);
  ({ installEraPublicApi } = await import('../../src/ERA变量框架/service/public-api'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('_', lodash);
});

function install() {
  const statusbar = {
    mount: vi.fn(async () => undefined),
    list: () => [],
    select: vi.fn(async () => undefined),
    clearSelection: vi.fn(),
    stop: vi.fn(),
  };
  const stop = installEraPublicApi(() => statusbar);
  return { stop, statusbar };
}

describe('ERA 页面全局入口生命周期', () => {
  it('停止时移除旧入口，使新状态栏等待下一次正式初始化', () => {
    const host: Record<string, unknown> = {};
    vi.stubGlobal('window', { top: host });
    vi.stubGlobal('initializeGlobal', (name: string, value: unknown) => {
      host[name] = value;
    });

    const first = install();
    expect(host['ERA']).toBeDefined();
    first.stop();

    expect(Object.hasOwn(host, 'ERA')).toBe(false);
    expect(first.statusbar.stop).toHaveBeenCalledOnce();
  });

  it('旧实例停止时不删除较新实例的全局入口', () => {
    const host: Record<string, unknown> = {};
    vi.stubGlobal('window', { top: host });
    vi.stubGlobal('initializeGlobal', (name: string, value: unknown) => {
      host[name] = value;
    });

    const first = install();
    const second = install();
    const current = host['ERA'];
    first.stop();

    expect(host['ERA']).toBe(current);
    second.stop();
    expect(Object.hasOwn(host, 'ERA')).toBe(false);
  });
});
