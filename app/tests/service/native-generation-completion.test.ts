import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../native-tavern/native-fixture.mjs';
const a = { chatId: 'chat-A', executionId: 'native-1' };
const owners: any[] = [];
afterEach(async () => {
  for (const owner of owners.splice(0)) {
    owner.page.dispatchEvent(new Event('pagehide'));
    await owner.work;
  }
});
async function session() {
  const owner = await fixture(undefined, { api: { SillyTavern: { groupId: null, getCurrentChatId: () => a.chatId } } });
  owners.push(owner);
  const agent = owner.caps['era.tavern.agent'];
  const begin = (identity = a) =>
    agent.write_session({
      chatKey: identity.chatId,
      nativeExecutionId: identity.executionId,
      session: { nativeGeneration: true, execution: { id: identity.executionId } },
    });
  const complete = (messageId: number) =>
    owner.direct({ action: 'event', input: { type: 'generation_ended', source: 'tavern', args: [messageId] } });
  const wait = (identity = a, signal = new AbortController().signal) =>
    agent.await_native_completion(identity, { signal });
  const clear = (type: string) => owner.direct({ action: 'event', input: { type, source: 'tavern', args: [] } });
  return { owner, begin, complete, wait, clear };
}
describe('原生workflow拥有的生成终态等待', () => {
  it('continues only after completion and the synchronous native cleanup stack', async () => {
    const s = await session();
    s.begin();
    const order: string[] = [];
    const waiting = s.wait().then(() => order.push('auxiliary'));
    await Promise.resolve();
    expect(order).toEqual([]);
    s.complete(3);
    order.push('flush-worldbook');
    await waiting;
    expect(order).toEqual(['flush-worldbook', 'auxiliary']);
  });
  it('retains completion before the Service waits and does not reopen the same cycle', async () => {
    const s = await session();
    s.begin();
    s.complete(3);
    s.begin();
    await expect(s.wait()).resolves.toMatchObject({ status: 'completed', messageId: 3 });
  });
  it('does not release a cycle for another chat or execution', async () => {
    const s = await session();
    s.begin();
    const observed = vi.fn(),
      waiting = s.wait().then(observed);
    await expect(s.wait({ ...a, executionId: 'helper-request' })).resolves.toMatchObject({
      status: 'cancelled',
      reason: 'generation-not-current',
    });
    await expect(s.wait({ ...a, chatId: 'chat-B' })).resolves.toMatchObject({
      status: 'cancelled',
      reason: 'generation-not-current',
    });
    expect(observed).not.toHaveBeenCalled();
    s.complete(3);
    await waiting;
    expect(observed).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', messageId: 3 }));
  });
  it.each([
    ['generation_stopped', 'stopped'],
    ['chat_id_changed', 'chat-changed'],
  ] as const)('settles an unfinished cycle on %s', async (type, reason) => {
    const s = await session();
    s.begin();
    const waiting = s.wait();
    s.clear(type);
    await expect(waiting).resolves.toMatchObject({ status: 'cancelled', reason });
    await expect(s.wait()).resolves.toMatchObject({ status: 'cancelled', reason: 'generation-not-current' });
  });
  it('pagehide取消公开等待，等待真实资源退出后不再保留周期', async () => {
    const s = await session();
    s.begin();
    const waiting = expect(s.wait()).rejects.toBeDefined();
    s.owner.page.dispatchEvent(new Event('pagehide'));
    await waiting;
    await s.owner.work;
    expect(s.owner.session.nativeCycle).toBeNull();
    expect(s.owner.disposed()).toBe(1);
  });
  it('cancels superseded work instead of using the next cycle completion', async () => {
    const s = await session();
    s.begin();
    const waiting = s.wait();
    s.begin({ ...a, executionId: 'native-2' });
    await expect(waiting).resolves.toMatchObject({ status: 'cancelled', reason: 'superseded' });
  });
  it('propagates caller cancellation and removes the abort listener', async () => {
    const s = await session();
    s.begin();
    const controller = new AbortController(),
      remove = vi.spyOn(controller.signal, 'removeEventListener');
    const waiting = s.wait(a, controller.signal);
    controller.abort(new Error('service-stopped'));
    await expect(waiting).rejects.toThrow('service-stopped');
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
