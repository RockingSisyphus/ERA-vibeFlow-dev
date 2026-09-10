// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, shallowReactive, type App } from 'vue';
import VariableTreeNode from '../../src/ERA变量框架/ui/components/workbench/VariableTreeNode.vue';

let app: App | undefined;
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});
function mount(value: unknown, filter = '') {
  const props = shallowReactive({ label: 'player', value, path: ['player'], depth: 0, filter });
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({ render: () => h(VariableTreeNode, props) });
  app.mount(root);
  return props;
}
function button(label: string) {
  return document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

describe('变量树实际交互', () => {
  it('数组提供整体编辑，不显示无效的展开操作', () => {
    mount([1, 2]);
    expect(button('编辑变量 player')).not.toBeNull();
    expect(document.querySelector('[aria-expanded]')).toBeNull();
  });
  it('搜索保留深层命中的祖先并展开到结果，仍可手动折叠', async () => {
    const props = mount({ bag: { item: { title: '蓝宝石' } }, unrelated: 7 });
    expect(button('编辑变量 player.bag.item.title')).toBeNull();
    props.filter = '蓝宝石';
    await nextTick();
    expect(button('编辑变量 player.bag.item.title')).not.toBeNull();
    expect(button('编辑变量 player.unrelated')).toBeNull();
    button('折叠变量 bag')!.click();
    await nextTick();
    expect(button('编辑变量 player.bag.item.title')).toBeNull();
  });
  it('完整值参与搜索，不被八十字符摘要截断', () => {
    mount({ description: `${'前'.repeat(100)}目标内容` }, '目标内容');
    expect(button('编辑变量 player.description')).not.toBeNull();
  });
  it('深层路径搜索能够穿过折叠的祖先', () => {
    mount({ bag: { item: { title: '蓝宝石' } } }, 'player.bag.item.title');
    expect(button('编辑变量 player.bag.item.title')).not.toBeNull();
  });
});
