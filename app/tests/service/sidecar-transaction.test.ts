import { businessWorkflowNode } from './business-workflow-node';
import { workingCapabilityFixture } from './working-capability-fixture';
import { describe, expect, it } from 'vitest';
import {
  inspectSidecar,
  recordFor,
  resolveSidecar,
} from '../../../javascript_project/service/base_lib/sidecar_binding';
import { assertMessageWriteTargets } from '../../src/ERA变量框架/service/message-write-target';
const id = 'era_chat_12345678';
const targetId = 'era_chat_87654321';
const original = { characterId: 'card', groupId: null, chatId: 'chat-a' };
function fixture(choice: 'migrate' | 'copy' | 'independent' | 'repair' | null = 'migrate') {
  let identity = { ...original };
  let pointer: string | null = choice === null ? null : id;
  let stored = recordFor(id, choice === 'repair' ? original : { ...original, chatId: 'old-chat' }, { hp: 10 }, null);
  let messages = [{ schemaVersion: 1, messageId: 0, role: 'assistant', activeText: '原文', swipeIndex: 0 }];
  const calls: string[] = [];
  const observed: Record<string, unknown>[] = [];
  let saveFails = false;
  let afterMessage: (() => void) | undefined;
  let afterRead: (() => void) | undefined;
  let wrongReadback = false;
  let currentReads = 0;
  let afterCurrent: ((count: number) => void) | undefined;
  const current = () => ({ identity, meta: pointer ? { SidecarId: pointer } : null, stat: null });
  const basis = { identity: { ...original }, messages: structuredClone(messages) };
  const prepared = messages.map(message => ({
    ...message,
    activeText: `${message.activeText}<era_data>mk</era_data>`,
  }));
  const sync = {
    schemaVersion: 1,
    status: 'ready',
    state: {},
    failure: null,
    step: {
      dispatchContext: {
        sourceBasis: basis,
        messages: prepared,
        processingMessage: prepared[0],
        stagedMessageUpdates: [{ messageId: 0, content: prepared[0].activeText }],
      },
    },
    variablesRaw: current(),
    messagesRaw: { schemaVersion: 2, messages: prepared },
  };
  const facts = inspectSidecar(current(), pointer ? { status: 'found', record: stored } : null);
  const check = (input: Record<string, unknown>) => {
    const source = input.sourceBasis as typeof basis;
    if (!source) throw new Error('missing sourceBasis');
    assertMessageWriteTargets(
      source.identity,
      identity,
      source.messages.map(m => ({
        messageId: m.messageId,
        swipeId: m.swipeIndex,
        sourceText: m.activeText,
        role: m.role,
      })),
      messageId => {
        const message = messages.find(m => m.messageId === messageId);
        return message ? { swipeId: message.swipeIndex, text: message.activeText, role: message.role } : null;
      },
    );
    if ('expectedSidecarId' in input && input.expectedSidecarId !== pointer) throw new Error('binding changed');
  };
  const context = {
    capabilities: {
      'era.tavern.agent': {
        read_session_binding: () => {
          throw new Error('unexpected candidate recovery');
        },
        write_session: () => {
          throw new Error('unexpected candidate recovery');
        },
        clear_session: () => {
          throw new Error('unexpected candidate recovery');
        },
      },
      'era.tavern.sidecar': {
        ...workingCapabilityFixture(),
        read_current: async () => {
          const value = structuredClone(current());
          afterCurrent?.(++currentReads);
          return value;
        },
        read_record: async () => {
          afterRead?.();
          return {
            status: 'found',
            record:
              wrongReadback && calls.includes('file')
                ? { ...stored, state: { ...stored.state, statData: { hp: 999 } } }
                : stored,
          };
        },
        write_record: async (input: Record<string, unknown>) => {
          check(input);
          calls.push('file');
          stored = input.record as typeof stored;
          observed.push(input);
          return { status: 'committed' };
        },
        commit_metadata: async (input: Record<string, unknown>) => {
          check(input);
          calls.push('pointer');
          pointer = input.sidecarId as string;
          return { status: 'committed' };
        },
        clear_prompt: (input: Record<string, unknown>) => {
          check(input);
          calls.push('clear');
          return {};
        },
        create_id: () => ({ sidecarId: targetId }),
        publish_snapshot: () => ({ status: 'published' }),
      },
      'era.tavern.messages': {
        update_content: async (input: Record<string, unknown>) => {
          check(input);
          calls.push('message');
          observed.push(input);
          messages = messages.map(m => ({ ...m, activeText: input.content as string }));
          afterMessage?.();
          return saveFails
            ? { status: 'failed', writeState: 'memory-written', persistenceConfirmed: false, message: 'save failed' }
            : { status: 'committed' };
        },
      },
    },
  };
  return {
    calls,
    observed,
    context,
    sync,
    run: async () =>
      await businessWorkflowNode(
        'era.sidecar_binding.apply_resolution',
        {
          'era.sidecar.binding.input': { value: { sync } },
          'era.sidecar.binding.resolution': { value: { facts, route: 'apply', choice } },
        },
        {},
        context,
      ),
    switchChat: () => {
      identity = { ...identity, chatId: 'chat-b' };
    },
    switchSwipe: () => {
      messages[0].swipeIndex = 1;
    },
    edit: () => {
      messages[0].activeText = '编辑后';
    },
    rebind: () => {
      pointer = targetId;
    },
    failSave: () => {
      saveFails = true;
    },
    corruptReadback: () => {
      wrongReadback = true;
    },
    afterMessage: (fn: () => void) => {
      afterMessage = fn;
    },
    afterCurrent: (fn: (count: number) => void) => {
      afterCurrent = fn;
    },
    afterRead: (fn: () => void) => {
      afterRead = fn;
    },
  };
}
describe('真实 Sidecar Node 的来源与保存顺序', () => {
  it.each(['migrate', 'copy'] as const)('%s 保留严格正文，已确认恢复更新依据并消耗暂存写入', async choice => {
    const f = fixture(choice);
    const result = await f.run();
    expect(result.sidecar_applied_context.status).toBe('ready');
    expect(f.calls).toEqual(['message', 'file', 'pointer', 'clear']);
    expect(f.observed[0].content).toMatch(/^原文<era_data>mk<\/era_data>/);
    expect(result.sidecar_applied_context.step.dispatchContext.stagedMessageUpdates).toEqual([]);
    expect(
      (
        f.observed[1].sourceBasis as {
          messages: {
            activeText: string;
          }[];
        }
      ).messages[0].activeText,
    ).toBe(f.observed[0].content);
  });
  it.each(['switchChat', 'switchSwipe', 'edit', 'rebind'] as const)('%s 后不发出实际写入', async action => {
    const f = fixture();
    f[action]();
    const result = await f.run();
    expect(result.sidecar_applied_context.status).toBe('failed');
    expect(f.calls).toEqual([]);
  });
  it('最后一次读取已返回旧指针时，消息实际写入边界仍拒绝重新绑定', async () => {
    const f = fixture();
    f.afterCurrent(count => {
      if (count === 2) f.rebind();
    });
    const result = await f.run();
    expect(result.sidecar_applied_context.status).toBe('failed');
    expect(f.calls).toEqual([]);
  });
  it('保存失败保留内存已写事实，但不提交文件或指针', async () => {
    const f = fixture();
    f.failSave();
    const result = await f.run();
    expect(f.calls).toEqual(['message']);
    expect(result.sidecar_applied_context.failure.details).toMatchObject({
      messageWriteState: 'memory-written',
      persistenceConfirmed: false,
      fileWriteState: 'not-written',
    });
  });
  it('消息已保存后切聊不写文件、不清除新聊天提示', async () => {
    const f = fixture();
    f.afterMessage(f.switchChat);
    const result = await f.run();
    expect(f.calls).toEqual(['message']);
    expect(result.sidecar_applied_context.status).toBe('failed');
    expect(result.sidecar_applied_context.failure.details.persistenceConfirmed).toBe(true);
  });
  it('文件相同 revision 但内容错误时不提交指针', async () => {
    const f = fixture();
    f.corruptReadback();
    const result = await f.run();
    expect(f.calls).toEqual(['message', 'file']);
    expect(result.sidecar_applied_context.status).toBe('failed');
  });
  it.each(['independent', 'repair', null] as const)('%s 路径不写恢复消息且保持文件确认顺序', async choice => {
    const f = fixture(choice);
    const result = await f.run();
    expect(result.sidecar_applied_context.status).toBe('ready');
    expect(f.calls).toEqual(choice === null ? ['file', 'pointer'] : ['file', 'pointer', 'clear']);
  });
  it('读取文件期间切聊形成失败上下文，选择器不再弹出绑定选择', async () => {
    const f = fixture();
    f.afterRead(f.switchChat);
    const result = await businessWorkflowNode(
      'era.sidecar_binding.inspect_current',
      { 'era.sync.context': { value: f.sync } },
      {},
      f.context,
    );
    expect(result.sidecar_binding_input.sync.status).toBe('failed');
    expect(resolveSidecar(result.sidecar_binding_facts, result.sidecar_binding_input.sync).route).toBe('continue');
    expect(f.calls).toEqual([]);
  });
});
