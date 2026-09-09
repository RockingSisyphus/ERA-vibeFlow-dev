import { beforeEach, describe, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({
  characterId: 0,
  groupId: null as string | null,
  characters: [] as any[],
  getRequestHeaders: () => ({}),
}));
vi.mock('../../src/ERA变量框架/service/tavern-browser-host', () => ({ currentTavernContext: () => host }));
import {
  patchSingleFloor,
  refreshSingleFloorSelection,
  singleFloorSelection,
} from '../../src/ERA变量框架/service/single-floor-configuration';
beforeEach(() => {
  host.characterId = 0;
  host.groupId = null;
  host.characters = ['a.png', 'b.png'].map(avatar => ({
    avatar,
    data: { extensions: { author: 'preserved' } },
    json_data: '{"data":{"extensions":{"author":"preserved"}}}',
  }));
  vi.stubGlobal('window', { top: { document: { querySelector: () => null } } });
  vi.stubGlobal('SillyTavern', { getCurrentChatId: () => 'chat-a' });
});
describe('单层配置的真实保存边界', () => {
  it('旧卡默认关闭，无卡及群聊不可用', () => {
    refreshSingleFloorSelection();
    expect(singleFloorSelection.value).toEqual({ characterId: 'a.png', chatId: 'chat-a', enabled: false });
    host.groupId = 'group';
    refreshSingleFloorSelection();
    expect(singleFloorSelection.value).toBeNull();
    host.groupId = null;
    host.characterId = -1;
    refreshSingleFloorSelection();
    expect(singleFloorSelection.value).toBeNull();
  });
  it('只写捕获的角色并同步导出镜像，不污染当前其他卡', async () => {
    const fetch = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    await patchSingleFloor({ characterId: 'b.png', enabled: true }, { signal: new AbortController().signal });
    expect(host.characters[0].data.extensions).toEqual({ author: 'preserved' });
    expect(host.characters[1].data.extensions).toEqual({
      author: 'preserved',
      era_single_floor: { version: 1, enabled: true },
    });
    expect(JSON.parse(host.characters[1].json_data).data.extensions.era_single_floor).toEqual({
      version: 1,
      enabled: true,
    });
    expect(singleFloorSelection.value?.enabled).toBe(false);
  });
  it('HTTP 失败不发布伪成功配置', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })),
    );
    await expect(
      patchSingleFloor({ characterId: 'a.png', enabled: true }, { signal: new AbortController().signal }),
    ).rejects.toThrow('503');
    expect(host.characters[0].data.extensions).toEqual({ author: 'preserved' });
  });
});
