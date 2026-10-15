// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerEraTechnicalBlockProjection } from '../../src/ERA变量框架/service/technical-block-projection';
import { registerAgentRequestObservation } from '../../src/ERA变量框架/service/agent-report-host';
import { fixture } from '../native-tavern/native-fixture.mjs';
import { EVENT_CATALOG } from '../../src/ERA变量框架/events/catalog';
const owners: any[] = [];

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
afterEach(async () => {
  for (const owner of owners.splice(0)) {
    owner.page.dispatchEvent(new Event('pagehide'));
    await owner.work;
  }
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
  it('原生结束监听登记失败也能释放已经登记的句柄', async () => {
    failAt = 'GENERATION_ENDED';
    await expect(
      fixture(undefined, { dynamicApi: globalThis, eventDefinitions: [...EVENT_CATALOG.values()] }),
    ).rejects.toBeDefined();
    expect(count()).toBe(0);
  });
  it('辅助订阅失败后新实例可正常挂载，重复卸载无残留', async () => {
    failAt = 'HELPER_ENDED';
    const options = {
      dynamicApi: globalThis,
      eventDefinitions: [...EVENT_CATALOG.values()],
      registerTechnicalProjection: registerEraTechnicalBlockProjection,
    };
    await expect(fixture(undefined, options)).rejects.toBeDefined();
    expect(count()).toBe(0);
    expect(document.head.querySelector('[data-era-projection-version]')).toBeNull();
    failAt = '';
    const owner = await fixture(undefined, options);
    owners.push(owner);
    expect(count()).toBeGreaterThan(0);
    owner.page.dispatchEvent(new Event('pagehide'));
    await owner.work;
    owner.page.dispatchEvent(new Event('pagehide'));
    await owner.work;
    expect(count()).toBe(0);
    expect(owner.disposed()).toBe(1);
    expect(document.head.querySelector('[data-era-projection-version]')).toBeNull();
  });
});
