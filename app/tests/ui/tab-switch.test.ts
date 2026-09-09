// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import TabSwitch from '../../src/ERA变量框架/ui/template/TabSwitch.vue';

vi.mock('../../src/ERA变量框架/utils/log', () => ({
  Logger: class {
    debug() {}
  },
}));

let app: App | undefined;
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('key-owned tab content', () => {
  it('switches pure/full/functions/custom slots and keeps parent data unchanged', async () => {
    const active = ref('pure');
    const values = Object.freeze({ pure: 'hp10', full: 'hp10 meta', functions: 'g(x)=f(x)*2', custom: 'custom view' });
    const root = document.createElement('div');
    document.body.append(root);
    const keys = [...Object.keys(values), 'missing'];
    app = createApp({
      render: () =>
        h(
          TabSwitch,
          {
            tabs: keys.map(key => ({ key, label: key })),
            active: active.value,
            'onUpdate:active': (key: string) => {
              active.value = key;
            },
          },
          Object.fromEntries(Object.entries(values).map(([key, text]) => [key, () => h('span', text)])),
        ),
    });
    app.mount(root);
    for (const key of keys) {
      [...root.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(button => button.textContent === key)!.click();
      await nextTick();
      expect(active.value).toBe(key);
      expect(root.querySelector('.tab-content')?.textContent).toBe(values[key as keyof typeof values] ?? '');
      expect(root.querySelector('[role=tab].active')?.textContent).toBe(key);
    }
    active.value = 'functions';
    await nextTick();
    expect(root.querySelector('.tab-content')?.textContent).toBe('g(x)=f(x)*2');
    expect(values).toEqual({ pure: 'hp10', full: 'hp10 meta', functions: 'g(x)=f(x)*2', custom: 'custom view' });
  });
});
