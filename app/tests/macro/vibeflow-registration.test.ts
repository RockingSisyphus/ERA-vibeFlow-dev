import _ from 'lodash';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let registerEraMacro: typeof import('../../src/ERA变量框架/macro/registration').registerEraMacro;
let publishSidecarRuntimeSnapshot: typeof import('../../src/ERA变量框架/service/sidecar-runtime-snapshot').publishSidecarRuntimeSnapshot;
let clearSidecarRuntimeSnapshot: typeof import('../../src/ERA变量框架/service/sidecar-runtime-snapshot').clearSidecarRuntimeSnapshot;

beforeAll(async () => {
  vi.stubGlobal('_', _);
  ({ registerEraMacro } = await import('../../src/ERA变量框架/macro/registration'));
  ({ publishSidecarRuntimeSnapshot, clearSidecarRuntimeSnapshot } =
    await import('../../src/ERA变量框架/service/sidecar-runtime-snapshot'));
});

beforeEach(() => {
  clearSidecarRuntimeSnapshot();
  vi.stubGlobal('getCurrentCharacterId', () => 'card-a');
  vi.stubGlobal('SillyTavern', { groupId: null, getCurrentChatId: () => 'chat-a' });
  publishSidecarRuntimeSnapshot({
    sidecarId: 'era_chat_test-1234',
    identity: { characterId: 'card-a', groupId: null, chatId: 'chat-a' },
    revision: 1,
    statData: { character: { hp: 7 } },
    statFunc: {},
    eraMeta: {},
  });
});

describe('Macro AOT Tavern 同步适配器', () => {
  it('每次回调只读取一次状态并立即返回字符串', () => {
    let callback: ((context: MacroLikeContext, substring: string) => string) | undefined;
    const unregister = vi.fn();
    const register = vi.fn((_regex: RegExp, replacement: typeof callback) => {
      callback = replacement;
      return { unregister };
    });
    vi.stubGlobal('registerMacroLike', register);

    const stop = registerEraMacro();
    const result = callback?.({ role: 'assistant' }, '{{ERA:character.hp}}');

    expect(result).toBe('7');
    expect(result).not.toBeInstanceOf(Promise);
    stop();
    stop();
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('连续启动与停止十次后不存在重复注册', () => {
    let active = 0;
    const register = vi.fn(() => {
      active += 1;
      let live = true;
      return {
        unregister() {
          if (!live) return;
          live = false;
          active -= 1;
        },
      };
    });
    vi.stubGlobal('registerMacroLike', register);

    for (let index = 0; index < 10; index += 1) {
      const stop = registerEraMacro();
      expect(active).toBe(1);
      stop();
      stop();
      expect(active).toBe(0);
    }

    expect(register).toHaveBeenCalledTimes(10);
  });
});
