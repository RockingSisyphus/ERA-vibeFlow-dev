import { describe, expect, it } from 'vitest';
import { updateEraMetaData, updateEraStatData } from '../../src/ERA变量框架/utils/era_data';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 验证同一 VibeFlow 纯规则。
// @ts-ignore app test root 直接复用 service 纯规则。
import {
  durableFunctionRestoreInstruction,
  durableRestoreInstruction,
  inspectSidecar,
  parseRecord,
  recordFor,
  resolveSidecar,
  stateForIndependentCopy,
} from '../../../javascript_project/service/base_lib/sidecar_binding';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 验证提交后镜像失败的 workflow 行为。
// @ts-ignore app test root 直接复用 Service Sidecar 节点。
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 验证修复事务使用重新读取的当前聊天状态。
// @ts-ignore app test root 直接复用 Service Sidecar 节点。
import { run as applyResolution } from '../../../javascript_project/service/nodes/sidecar/apply_resolution';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 验证同一 Service 事件规划规则。
// @ts-ignore app test root 直接复用 Service 规划器。
import { planEventBatch } from '../../../javascript_project/service/base_lib/domain/event_planner';

const current = { characterId: 'card-a', groupId: null, chatId: 'chat-a' };
const sidecarId = 'era_chat_12345678-1234-4234-8234-123456789abc';

function currentContext(id = sidecarId, legacy = false) {
  return { identity: current, meta: { SidecarId: id }, stat: legacy ? { player: { hp: 10 } } : null };
}

function sidecarChoiceStep(choice: 'migrate' | 'independent' | 'copy' | 'repair') {
  return {
    kind: 'execute',
    task: {
      kind: 'sync',
      primaryEvent: {
        type: 'era.ui.sidecar_binding_choice',
        args: [{ kind: 'json', value: { choice } }],
      },
    },
  };
}

