import { describe, expect, it, vi } from 'vitest';
import { NativeGenerationCompletion } from '../../src/ERA变量框架/service/native-generation-completion';

const a = { chatId: 'chat-A', executionId: 'native-1' };
const signal = () => new AbortController().signal;

describe('native generation completion', () => {
  it('continues only after completion and the synchronous native cleanup stack', async () => {
    const lifecycle = new NativeGenerationCompletion();
    lifecycle.begin(a);
    const order: string[] = [];
    const waiting = lifecycle.wait(a, signal()).then(() => order.push('auxiliary'));
    await Promise.resolve();
    expect(order).toEqual([]);
    lifecycle.complete(a, 3);
    order.push('flush-worldbook');
    await waiting;
    expect(order).toEqual(['flush-worldbook', 'auxiliary']);
  });

  it('retains completion before the Service waits and does not reopen the same cycle', async () => {
    const lifecycle = new NativeGenerationCompletion();
    lifecycle.begin(a);
    lifecycle.complete(a, 3);
    lifecycle.begin(a);
    await expect(lifecycle.wait(a, signal())).resolves.toEqual({ status: 'completed', messageId: 3 });
  });

  it('does not release a cycle for another chat or execution', async () => {
    const lifecycle = new NativeGenerationCompletion();
    lifecycle.begin(a);
    const observed = vi.fn();
    const waiting = lifecycle.wait(a, signal()).then(observed);
    lifecycle.complete({ ...a, executionId: 'helper-request' }, 3);
    lifecycle.complete({ ...a, chatId: 'chat-B' }, 3);
    await Promise.resolve();
    expect(observed).not.toHaveBeenCalled();
    lifecycle.complete(a, 3);
    await waiting;
    expect(observed).toHaveBeenCalledWith({ status: 'completed', messageId: 3 });
  });

  it.each(['stopped', 'chat-changed', 'pagehide'])('settles an unfinished cycle on %s', async reason => {
    const lifecycle = new NativeGenerationCompletion();
    lifecycle.begin(a);
    const waiting = lifecycle.wait(a, signal());
    lifecycle.clear(reason);
    await expect(waiting).resolves.toEqual({ status: 'cancelled', reason });
    await expect(lifecycle.wait(a, signal())).resolves.toEqual({
      status: 'cancelled',
      reason: 'generation-not-current',
    });
  });

  it('cancels superseded work instead of using the next cycle completion', async () => {
    const lifecycle = new NativeGenerationCompletion();
    lifecycle.begin(a);
    const waiting = lifecycle.wait(a, signal());
    lifecycle.begin({ ...a, executionId: 'native-2' });
    await expect(waiting).resolves.toEqual({ status: 'cancelled', reason: 'superseded' });
  });

  it('propagates caller cancellation and removes the abort listener', async () => {
    const lifecycle = new NativeGenerationCompletion();
    lifecycle.begin(a);
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const waiting = lifecycle.wait(a, controller.signal);
    controller.abort(new Error('service-stopped'));
    await expect(waiting).rejects.toThrow('service-stopped');
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
