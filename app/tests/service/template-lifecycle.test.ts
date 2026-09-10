import { describe, expect, it, vi } from 'vitest';
import vm from 'node:vm';
import { getEraExternalStatusbarHtml } from '@era/example-resources';
import { getEraRegexPayloads } from '../../../javascript_project/service/base_lib/domain/resource_planner';

const templates = {
  external: () => getEraExternalStatusbarHtml(),
  traditional: () => getEraRegexPayloads()[0].replace_string,
};

/** 执行生产模板的真实脚本，只替代宿主接口以控制关闭与初始化的顺序。 */
function fixture(html: string) {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const ready = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const listeners = new Map<string, () => void>();
  const ownerListeners = new Set<unknown>();
  const unsubscribe = vi.fn();
  const subscribe = vi.fn(() => unsubscribe);
  const nodes = new Map<string, { textContent: string; max: number; value: number }>();
  const state = { status: 'ready', message_id: 2, statWithoutMeta: {} };
  const context = {
    document: {
      body: { dataset: {} },
      querySelector: (selector: string) => {
        if (!nodes.has(selector)) nodes.set(selector, { textContent: '', max: 1, value: 0 });
        return nodes.get(selector);
      },
      querySelectorAll: () => [],
    },
    ERA: { ready: () => ready, subscribe, get: () => state },
    addEventListener: (name: string, handler: () => void) => listeners.set(name, handler),
    top: {
      addEventListener: (_name: string, handler: unknown) => ownerListeners.add(handler),
      removeEventListener: (_name: string, handler: unknown) => ownerListeners.delete(handler),
    },
    eraStatusbarMounted: Promise.resolve(),
  };
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gu)];
  for (const script of scripts) new vm.Script(script[1]);
  // The bootstrap has its own mount lifecycle; exercise the author script here.
  vm.runInNewContext(scripts.at(-1)![1], { ...context, window: context });
  return {
    resolve: () => resolve(state),
    reject,
    close: () => listeners.get('pagehide')!(),
    subscribe,
    unsubscribe,
    ownerListeners,
    nodes,
  };
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe.each(Object.entries(templates))('%s template lifecycle', (_name, html) => {
  it('关闭早于ready时不晚订阅或注册父窗口监听', async () => {
    const f = fixture(html());
    f.close();
    f.resolve();
    await settle();
    expect(f.subscribe).not.toHaveBeenCalled();
    expect(f.ownerListeners.size).toBe(0);
  });
  it('已就绪页面关闭时释放订阅和父窗口监听', async () => {
    const f = fixture(html());
    f.resolve();
    await settle();
    expect(f.subscribe).toHaveBeenCalledOnce();
    f.close();
    expect(f.unsubscribe).toHaveBeenCalledOnce();
    expect(f.ownerListeners.size).toBe(0);
  });
  it.each([false, true])('ready失败保持活动错误可见，关闭=%s', async closed => {
    const f = fixture(html());
    await settle();
    if (closed) f.close();
    f.reject(new Error('fixture-ready-failed'));
    await settle();
    expect(f.subscribe).not.toHaveBeenCalled();
    const visible = [...f.nodes.values()].some(node => node.textContent.includes('fixture-ready-failed'));
    expect(visible).toBe(!closed);
  });
});

it('传统bootstrap在等待宿主时关闭，不再发起挂载', async () => {
  let resolve!: () => void;
  const ready = new Promise<void>(yes => {
    resolve = yes;
  });
  let close!: () => void;
  const mount = vi.fn();
  const page: { parent: { ERA?: { statusbar: { mount: typeof mount } } }; eraStatusbarMounted?: Promise<unknown> } = {
    parent: {},
  };
  const script = [...templates.traditional().matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gu)][0][1];
  vm.runInNewContext(script, {
    window: page,
    document: { body: { dataset: {} } },
    waitGlobalInitialized: () => ready,
    addEventListener: (_name: string, handler: () => void) => {
      close = handler;
    },
  });
  close();
  page.parent.ERA = { statusbar: { mount } };
  resolve();
  await page.eraStatusbarMounted;
  expect(mount).not.toHaveBeenCalled();
});
