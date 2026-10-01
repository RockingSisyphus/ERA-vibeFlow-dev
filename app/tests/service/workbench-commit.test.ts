import { submissionKind } from '../../../javascript_project/service/nodes/api/facade_nodes';
import { workingCapabilityFixture } from './working-capability-fixture';
import { describe, expect, it, vi } from 'vitest';
import {
  WorkbenchRejectDraftNode as reject,
  WorkbenchPublishPreparationNode as publish,
} from '../../../javascript_project/service/nodes/api/shared_workbench_adapters';
import { run as read } from '../../../javascript_project/service/nodes/api/workbench_read_baseline';
import {
  WorkbenchValidateDraftNode as validate,
  WorkbenchNormalizeOrderedNode as ordered,
} from '../../../javascript_project/service/nodes/api/shared_workbench_operation_adapters';
import { run as variables } from '../../../javascript_project/service/nodes/api/workbench_plan_variables';
import { run as functions } from '../../../javascript_project/service/nodes/api/workbench_plan_functions';
import { run as protect } from '../../../javascript_project/service/nodes/api/workbench_apply_protection';
import {
  buildTransaction,
  inspectWindow,
  validateCommit,
} from '../../../javascript_project/service/base_lib/facade_api_engine';
import { planVariableDiff, variablePlanProtections } from '@era/vibeflow-workbench';

const owner = { characterId: 'c', groupId: null, chatId: 'chat' };
const identity = { ...owner, scriptId: 'script', lifecycleToken: 7 };
const sidecarId = 'era_chat_12345678';
function fixture(patch: Record<string, unknown> = {}, statData: unknown = { hp: 10 }, statFunc = {}) {
  const intent = {
    domain: 'variable',
    mode: 'edit',
    path: ['hp'],
    initial: 10,
    value: 11,
    protections: [],
    choice: '',
    revision: 1,
    sidecarId,
    identityKey: JSON.stringify(owner),
    ...patch,
  };
  const event = { eventId: 'e', sequence: 1, type: 'era.facade.commit', source: 'ui', args: [] };
  const request = {
    task: { kind: 'api', id: 'task', eventType: event.type, primaryEvent: event, sourceEvents: [], args: [] },
    sources: [{ relation: 'primary', event }],
    dispatchContext: {},
    detail: { command: 'workbench-commit', windowToken: 7, intent },
  };
  const inspected = inspectWindow(
    request,
    {
      schemaVersion: 1,
      nextState: { scopeWindow: { token: null, messageAdmission: null, branchAdmission: null } },
    } as any,
    identity,
    {
      schemaVersion: 2,
      messages: [{ schemaVersion: 1, messageId: 0, role: 'assistant', activeText: '正文', swipeIndex: 0 }],
    },
  );
  const record = { schemaVersion: 3, owner, sidecarId, revision: 2, state: { statData, statFunc, eraMeta: {} } };
  const current = { identity: owner, meta: { SidecarId: sidecarId }, stat: null };
  const capabilities = {
    'era.tavern.sidecar': {
      read_working: workingCapabilityFixture().read_working,
      read_current: vi.fn(async () => structuredClone(current)),
      read_record: vi.fn(async () => ({ status: 'found', record: structuredClone(record) })),
    },
    'era.tavern.identity': { read: vi.fn(() => identity) },
  };
  return { inspected, record, current, capabilities };
}
const input = (type: string, value: unknown) => ({ [type]: { value } });
async function prepare(f: ReturnType<typeof fixture>) {
  const baseline = await read(input('era.api.commit.inspected', f.inspected), {}, { capabilities: f.capabilities });
  const classified = validate(input('era.workbench.baseline', baseline.baseline));
  let result;
  if (classified.draft_kind === 'failed')
    result = reject(input('era.workbench.draft', classified.draft)).rejected_preparation_result;
  else {
    const planner =
      classified.draft_kind === 'variable' ? variables : classified.draft_kind === 'function' ? functions : ordered;
    const planned = Object.values(planner(input('era.workbench.draft', classified.draft)))[0];
    result = protect(input('era.workbench.operation_plan', planned)).protected_preparation_result;
  }
  return publish(input('era.workbench.preparation_result', result));
}

