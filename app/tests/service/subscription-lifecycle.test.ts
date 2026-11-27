// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAgentRequestObservation } from '../../src/ERA变量框架/service/agent-report-host';
import { fixture } from '../native-tavern/native-fixture.mjs';
import { EVENT_CATALOG, INPUT_EVENT } from '../../src/ERA变量框架/events/catalog';

const registrations = new Map<string, Set<unknown>>();
let failAt = '';
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
  vi.unstubAllGlobals();
});

describe('部分订阅失败的资源归属', () => {
  it('请求观察登记失败不遗留较早监听', () => {
    failAt = 'HELPER_ENDED';
    expect(() => registerAgentRequestObservation()).toThrow('registration failed');
    expect(count()).toBe(0);
  });
  it('原生结束监听登记失败也能释放已经登记的句柄', async () => {
    failAt = INPUT_EVENT.GENERATION_ENDED;
    await expect(
      fixture(undefined, { dynamicApi: globalThis, eventDefinitions: [...EVENT_CATALOG.values()] }),
    ).rejects.toBeDefined();
    expect(count()).toBe(0);
  });
});
