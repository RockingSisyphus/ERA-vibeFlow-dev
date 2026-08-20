import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSidecarTestAdapter } from '../../src/ERA变量框架/service/sidecar-test-adapter';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 差分测试直接验证跨 root 的 VibeFlow 纯规则。
// @ts-ignore TypeScript 会对 app rootDir 外的 service 源码报告 TS6059。
import {
  observeSidecarTestIdentity,
  sidecarOwnerKey,
} from '../../../javascript_project/service/base_lib/sidecar_identity';

const current = {
  characterId: 'card-a',
  groupId: null,
  chatId: 'chat-a',
  scriptId: 'era-script',
};

const event = {
  schemaVersion: 1,
  eventId: 'evt:1',
  sequence: 7,
  type: 'chat_id_changed',
  source: 'tavern' as const,
  occurredAt: 1,
  args: [],
  encodedBytes: 128,
} as const;

function fixture(retiredOwnerKeys: readonly string[] = []) {
  return { schemaVersion: '1', enabled: true, retiredOwnerKeys };
}

function marker(owner = current, portable = true) {
  return { schemaVersion: 1, portable, owner };
}

describe('ERA Sidecar 测试身份纯规则', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('测试 technical adapter 与 Pack marker 一样读取顶层页面的当前身份', async () => {
    const session = new Map<string, string>();
    session.set('__ERA_SIDECAR_TEST_FIXTURE_V1__', JSON.stringify(fixture()));
    const top = {
      location: { origin: 'http://era.test' },
      sessionStorage: {
        getItem: (key: string) => session.get(key) ?? null,
      },
      SillyTavern: {
        characterId: 'top-card',
        groupId: null,
        getCurrentChatId: () => 'top-chat',
      },
      __STTestHarnessEraPackLoaderV4: { scriptId: 'top-script' },
    };
    vi.stubGlobal('window', { top, location: { origin: 'http://era.test' } });
    vi.stubGlobal('getVariables', () => ({
      __eraSidecarTestV1: marker({
        characterId: 'top-card',
        groupId: null,
        chatId: 'top-chat',
        scriptId: 'top-script',
      }),
    }));

    const result = await createSidecarTestAdapter().read_context({}, { signal: new AbortController().signal });

    expect(result).toMatchObject({
      identity: { characterId: 'top-card', groupId: null, chatId: 'top-chat', scriptId: 'top-script' },
    });
  });

  it('顶层直读未导出时回退到 Tavern context 与当前脚本 ID', async () => {
    const session = new Map<string, string>();
    session.set('__ERA_SIDECAR_TEST_FIXTURE_V1__', JSON.stringify(fixture()));
    const top = {
      location: { origin: 'http://era.test' },
      sessionStorage: { getItem: (key: string) => session.get(key) ?? null },
      SillyTavern: {
        getContext: () => ({ characterId: 'context-card', groupId: null, chatId: 'context-chat' }),
      },
      __STTestHarnessEraPackLoaderV4: {},
    };
    vi.stubGlobal('window', { top, location: { origin: 'http://era.test' } });
    vi.stubGlobal('getScriptId', () => 'current-script');
    vi.stubGlobal('getVariables', () => ({
      __eraSidecarTestV1: marker({
        characterId: 'context-card',
        groupId: null,
        chatId: 'context-chat',
        scriptId: 'current-script',
      }),
    }));

    const result = await createSidecarTestAdapter().read_context({}, { signal: new AbortController().signal });

    expect(result).toMatchObject({
      identity: { characterId: 'context-card', groupId: null, chatId: 'context-chat', scriptId: 'current-script' },
    });
  });

  it('跨 realm 时保留 Pack 顶层 fixture 槽，但身份读取回退到当前 Tavern realm', async () => {
    const session = new Map<string, string>();
    session.set('__ERA_SIDECAR_TEST_FIXTURE_V1__', JSON.stringify(fixture()));
    const top = {
      location: { origin: 'https://top.invalid' },
      sessionStorage: { getItem: (key: string) => session.get(key) ?? null },
      SillyTavern: { characterId: 'wrong-top-card', groupId: null, getCurrentChatId: () => 'wrong-top-chat' },
      __STTestHarnessEraPackLoaderV4: { scriptId: 'top-script' },
    };
    vi.stubGlobal('window', {
      top,
      location: { origin: 'https://iframe.invalid' },
      SillyTavern: { characterId: 'local-card', groupId: null, getCurrentChatId: () => 'local-chat' },
    });
    vi.stubGlobal('getScriptId', () => 'local-script');
    vi.stubGlobal('getVariables', () => ({
      __eraSidecarTestV1: marker({
        characterId: 'local-card',
        groupId: null,
        chatId: 'local-chat',
        scriptId: 'local-script',
      }),
    }));

    const result = await createSidecarTestAdapter().read_context({}, { signal: new AbortController().signal });

    expect(result).toMatchObject({
      fixture: fixture(),
      identity: { characterId: 'local-card', groupId: null, chatId: 'local-chat', scriptId: 'local-script' },
    });
  });

  it('注入既有 identity capability 时不再重复读取浏览器全局', async () => {
    const session = new Map<string, string>();
    session.set('__ERA_SIDECAR_TEST_FIXTURE_V1__', JSON.stringify(fixture()));
    vi.stubGlobal('window', { top: { sessionStorage: { getItem: (key: string) => session.get(key) ?? null } } });
    vi.stubGlobal('getVariables', () => ({
      __eraSidecarTestV1: marker({
        characterId: 'capability-card',
        groupId: null,
        chatId: 'capability-chat',
        scriptId: 'capability-script',
      }),
    }));

    const result = await createSidecarTestAdapter({
      readCurrentIdentity: () => ({
        characterId: 'capability-card',
        groupId: null,
        chatId: 'capability-chat',
        scriptId: 'capability-script',
      }),
    }).read_context({}, { signal: new AbortController().signal });

    expect(result).toMatchObject({
      identity: {
        characterId: 'capability-card',
        groupId: null,
        chatId: 'capability-chat',
        scriptId: 'capability-script',
      },
    });
  });

  it('严格区分精确匹配、无 marker、损坏 marker 与同角色错聊天', () => {
    expect(
      observeSidecarTestIdentity({ identity: current, marker: marker(), fixture: fixture() }, event),
    ).toMatchObject({
      status: 'matched',
      reason: 'exact-owner-match',
      currentIdentity: current,
      markerOwner: current,
    });
    expect(observeSidecarTestIdentity({ identity: current, fixture: fixture() }, event)).toMatchObject({
      status: 'not-applicable',
      reason: 'marker-absent',
    });
    expect(
      observeSidecarTestIdentity({ identity: current, marker: { schemaVersion: 1 }, fixture: fixture() }, event),
    ).toMatchObject({
      status: 'invalid',
      reason: 'marker-invalid',
    });
    expect(
      observeSidecarTestIdentity(
        { identity: { ...current, chatId: 'chat-b' }, marker: marker(), fixture: fixture() },
        event,
      ),
    ).toMatchObject({ status: 'unbound', reason: 'owner-chat-or-script-mismatch' });
    expect(observeSidecarTestIdentity({ fixture: fixture(), technicalError: true }, event)).toMatchObject({
      status: 'invalid',
      reason: 'technical-context-read-failed',
    });
  });

  it('只在已明确退役且 portable 时给出重绑建议，其他跨角色情形保持冲突', () => {
    const oldOwner = { ...current, characterId: 'old-card', chatId: 'old-chat' };
    expect(
      observeSidecarTestIdentity(
        { identity: current, marker: marker(oldOwner), fixture: fixture([sidecarOwnerKey(oldOwner)]) },
        event,
      ),
    ).toMatchObject({ status: 'rebind-approved', reason: 'portable-marker-owner-retired' });
    expect(
      observeSidecarTestIdentity({ identity: current, marker: marker(oldOwner), fixture: fixture() }, event),
    ).toMatchObject({ status: 'conflict', reason: 'marker-owner-still-active' });
    expect(
      observeSidecarTestIdentity(
        { identity: current, marker: marker(oldOwner, false), fixture: fixture([sidecarOwnerKey(oldOwner)]) },
        event,
      ),
    ).toMatchObject({ status: 'conflict', reason: 'marker-owner-still-active' });
  });

  it('未启用 fixture 或无关事件时完全不观察；启动后的真实 generation_started 可补获启动身份', () => {
    expect(observeSidecarTestIdentity({ identity: current, marker: marker(), fixture: null }, event)).toBeNull();
    expect(
      observeSidecarTestIdentity(
        { identity: current, marker: marker(), fixture: fixture() },
        { ...event, type: 'message_received' },
      ),
    ).toBeNull();
    expect(
      observeSidecarTestIdentity(
        { identity: current, marker: marker(), fixture: fixture() },
        { ...event, type: 'generation_started' },
      ),
    ).toMatchObject({ status: 'matched', reason: 'exact-owner-match' });
  });
});
