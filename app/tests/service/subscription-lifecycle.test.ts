// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerEraTechnicalBlockProjection } from '../../src/ERA变量框架/service/technical-block-projection';
import { registerAgentRequestObservation } from '../../src/ERA变量框架/service/agent-report-host';
import { NativeGenerationHost } from '../../src/ERA变量框架/service/native-generation-host';
import { TavernEraServiceAdapter } from '../../src/ERA变量框架/service/tavern-adapter';

const registrations = new Map<string, Set<unknown>>();
let failAt = '';
let cleanup: (() => void) | undefined;
const eventNames = new Proxy({}, { get: (_target, name) => String(name) });
function register(type: string, handler: unknown) {
  const handlers = registrations.get(type) ?? new Set();
  handlers.add(handler);
  registrations.set(type, handlers);
  if (type === failAt) throw new Error(`registration failed: ${type}`);
}
function count() {
  return [...registrations.values()].reduce((n, handlers) => n + handlers.size, 0);
}
beforeEach(() => {
  failAt = '';
  registrations.clear();
  vi.stubGlobal('tavern_events', eventNames);
  vi.stubGlobal('iframe_events', { GENERATION_STARTED: 'HELPER_STARTED', GENERATION_ENDED: 'HELPER_ENDED' });
  vi.stubGlobal('SillyTavern', { chat: [], getCurrentChatId: () => 'chat' });
  vi.stubGlobal('getButtonEvent', (name: string) => `button:${name}`);
  vi.stubGlobal('eventOn', register);
  vi.stubGlobal('eventMakeFirst', register);
  vi.stubGlobal('eventMakeLast', register);
  vi.stubGlobal('eventRemoveListener', (type: string, handler: unknown) => registrations.get(type)?.delete(handler));
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.head.querySelectorAll('[data-era-projection-version]').forEach(node => node.remove());
  vi.unstubAllGlobals();
});

describe('部分订阅失败的资源归属', () => {
  it.each(['CHARACTER_MESSAGE_RENDERED', 'HELPER_ENDED'])('投影登记在 %s 失败时回收此前资源', async event => {
    failAt = event;
    expect(() => registerEraTechnicalBlockProjection()).toThrow('registration failed');
    await Promise.resolve();
    expect(count()).toBe(0);
    expect(document.head.querySelector('[data-era-projection-version]')).toBeNull();
  });
  it('请求观察登记失败不遗留较早监听', () => {
    failAt = 'HELPER_ENDED';
    expect(() => registerAgentRequestObservation()).toThrow('registration failed');
    expect(count()).toBe(0);
  });
  it('原生结束监听登记失败也能释放宿主已经登记的句柄', () => {
    failAt = 'GENERATION_ENDED';
    const host = new NativeGenerationHost({
      isAuxiliary: () => false,
      readSession: () => null,
      readIdentity: () => null,
    });
    expect(() => host.observe()).toThrow('registration failed');
    expect(count()).toBe(0);
  });
  it('适配器辅助订阅失败后可重新订阅同一实例且正常卸载', () => {
    const adapter = new TavernEraServiceAdapter();
    cleanup = () => adapter.stopAccepting();
    const listener = () => ({ accepted: false as const, code: 'fixture', message: 'fixture' });
    failAt = 'HELPER_ENDED';
    expect(() => adapter.subscribe(listener)).toThrow('registration failed');
    failAt = '';
    const stop = adapter.subscribe(listener);
    cleanup = stop;
    expect(count()).toBeGreaterThan(0);
    stop();
    stop();
    expect(count()).toBe(0);
    expect(document.head.querySelector('[data-era-projection-version]')).toBeNull();
  });
});