describe('真实工作台准备节点接回原 Commit', () => {
  it('普通公共 commit 绕过草稿读取；工作台结果进入原 always 事务', async () => {
    const f = fixture();
    expect(submissionKind({ detail: { command: 'commit' } })).toBe('operations');
    expect(submissionKind(f.inspected.request)).toBe('draft');
    const result = await prepare(f);
    expect(result.preparation_route).toBe('ready');
    const admitted = validateCommit(result.prepared_commit_inspected) as any;
    expect(admitted.route).toBe('commit');
    expect((buildTransaction(admitted.context) as any).transaction).toContain('<VariableEdit>{"hp":11}</VariableEdit>');
  });
  it('新增不把空表单当父基准；目标冲突明确失败', async () => {
    expect((await prepare(fixture({ mode: 'add', initial: '', path: ['mp'], value: 20 }))).preparation_route).toBe(
      'ready',
    );
    expect((await prepare(fixture({ mode: 'add', initial: '' }))).preparation_route).toBe('failed');
  });
  it('单项编辑保留兄弟变化；整树草稿拒绝陈旧基准', async () => {
    expect((await prepare(fixture({}, { hp: 10, mp: 99 }))).preparation_route).toBe('ready');
    expect(
      (await prepare(fixture({ mode: 'batch', path: [], initial: { hp: 10 }, value: { hp: 11 } }, { hp: 10, mp: 99 })))
        .preparation_route,
    ).toBe('failed');
    expect((await prepare(fixture({}, { hp: 12 }))).preparation_route).toBe('failed');
  });
  it('按 UI 同一语义解码 Sidecar 转义后的键和值', async () => {
    const result = await prepare(fixture({ path: ['a.b'], initial: 'x.y', value: 'new' }, { a__DOT__b: 'x__DOT__y' }));
    expect(result.preparation_route).toBe('ready');
    expect(result.prepared_commit_inspected.request.detail.operations).toEqual([{ edit: { 'a.b': 'new' } }]);
  });
  it('函数单项只改目标；删除被引用函数在写入前失败', async () => {
    const f = { params: ['x'], expr: 'x+1' };
    const g = { params: ['x'], expr: 'f(x)' };
    const result = await prepare(
      fixture({ domain: 'function', name: 'f', initial: f, value: { ...f, expr: 'x+2' } }, {}, { f, g }),
    );
    expect(result.preparation_route).toBe('ready');
    expect(result.prepared_commit_inspected.request.detail.operations).toEqual([
      { functionEdit: { f: { ...f, expr: 'x+2' } } },
    ]);
    expect(
      (await prepare(fixture({ domain: 'function', mode: 'delete', name: 'f', initial: f }, {}, { f, g })))
        .preparation_route,
    ).toBe('failed');
  });
  it('类型替换检查实际 Delete/Insert；保护变化不扩大解锁', async () => {
    const root = { $meta: { unInsertAble: 'all' }, box: { $meta: { necessary: 'self' }, x: 1 } };
    const plan = planVariableDiff(root.box, 20, ['box']);
    const protections = variablePlanProtections(root, plan);
    expect(protections.map(item => item.field).sort()).toEqual(['necessary', 'unInsertAble']);
    const patch = { path: ['box'], initial: root.box, value: 20, protections, choice: 'unlock' };
    expect((await prepare(fixture(patch, root))).preparation_route).toBe('ready');
    expect((await prepare(fixture({ ...patch, protections: [] }, root))).preparation_route).toBe('failed');
    expect((await prepare(fixture({ ...patch, choice: 'temporary' }, root))).preparation_route).toBe('failed');
  });
  it('显式有序操作不自动解除保护且不改变顺序', async () => {
    const operations = [{ delete: { hp: {} } }, { insert: { hp: 20 } }];
    const result = await prepare(
      fixture({ domain: 'ordered', mode: 'batch', path: [], initial: { hp: 10 }, operations }),
    );
    expect(result.prepared_commit_inspected.request.detail.operations).toEqual(operations);
    expect(
      (
        await prepare(
          fixture({
            domain: 'ordered',
            mode: 'batch',
            path: [],
            initial: { hp: 10 },
            operations: [{ functionDelete: { f: {} } }],
          }),
        )
      ).preparation_route,
    ).toBe('failed');
  });
  it('临时解除插入保护时不重建已替换为数值的对象', async () => {
    const box = { $meta: { unInsertAble: 'all' }, x: 1 };
    const root = { box };
    const protections = variablePlanProtections(root, planVariableDiff(box, 20, ['box']));
    const result = await prepare(
      fixture({ path: ['box'], initial: box, value: 20, protections, choice: 'temporary' }, root),
    );
    expect(result.preparation_route).toBe('ready');
    expect(result.prepared_commit_inspected.request.detail.operations).toEqual([
      { edit: { box: { $meta: { unInsertAble: null } } } },
      { delete: { box: {} } },
      { insert: { box: 20 } },
    ]);
  });
  it('函数批量删除必要定义不能临时解除；明确解除保留操作顺序', async () => {
    const f = { params: ['x'], expr: 'x+1', $meta: { necessary: 'self' } };
    const protections = [{ name: 'f', path: [], field: 'necessary', value: 'self' }];
    const patch = { domain: 'function', mode: 'batch', initial: { f }, value: {}, protections, choice: 'temporary' };
    expect((await prepare(fixture(patch, {}, { f }))).preparation_route).toBe('failed');
    const result = await prepare(fixture({ ...patch, choice: 'unlock' }, {}, { f }));
    expect(result.prepared_commit_inspected.request.detail.operations).toEqual([
      { functionDelete: { f: { $meta: { necessary: {} } } } },
      { functionDelete: { f: {} } },
    ]);
  });
  it('变量表达式保留表达式提交，最终求值仍属于原引擎', async () => {
    const result = await prepare(fixture({ expression: 'hp+1' }));
    expect(result.preparation_route).toBe('ready');
    expect(result.prepared_commit_inspected.request.detail.operations).toEqual([{ edit: { hp: { $expr: 'hp+1' } } }]);
  });
  it('无变化与非法表达式不进入事务', async () => {
    expect((await prepare(fixture({ value: 10 }))).preparation_route).toBe('failed');
    expect((await prepare(fixture({ expression: 'missing(' }))).preparation_route).toBe('failed');
  });
  it.each(['read-error', 'chat', 'pointer', 'window', 'owner', 'legacy'])(
    '%s 只产生失败，无迁移或写入能力调用',
    async fault => {
      const f = fixture();
      const sidecar = f.capabilities['era.tavern.sidecar'];
      if (fault === 'read-error') sidecar.read_record.mockRejectedValue(new Error('文件读取失败'));
      if (fault === 'chat')
        sidecar.read_current
          .mockResolvedValueOnce(f.current)
          .mockResolvedValue({ ...f.current, identity: { ...owner, chatId: 'other' } });
      if (fault === 'pointer')
        sidecar.read_current
          .mockResolvedValueOnce(f.current)
          .mockResolvedValue({ ...f.current, meta: { SidecarId: 'era_chat_87654321' } });
      if (fault === 'window')
        f.capabilities['era.tavern.identity'].read.mockReturnValue({ ...identity, lifecycleToken: 8 });
      if (fault === 'owner') f.record.owner = { ...owner, chatId: 'other' };
      if (fault === 'legacy') f.record.schemaVersion = 2;
      const result = await prepare(f);
      expect(result.preparation_route).toBe('failed');
      expect(result.preparation_failure.error.message).toBeTruthy();
      expect(result.prepared_commit_inspected.request.detail.operations).toBeUndefined();
      expect(Object.keys(sidecar)).toEqual(['read_working', 'read_current', 'read_record']);
    },
  );
});
