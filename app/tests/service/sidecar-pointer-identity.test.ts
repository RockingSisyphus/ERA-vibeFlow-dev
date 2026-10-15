import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture as nativeFixture } from '../native-tavern/native-fixture.mjs';
const nativeOwners: any[] = [];
async function adapter() {
  const native = await nativeFixture(undefined, {
    api: { ...globalThis, location: { origin: 'http://tavern.test' } },
    publishSnapshot: publishSidecarRuntimeSnapshot,
  });
  nativeOwners.push(native);
  return Object.fromEntries(
    Object.entries(native.caps['era.tavern.sidecar']).map(([name, fn]: [string, any]) => [
      name,
      (...args: any[]) => {
        try {
          const value = fn(...args);
          return value?.then
            ? value.catch((error: any) => {
                throw error.cause ?? error;
              })
            : value;
        } catch (error: any) {
          throw error.cause ?? error;
        }
      },
    ]),
  );
}
import {
  clearSidecarRuntimeSnapshot,
  publishSidecarRuntimeSnapshot,
  readActiveSidecarRuntimeSnapshot,
  subscribeSidecarRuntimeSnapshot,
} from '../../src/ERA变量框架/service/sidecar-runtime-snapshot';

const owner = { characterId: 'card-a', groupId: null, chatId: 'chat-a' };
const sidecarId = 'era_chat_12345678';
afterEach(async () => {
  for (const native of nativeOwners.splice(0)) {
    native.page.dispatchEvent(new Event('pagehide'));
    await native.work;
  }
  clearSidecarRuntimeSnapshot();
  vi.unstubAllGlobals();
});
function fixture(current: typeof owner) {
  const variables = { stat_data: { hp: 88 }, ERAMetaData: { SidecarId: 'era_chat_87654321' } };
  const write = vi.fn((update: (value: Record<string, unknown>) => unknown) => update(variables));
  vi.stubGlobal('getCurrentCharacterId', () => current.characterId);
  vi.stubGlobal('SillyTavern', { groupId: current.groupId, getCurrentChatId: () => current.chatId });
  vi.stubGlobal('updateVariablesWith', write);
  vi.stubGlobal('getVariables', () => variables);
  return { variables, write };
}
const input = {
  sidecarId,
  snapshot: { owner, revision: 1, state: { statData: { hp: 10 }, statFunc: {}, eraMeta: {} } },
};
const context = { signal: new AbortController().signal };

describe('Sidecar 指针提交紧贴当前宿主身份', () => {
  it.each([
    { ...owner, chatId: 'chat-b' },
    { ...owner, characterId: 'card-b' },
  ])('文件回读后切换身份时不覆盖新聊天指针或删除旧状态：%j', async identity => {
    const { variables, write } = fixture(identity);
    await expect((await adapter()).commit_metadata(input, context)).rejects.toMatchObject({
      code: 'ERA_MESSAGE_WRITE_TARGET_CHANGED',
      reason: 'chat',
      written: false,
    });
    expect(write).not.toHaveBeenCalled();
    expect(variables).toEqual({ stat_data: { hp: 88 }, ERAMetaData: { SidecarId: 'era_chat_87654321' } });
    expect(readActiveSidecarRuntimeSnapshot()).toBeNull();
  });
  it.each(['write_record', 'commit_metadata', 'clear_prompt'] as const)(
    '同聊天重新绑定后 %s 不执行副作用',
    async operation => {
      const { variables, write } = fixture(owner);
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      await expect(
        Promise.resolve().then(async () =>
          (await adapter())[operation]({ ...input, record: input.snapshot, expectedSidecarId: sidecarId }, context),
        ),
      ).rejects.toMatchObject({
        code: 'ERA_MESSAGE_WRITE_TARGET_CHANGED',
        reason: 'binding',
        written: false,
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
      expect(variables.ERAMetaData.SidecarId).toBe('era_chat_87654321');
      expect(readActiveSidecarRuntimeSnapshot()).toBeNull();
    },
  );
  it('身份一致时提交原指针并发布已确认的快照', async () => {
    const { variables, write } = fixture(owner);
    await expect((await adapter()).commit_metadata(input, context)).resolves.toMatchObject({
      status: 'committed',
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(variables).toEqual({ ERAMetaData: { SidecarId: sidecarId } });
    expect(readActiveSidecarRuntimeSnapshot()).toMatchObject({ identity: owner, statData: { hp: 10 } });
  });
});

it('中间块更新即时读取缓存，消息完成才通知已有订阅者', async () => {
  fixture(owner);
  const listener = vi.fn();
  const unsubscribe = subscribeSidecarRuntimeSnapshot(listener);
  listener.mockClear();
  try {
    await (await adapter()).commit_metadata({ ...input, notifySubscribers: false }, context);
    expect(readActiveSidecarRuntimeSnapshot()?.statData).toEqual({ hp: 10 });
    expect(listener).not.toHaveBeenCalled();
    await (await adapter()).commit_metadata({ ...input, snapshot: { ...input.snapshot, revision: 2 } }, context);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].revision).toBe(2);
  } finally {
    unsubscribe();
  }
});
