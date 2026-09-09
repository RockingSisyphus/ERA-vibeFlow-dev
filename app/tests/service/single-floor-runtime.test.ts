// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
const host = vi.hoisted(() => ({
  characterId: 0,
  groupId: null,
  characters: [] as any[],
  chat: [] as any[],
  eventSource: { emit: vi.fn(async (_name: string) => {}) },
  clearChat: vi.fn(async () => {}),
  printMessages: vi.fn(async () => {}),
}));
vi.mock('../../src/ERA变量框架/service/tavern-browser-host', () => ({ currentTavernContext: () => host }));
import { startSingleFloor } from '../../src/ERA变量框架/service/single-floor-runtime';
import { singleFloorSelection } from '../../src/ERA变量框架/service/single-floor-configuration';
const handlers = new Map<string, () => void>();
let stop: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  handlers.clear();
  host.chat = [
    { is_user: false, mes: 'first' },
    { is_user: false, mes: 'latest' },
    { is_user: true, mes: 'waiting' },
  ];
  host.characters = [{ avatar: 'a.png', data: { extensions: { era_single_floor: { enabled: true } } } }];
  document.body.innerHTML =
    '<div id="tavern_helper"><div><div><span class="TH-Item--title">渲染深度</span></div><input type="number" value="3"></div></div><div id="chat"><div class="mes" mesid="0"></div><div class="mes" mesid="1"><input data-author value="draft"></div><div class="mes" mesid="2"></div></div>';
  host.clearChat.mockImplementation(async () => {
    document.querySelector('#chat')!.replaceChildren();
  });
  host.printMessages.mockImplementation(async () => {
    document.querySelector('#chat')!.innerHTML = host.chat
      .map((_, id) => `<div class="mes" mesid="${id}"></div>`)
      .join('');
  });
  const events = Object.fromEntries(
    [
      'CHAT_CHANGED',
      'CHARACTER_MESSAGE_RENDERED',
      'USER_MESSAGE_RENDERED',
      'MESSAGE_UPDATED',
      'MESSAGE_SWIPED',
      'MESSAGE_DELETED',
      'MORE_MESSAGES_LOADED',
    ].map(name => [name, name]),
  );
  vi.stubGlobal('tavern_events', events);
  vi.stubGlobal('SillyTavern', { getCurrentChatId: () => 'chat-a' });
  const listen = (event: string, handler: () => void) => {
    handlers.set(event, handler);
    return { stop: () => handlers.delete(event) };
  };
  vi.stubGlobal('eventOn', listen);
  vi.stubGlobal('eventMakeFirst', listen);
});
afterEach(async () => {
  stop?.();
  stop = undefined;
  await nextTick();
  await Promise.resolve();
  vi.unstubAllGlobals();
});
describe('单层显示生命周期与业务分离', () => {
  it('开启和用户发言只移除其他显示，保留作者节点且不发业务事件', async () => {
    const kept = document.querySelector('[mesid="1"]');
    const data = structuredClone(host.chat);
    stop = startSingleFloor();
    await nextTick();
    await vi.waitFor(() => expect(document.querySelectorAll('.mes')).toHaveLength(1));
    const user = document.createElement('div');
    user.className = 'mes';
    user.setAttribute('mesid', '2');
    document.querySelector('#chat')!.append(user);
    handlers.get('USER_MESSAGE_RENDERED')!();
    expect(document.querySelector('.mes')).toBe(kept);
    expect(document.querySelector<HTMLInputElement>('[data-author]')?.value).toBe('draft');
    expect(host.chat).toEqual(data);
    expect(host.clearChat).not.toHaveBeenCalled();
    expect(host.eventSource.emit.mock.calls.every(([name]) => name === 'MORE_MESSAGES_LOADED')).toBe(true);
  });
  it('关闭时恢复原生窗口和 Helper 深度，但不清除业务数组', async () => {
    stop = startSingleFloor();
    await nextTick();
    await vi.waitFor(() => expect(document.querySelectorAll('.mes')).toHaveLength(1));
    singleFloorSelection.value = { characterId: 'a.png', chatId: 'chat-a', enabled: false };
    await nextTick();
    await vi.waitFor(() => expect(document.querySelectorAll('.mes')).toHaveLength(3));
    expect(host.clearChat).toHaveBeenCalledWith();
    expect(host.chat).toHaveLength(3);
    expect(document.querySelector<HTMLInputElement>('#tavern_helper input')?.value).toBe('3');
  });
  it('宿主先销毁脚本也保留偏好恢复值，不依赖 pagehide 的监听顺序', async () => {
    stop = startSingleFloor();
    await nextTick();
    await vi.waitFor(() => expect(document.querySelectorAll('.mes')).toHaveLength(1));
    stop();
    stop = undefined;
    expect(document.querySelector<HTMLInputElement>('#tavern_helper input')?.value).toBe('3');
    expect(localStorage.getItem('era.single-floor.helper-original-depth')).toBe('3');
  });
});