describe('ERA Sidecar 绑定纯规则', () => {
  it('冻结旧写入 helper，避免任何生产路径回退把状态写入聊天变量', async () => {
    await expect(updateEraStatData(() => ({ player: { hp: 99 } }))).rejects.toThrow(
      'ERA_LEGACY_CHAT_STATE_WRITE_FORBIDDEN',
    );
    await expect(updateEraMetaData(() => ({ SelectedMks: [] }))).rejects.toThrow(
      'ERA_LEGACY_CHAT_STATE_WRITE_FORBIDDEN',
    );
  });

  it('同一角色卡与聊天的记录精确匹配', () => {
    const record = recordFor(sidecarId, current, { player: { hp: 10 } }, null);
    expect(inspectSidecar(currentContext(), { status: 'found', record })).toMatchObject({
      status: 'matched',
      sidecarId,
      reason: 'owner-matched',
    });
  });

  it('所有新提交均为 V3，并把函数库与变量状态一同放入 Sidecar', () => {
    const record = recordFor(
      sidecarId,
      current,
      {
        statData: { player: { hp: 10 } },
        eraMeta: { SelectedMks: ['mk-1'], EditLogs: {} },
        statFunc: { scale: { params: ['x'], expr: 'x * 2' } },
      },
      null,
    );
    expect(record).toMatchObject({
      schemaVersion: 3,
      state: {
        statData: { player: { hp: 10 } },
        statFunc: { scale: { params: ['x'], expr: 'x * 2' } },
      },
    });
    expect(parseRecord(record, sidecarId)).toEqual(record);
  });

  it('复制变量深拷贝状态和函数，却不带入旧聊天的回放索引', () => {
    const record = recordFor(
      sidecarId,
      current,
      {
        statData: { player: { hp: 10 } },
        statFunc: { scale: { params: ['x'], expr: 'x * 2' } },
        eraMeta: {
          SelectedMks: ['old-mk'],
          EditLogs: { 'old-mk': [{ path: 'player.hp' }] },
          FunctionEditLogs: { 'old-mk': [{ name: 'scale' }] },
          CompressedEraCommands: { 'old-mk': { version: 1 } },
          userSetting: 'preserved',
        },
      },
      null,
    );
    const copied = stateForIndependentCopy(record);
    expect(copied).toMatchObject({
      statData: { player: { hp: 10 } },
      statFunc: { scale: { params: ['x'], expr: 'x * 2' } },
      eraMeta: { userSetting: 'preserved' },
    });
    expect(copied.eraMeta).not.toHaveProperty('SelectedMks');
    expect(copied.eraMeta).not.toHaveProperty('EditLogs');
    expect(copied.eraMeta).not.toHaveProperty('FunctionEditLogs');
    expect(copied.eraMeta).not.toHaveProperty('CompressedEraCommands');
    (copied.statData as { player: { hp: number } }).player.hp = 99;
    expect((record.state.statData as { player: { hp: number } }).player.hp).toBe(10);
  });

  it('同一 ID 被另一聊天占用时明确形成冲突', () => {
    const record = recordFor(sidecarId, { ...current, chatId: 'chat-old' }, { player: { hp: 10 } }, null);
    expect(inspectSidecar(currentContext(), { status: 'found', record })).toMatchObject({
      status: 'conflict',
      reason: 'owner-mismatch',
    });
  });

  it('已获角色卡脚本许可的新聊天无指针时进入创建，而不再以元数据猜测是否运行 ERA', () => {
    expect(inspectSidecar({ identity: current, meta: null }, null)).toMatchObject({
      status: 'create',
      reason: 'sidecar-id-absent',
    });
  });

  it('损坏或缺失记录 fail-closed', () => {
    expect(inspectSidecar(currentContext(), { status: 'missing' })).toMatchObject({ status: 'invalid' });
    expect(
      parseRecord(
        { schemaVersion: 1, sidecarId, owner: current, revision: -1, statData: {}, updatedAt: '' },
        sidecarId,
      ),
    ).toBeNull();
  });

  it('冲突没有用户选择时阻塞，有选择时才允许执行事务', () => {
    const facts = inspectSidecar(currentContext(), {
      status: 'found',
      record: recordFor(sidecarId, { ...current, chatId: 'chat-old' }, {}, null),
    });
    expect(resolveSidecar(facts, { step: {}, variablesRaw: {}, messagesRaw: {} }).route).toBe('blocked');
    expect(
      resolveSidecar(facts, {
        step: sidecarChoiceStep('copy'),
        variablesRaw: {},
        messagesRaw: {},
      }),
    ).toMatchObject({ route: 'apply', choice: 'copy' });
    expect(
      resolveSidecar(facts, {
        step: sidecarChoiceStep('repair'),
        variablesRaw: {},
        messagesRaw: {},
      }).route,
    ).toBe('blocked');
  });

  it('损坏记录只能在用户明确选择修复后重建', () => {
    const facts = inspectSidecar(currentContext(), { status: 'missing' });
    expect(resolveSidecar(facts, { step: {}, variablesRaw: {}, messagesRaw: {} }).route).toBe('blocked');
    expect(
      resolveSidecar(facts, {
        step: sidecarChoiceStep('repair'),
        variablesRaw: {},
        messagesRaw: {},
      }),
    ).toMatchObject({ route: 'apply', choice: 'repair' });
  });

  it('已匹配聊天只有明确 repair 才会重试失败的本地镜像', () => {
    const record = recordFor(sidecarId, current, { player: { hp: 10 } }, null);
    const facts = inspectSidecar(currentContext(), { status: 'found', record });
    expect(resolveSidecar(facts, { step: {}, variablesRaw: {}, messagesRaw: {} })).toMatchObject({
      route: 'continue',
      choice: null,
    });
    expect(
      resolveSidecar(facts, {
        step: sidecarChoiceStep('repair'),
        variablesRaw: {},
        messagesRaw: {},
      }),
    ).toMatchObject({ route: 'apply', choice: 'repair' });
  });

  it('只接受 Sidecar UI 事件的 ABI JSON 参数，普通同步不得伪造选择', () => {
    const record = recordFor(sidecarId, current, { player: { hp: 10 } }, null);
    const facts = inspectSidecar(currentContext(), { status: 'found', record });
    expect(
      resolveSidecar(facts, {
        step: {
          kind: 'execute',
          task: {
            kind: 'sync',
            primaryEvent: { type: 'manual_sync', args: [{ kind: 'json', value: { choice: 'repair' } }] },
          },
        },
        variablesRaw: {},
        messagesRaw: {},
      }),
    ).toMatchObject({ route: 'continue', choice: null });
    expect(
      resolveSidecar(facts, {
        step: {
          kind: 'execute',
          task: { kind: 'sync', primaryEvent: { type: 'era.ui.sidecar_binding_choice', args: [{ choice: 'repair' }] } },
        },
        variablesRaw: {},
        messagesRaw: {},
      }),
    ).toMatchObject({ route: 'continue', choice: null });
  });

  it('所有 Sidecar 选择都请求完整重放，repair 也必须重放已确认的文件失败前指令', () => {
    const plan = (choice: 'repair' | 'migrate' | 'independent' | 'copy') =>
      planEventBatch([
        {
          schemaVersion: 1,
          eventId: `sidecar-${choice}`,
          sequence: 1,
          type: 'era.ui.sidecar_binding_choice',
          occurredAt: 1,
          source: 'ui',
          args: [{ kind: 'json', value: { choice } }],
          encodedBytes: 1,
        },
      ])[0];
    for (const choice of ['repair', 'migrate', 'independent', 'copy'] as const) {
      expect(plan(choice)).toMatchObject({ kind: 'execute', task: { kind: 'sync', fullRebuild: true } });
    }
  });

  it('repair 镜像重新读取到的当前变量，而不是旧同步上下文', async () => {
    const record = recordFor(sidecarId, current, { player: { hp: 10 } }, null);
    const writes: unknown[] = [];
    const clears: unknown[] = [];
    let persisted = record;
    await applyResolution(
      {
        'era.sidecar.binding.input': {
          value: {
            sync: {
              step: sidecarChoiceStep('repair'),
              variablesRaw: { ERAMetaData: { SidecarId: sidecarId }, stat_data: {} },
              messagesRaw: { schemaVersion: 2, messages: [] },
            },
          },
        },
        'era.sidecar.binding.resolution': {
          value: {
            facts: inspectSidecar(currentContext(), { status: 'found', record }),
            route: 'apply',
            choice: 'repair',
          },
        },
      },
      {},
      {
        capabilities: {
          'era.tavern.sidecar': {
            read_current: async () => currentContext(),
            read_record: async () => ({ status: 'found', record: persisted }),
            write_record: async (input: unknown) => {
              writes.push(input);
              persisted = (input as { readonly record: typeof record }).record;
              return { status: 'committed' };
            },
            commit_metadata: async () => ({ status: 'committed' }),
            create_id: () => ({ sidecarId: 'era_chat_unused' }),
            clear_prompt: (input: unknown) => clears.push(input),
          },
          'era.tavern.messages': { update_content: async () => ({}) },
        },
      },
    );
    expect(writes).toEqual([
      expect.objectContaining({
        sidecarId,
        record: expect.objectContaining({ state: expect.objectContaining({ statData: { player: { hp: 10 } } }) }),
      }),
    ]);
    expect(clears).toEqual([{}]);
  });

  it('迁移完成后只向 task_sync 输出规范 continue 路由', async () => {
    const record = recordFor(sidecarId, { ...current, chatId: 'chat-old' }, { player: { hp: 10 } }, null);
    const conflictCurrent = currentContext();
    const writes: unknown[] = [];
    let persisted = record;
    const result = await applyResolution(
      {
        'era.sidecar.binding.input': {
          value: {
            sync: {
              step: sidecarChoiceStep('migrate'),
              variablesRaw: {
                scope: { type: 'chat' },
                variables: { ERAMetaData: { SidecarId: sidecarId }, stat_data: { player: { hp: 1 } } },
              },
              messagesRaw: { schemaVersion: 2, messages: [{ messageId: 7, role: 'assistant', content: '原始回复' }] },
            },
          },
        },
        'era.sidecar.binding.resolution': {
          value: {
            facts: inspectSidecar(conflictCurrent, { status: 'found', record }),
            route: 'apply',
            choice: 'migrate',
          },
        },
      },
      {},
      {
        capabilities: {
          'era.tavern.sidecar': {
            read_current: async () => conflictCurrent,
            read_record: async () => ({ status: 'found', record: persisted }),
            write_record: async (input: unknown) => {
              writes.push(input);
              persisted = (input as { readonly record: typeof record }).record;
              return { status: 'committed' };
            },
            commit_metadata: async () => ({ status: 'committed' }),
            create_id: () => ({ sidecarId: 'era_chat_unused' }),
            clear_prompt: () => ({}),
          },
          'era.tavern.messages': { update_content: async () => ({ status: 'committed' }) },
        },
      },
    );
    expect(result).toMatchObject({ sidecar_binding_route: 'continue' });
    expect(result.sidecar_applied_context).toMatchObject({
      sidecarBindingRoute: 'continue',
      sidecarBindingChoice: 'migrate',
      variablesRaw: { stat_data: { player: { hp: 10 } }, ERAMetaData: { SidecarId: sidecarId } },
    });
    expect(writes).toEqual([
      expect.objectContaining({
        sidecarId,
        record: expect.objectContaining({
          owner: current,
          revision: 2,
          state: expect.objectContaining({ statData: { player: { hp: 10 } } }),
        }),
      }),
    ]);
  });

  it('恢复指令显式删除旧根键并拒绝受保护根键', () => {
    const instruction = durableRestoreInstruction({ stale: 1, nested: { value: 2 } }, { player: { hp: 10 } });
    expect(instruction).toContain('<VariableDelete>');
    expect(instruction).toContain('{"stale":null,"nested":null}');
    expect(instruction).toContain('<VariableInsert>');
    expect(durableRestoreInstruction({ protected: { $meta: { necessary: 'self' } } }, { player: {} })).toBeNull();
  });

  it('函数恢复指令通过幂等删除和完整插入保留可重放函数库', () => {
    const instruction = durableFunctionRestoreInstruction(
      { stale: { params: ['x'], expr: 'x' }, shared: { params: ['x'], expr: 'x + 1' } },
      { shared: { params: ['x'], expr: 'x * 2' }, scale: { params: ['x'], expr: 'x + 3' } },
    );
    expect(instruction).toContain('<FunctionDelete>');
    expect(instruction).toContain('"stale":{}');
    expect(instruction).toContain('<FunctionInsert>');
    expect(instruction).toContain('"scale"');
    expect(durableFunctionRestoreInstruction(null, {})).toBeNull();
  });
});
