import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExternalStatusbarSave } from '../../src/ERA变量框架/service/external-statusbar-save';
import { createExternalDraftStore } from '../../src/ERA变量框架/service/external-statusbar-drafts';

afterEach(() => vi.useRealTimers());
describe('external HTML autosave', () => {
  it('reuses one writer when switching away and back before a save completes', async () => {
    let resolve!: () => void;
    const write = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<void>(done => {
          resolve = done;
        }),
      )
      .mockResolvedValue(undefined);
    const store = createExternalDraftStore(write);
    const first = store.acquire('A.png', '', vi.fn());
    first.save.edit('first');
    first.release();
    const second = store.acquire('A.png', '', vi.fn());
    expect(second.save).toBe(first.save);
    second.save.edit('latest');
    resolve();
    await second.save.flush();
    expect(write.mock.calls).toEqual([
      ['A.png', 'first'],
      ['A.png', 'latest'],
    ]);
    second.release();
  });
  it('retains a failed draft across panel lifetimes without writing another character', async () => {
    const write = vi.fn().mockRejectedValue(new Error('offline'));
    const store = createExternalDraftStore(write);
    const first = store.acquire('A.png', 'saved', vi.fn());
    first.save.edit('not saved');
    first.release();
    await expect(first.save.flush()).rejects.toThrow('offline');
    const changed = vi.fn();
    const second = store.acquire('A.png', 'saved', changed);
    expect(second.save.value).toBe('not saved');
    expect(changed).toHaveBeenLastCalledWith('failed', expect.any(Error));
    const other = store.acquire('B.png', 'other', vi.fn());
    expect(other.save.value).toBe('other');
    write.mockResolvedValue(undefined);
    await second.save.flush();
    second.release();
    other.release();
    expect(write.mock.calls.every(([id]) => id === 'A.png')).toBe(true);
  });
  it('coalesces input and saves exactly the latest content without rendering', async () => {
    vi.useFakeTimers();
    const write = vi.fn(async () => undefined);
    const save = createExternalStatusbarSave('', write, vi.fn());
    save.edit('a');
    save.edit('ab');
    save.edit('abc');
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(write.mock.calls).toEqual([['abc']]);
    expect(save.dirty).toBe(false);
  });
  it('serializes new input behind the in-flight write', async () => {
    let release!: () => void;
    const first = new Promise<void>(resolve => {
      release = resolve;
    });
    const write = vi.fn().mockReturnValueOnce(first).mockResolvedValue(undefined);
    const save = createExternalStatusbarSave('', write, vi.fn());
    save.edit('old');
    const flush = save.flush();
    save.edit('new');
    expect(write.mock.calls).toEqual([['old']]);
    release();
    await flush;
    expect(write.mock.calls).toEqual([['old'], ['new']]);
    save.stop();
  });
  it('keeps a failed draft and supports an explicit retry', async () => {
    const changed = vi.fn();
    const write = vi.fn().mockRejectedValueOnce(new Error('disk')).mockResolvedValue(undefined);
    const save = createExternalStatusbarSave('saved', write, changed);
    save.edit('draft');
    await expect(save.flush()).rejects.toThrow('disk');
    expect(save.value).toBe('draft');
    expect(save.dirty).toBe(true);
    expect(changed).toHaveBeenLastCalledWith('failed', expect.any(Error));
    await save.flush();
    expect(save.dirty).toBe(false);
    save.stop();
  });
});
