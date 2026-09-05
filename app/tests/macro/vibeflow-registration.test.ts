import _ from 'lodash';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let registerEraMacro: typeof import('../../src/ERA变量框架/macro/registration').registerEraMacro;
let publishSidecarRuntimeSnapshot: typeof import('../../src/ERA变量框架/service/sidecar-runtime-snapshot').publishSidecarRuntimeSnapshot;
let clearSidecarRuntimeSnapshot: typeof import('../../src/ERA变量框架/service/sidecar-runtime-snapshot').clearSidecarRuntimeSnapshot;
let resolveEraLazyMacroTokens: typeof import('../../src/ERA变量框架/macro/syntax').resolveEraLazyMacroTokens;
let createEraMacroSnapshot: typeof import('../../src/ERA变量框架/macro/registration').createEraMacroSnapshot;

beforeAll(async () => {
  vi.stubGlobal('_', _);
  ({ registerEraMacro, createEraMacroSnapshot } = await import('../../src/ERA变量框架/macro/registration'));
  ({ resolveEraLazyMacroTokens } = await import('../../src/ERA变量框架/macro/syntax'));
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
  it('同步回调只产生惰性 token，由绑定楼层的状态在显示前解析', () => {
    let callback: ((context: MacroLikeContext, substring: string) => string) | undefined;
    const unregister = vi.fn();
    const register = vi.fn((_regex: RegExp, replacement: typeof callback) => {
      callback = replacement;
      return { unregister };
    });
    vi.stubGlobal('registerMacroLike', register);

    const stop = registerEraMacro();
    const result = callback?.({ role: 'assistant' }, '{{ERA:character.hp}}');

    expect(result).toMatch(/^__ERA_LAZY_MACRO_V2_/u);
    expect(resolveEraLazyMacroTokens(result ?? '', createEraMacroSnapshot({ character: { hp: 3 } }))).toBe('3');
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
