// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, shallowReactive, type App } from 'vue';
import VariableWorkspace from '../../src/ERA变量框架/ui/components/workbench/VariableWorkspace.vue';
import FunctionWorkspace from '../../src/ERA变量框架/ui/components/workbench/FunctionWorkspace.vue';

const mocks = vi.hoisted(() => ({ commit: vi.fn() }));
vi.mock('../../src/ERA变量框架/service/workbench-client', () => ({
  commitWorkbenchIntent: (...args: unknown[]) => mocks.commit(...args),
}));
let app: App | undefined;
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.clearAllMocks();
});
async function flush() {
  for (let n = 0; n < 5; n += 1) await nextTick();
}
function click(label: string) {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Missing button: ${label}`);
  button.click();
}
async function draft(label: string, value: string) {
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
}
function mount(kind: 'variable' | 'function') {
  const props = shallowReactive({ identityKey: 'chat-a', revision: 1 });
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({
    render: () =>
      kind === 'variable'
        ? h(VariableWorkspace, { ...props, data: { hp: 10 }, statFunc: {} })
        : h(FunctionWorkspace, { ...props, library: { f: { params: ['x'], expr: 'x+1' } } }),
  });
  app.mount(root);
  return props;
}

for (const kind of ['variable', 'function'] as const) {
  const edit = kind === 'variable' ? '编辑变量 hp' : '编辑函数 f';
  const field = kind === 'variable' ? '变量值' : '函数表达式';
  const value = kind === 'variable' ? '12' : 'x+2';
  describe(`${kind} editor ownership`, () => {
    it('old success timer cannot close a newly opened draft', async () => {
      vi.useFakeTimers();
      mocks.commit.mockResolvedValue({ status: 'committed', messageId: 1 });
      mount(kind);
      click(edit);
      await flush();
      await draft(field, value);
      document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
      expect(mocks.commit).toHaveBeenCalledTimes(1);
      click('关闭编辑器');
      await flush();
      click(edit);
      await flush();
      await vi.advanceTimersByTimeAsync(701);
      await flush();
      expect(document.querySelector(`[aria-label="${field}"]`)).not.toBeNull();
    });
    it('a receipt from the previous chat cannot decorate the new draft', async () => {
      let resolve!: (value: unknown) => void;
      mocks.commit.mockReturnValue(
        new Promise(done => {
          resolve = done;
        }),
      );
      const props = mount(kind);
      click(edit);
      await flush();
      await draft(field, value);
      document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
      expect(mocks.commit).toHaveBeenCalledTimes(1);
      props.identityKey = 'chat-b';
      await flush();
      click(edit);
      await flush();
      resolve({ status: 'committed', messageId: 9 });
      await flush();
      expect(document.body.textContent).not.toContain('已保存到消息 #9');
    });
  });
}
