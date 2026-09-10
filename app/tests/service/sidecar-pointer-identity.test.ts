import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSidecarAdapter } from '../../src/ERA变量框架/service/sidecar-adapter';
import {
  clearSidecarRuntimeSnapshot,
  readActiveSidecarRuntimeSnapshot,
} from '../../src/ERA变量框架/service/sidecar-runtime-snapshot';

const owner = { characterId: 'card-a', groupId: null, chatId: 'chat-a' };
const sidecarId = 'era_chat_12345678';
afterEach(() => {
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
    await expect(createSidecarAdapter().commit_metadata(input, context)).rejects.toMatchObject({
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
        Promise.resolve().then(() =>
          createSidecarAdapter()[operation](
            { ...input, record: input.snapshot, expectedSidecarId: sidecarId },
            context,
          ),
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
    await expect(createSidecarAdapter().commit_metadata(input, context)).resolves.toMatchObject({
      status: 'committed',
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(variables).toEqual({ ERAMetaData: { SidecarId: sidecarId } });
    expect(readActiveSidecarRuntimeSnapshot()).toMatchObject({ identity: owner, statData: { hp: 10 } });
  });
});
