import { patchCharacter } from '../native-tavern/character-config-fixture.mjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({
  characterId: 1,
  groupId: null,
  characters: [] as Array<Record<string, any>>,
  getRequestHeaders: () => ({}),
}));
vi.mock('../../src/ERA变量框架/service/tavern-browser-host', () => ({ currentTavernContext: () => host }));
import {
  readExternalConfig,
  refreshExternalStatusbarSelection,
  externalStatusbarSelection,
} from '../../src/ERA变量框架/service/external-statusbar-configuration';

beforeEach(() => {
  host.characters = ['a.png', 'b.png'].map(avatar => ({
    avatar,
    data: { extensions: {} },
    json_data: '{"data":{"extensions":{}}}',
  }));
  vi.stubGlobal('window', { top: { document: { querySelector: () => null } } });
  vi.stubGlobal('SillyTavern', { getCurrentChatId: () => 'active-chat' });
});

describe('external statusbar character persistence', () => {
  it('defaults old cards to disabled', () => {
    expect(readExternalConfig(undefined)).toEqual({ version: 1, enabled: false, html: '' });
  });
  it('writes the captured avatar, preserves HTML on toggle and never updates the other card', async () => {
    host.characters[0].data.extensions.era_external_statusbar = { enabled: false, html: 'author' };
    const fetch = vi.fn(async (_url: string, _options: { body: string }) => ({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    await patchExternalStatusbar(
      { characterId: 'a.png', patch: { enabled: true } },
      { signal: new AbortController().signal },
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      avatar: 'a.png',
      data: { extensions: { era_external_statusbar: { version: 1, enabled: true, html: 'author' } } },
    });
    expect(host.characters[1].data.extensions).toEqual({});
    expect(externalStatusbarSelection.value).toMatchObject({ characterId: 'b.png', config: { enabled: false } });
  });
  it('publishes current-card activation after persistence for initialization', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true })),
    );
    await patchExternalStatusbar(
      { characterId: 'b.png', patch: { enabled: true, html: '<p>demo</p>' } },
      { signal: new AbortController().signal },
    );
    expect(externalStatusbarSelection.value).toEqual({
      characterId: 'b.png',
      chatId: 'active-chat',
      config: { version: 1, enabled: true, html: '<p>demo</p>' },
    });
  });
  it('does not publish a failed HTTP write to the character mirror', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    await expect(
      patchExternalStatusbar(
        { characterId: 'a.png', patch: { html: 'draft' } },
        { signal: new AbortController().signal },
      ),
    ).rejects.toThrow('500');
    expect(host.characters[0].data.extensions).toEqual({});
  });
});

function patchExternalStatusbar(input: Readonly<Record<string, unknown>>, context: { signal: AbortSignal }) {
  return patchCharacter(input, context, host, 'patch_external_statusbar', refreshExternalStatusbarSelection);
}
