import { createCandidateRunner } from './agent-candidate-fixture';
import { normalizeAgentConfiguration } from '../../../javascript_project/service/base_lib/agent/agent_generation_session';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { contextWith, identity, sidecarId } from './memory-lifecycle-fixture';
import { createFunctionCallAdapter } from '../../src/ERA变量框架/service/function-call-adapter';
import { getInstalledEraPublicApi, installEraPublicApi } from '../../src/ERA变量框架/service/public-api';
import { installEraServiceClient } from '../../src/ERA变量框架/service/client';
import {
  publishSidecarRuntimeSnapshot,
  clearSidecarRuntimeSnapshot,
} from '../../src/ERA变量框架/service/sidecar-runtime-snapshot';
import { prepare } from '../../../javascript_project/service/nodes/sync/prepare_block_step';
import { run as advance } from '../../../javascript_project/service/nodes/sync/drive_message_blocks';
import {
  PrepareBlockWorkNode as prepareWork,
  PublishBlockApplicationNode as publish,
} from '../../../javascript_project/service/nodes/sync/shared_block_state_adapters';
import { recordFor } from '../../../javascript_project/service/base_lib/sidecar_binding';
import { planEraSync } from '../../../javascript_project/service/base_lib/sync/sync_planning';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const stop of cleanup.splice(0).reverse()) stop();
  clearSidecarRuntimeSnapshot();
  vi.unstubAllGlobals();
});

async function execute(
  text: string,
  action: (parameters: any) => Promise<unknown>,
  failApplication = false,
  candidates?: string[],
) {
  const context = contextWith(text);
  const original = context.step.dispatchContext.sourceBasis.messages;
  const invoke = vi.fn(async (_name: string, parameters: object) => {
    try {
      return await action(parameters);
    } catch (error) {
      return error;
    }
  });
  vi.stubGlobal('getCurrentCharacterId', () => identity.characterId);
  vi.stubGlobal('SillyTavern', {
    getCurrentChatId: () => identity.chatId,
    groupId: null,
    ToolManager: { invokeFunctionTool: invoke },
  });
  vi.stubGlobal('getChatMessages', () => structuredClone(original));
  vi.stubGlobal('initializeGlobal', () => undefined);
  cleanup.push(
    installEraServiceClient({
      currentLifecycleToken: () => 7,
      stopAccepting: () => undefined,
      enqueue: () => {
        throw new Error('function commit must not enter outer FIFO');
      },
    }),
  );
  cleanup.push(
    installEraPublicApi(() => ({
      mount: async () => {},
      list: () => [],
      select: async () => {},
      clearSelection: () => {},
      stop: () => {},
    })),
  );
  const functions = createFunctionCallAdapter();
  cleanup.push(() => functions.stop());
  const signal = new AbortController().signal;
  const record = recordFor(
    sidecarId,
    identity,
    { statData: { hp: 100 }, statFunc: {}, eraMeta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} } },
    null,
  );
  let working: any = { version: 0, record, dirty: false };
  function publishSnapshot() {
    publishSidecarRuntimeSnapshot(
      {
        identity,
        sidecarId,
        revision: working.record.revision,
        statData: working.record.state.statData,
        statFunc: working.record.state.statFunc,
        eraMeta: working.record.state.eraMeta,
      },
      false,
    );
  }
  publishSnapshot();
  const capabilities = {
    'era.tavern.identity': { read: () => ({ ...identity, lifecycleToken: 7 }) },
    'era.tavern.functions': Object.fromEntries(
      ['begin', 'next', 'acknowledge', 'release'].map(name => [
        name,
        (input: any) => (functions as any)[name](input, { signal }),
      ]),
    ),
    'era.tavern.sidecar': {
      read_working: () => ({ working }),
      write_working: (input: any) => {
        if (failApplication && input.record.state.statData.hp === 70)
          throw new Error('injected memory application failure');
        working = { ...input, version: working.version + 1 };
        publishSnapshot();
        return { working };
      },
    },
  };
  if (candidates) {
    let session: any = null;
    let index = 0;
    const agent = {
      generate: async () => ({ response: candidates[index++], requestId: `model-${index}` }),
      read_session_binding: () => ({ active: false, previous: session }),
      write_session: (input: any) => {
        session = input.session;
      },
      clear_session: () => {
        session = null;
      },
      stop_native_generation: () => {},
      create_error_message: async () => {},
    };
    const initial = {
      identity,
      session: null,
      state: record.state,
      latestMessage: { message_id: 1, role: 'user', message: text },
    };
    const runCandidate = createCandidateRunner(
      context.step,
      { schemaVersion: 1, nextState: {} },
      { capabilities: { ...capabilities, 'era.tavern.agent': agent } },
      initial,
    );
    const result = await runCandidate({
      phase: 'execute',
      identity: null,
      context: initial,
      configuration: normalizeAgentConfiguration({ planning: { enabled: true, retryCount: candidates.length - 1 } }),
      trigger: { type: 'message_sent', eventId: 'candidate-api', sequence: 1, kind: 'normal' },
    });
    return {
      state: { work: working.work },
      working,
      invoke,
      text: session?.stageMemory?.content ?? '',
      outcome: result.generation_outcome,
    };
  }
  let state = prepare({ 'era.sync.context': { value: context } }).block_step_state;
  for (let count = 0; !state.done; count++) {
    if (count > 100) throw new Error('block loop stalled');
    const pending = (await advance({ 'era.sync.block.step.state': { value: state } }, {}, { capabilities }))
      .block_step_pending;
    const work = prepareWork({ 'era.sync.block.step.pending': { value: pending } }).expression_command_result;
    state = publish({ 'era.command_compaction.result': { value: work } }, {}, { capabilities }).block_step_state_after;
  }
  expect(state.work.disposition).toBe(failApplication ? 'failed' : 'commit');
  return { state, working, invoke, text: state.work.plan?.messages[0].content.text ?? '' };
}

describe('原生工具到共用内存块循环', () => {
  it.each([undefined, { mode: 'auto' }, { mode: 'latest' }, { mode: 'full' }, { rollbackTo: 0 }] as const)(
    '函数内sync明确拒绝，捕获后commit及后块仍执行：%j',
    async options => {
      const result = await execute(
        '<EraFCall name="favor"/><VariableEdit>{"hp":{"$expr":"hp*2"}}</VariableEdit>',
        async parameters => {
          const era = getInstalledEraPublicApi().forCall(parameters);
          await expect(era.sync(options)).rejects.toThrow('ERA_FUNCTION_SYNC_UNSUPPORTED');
          await era.commit([{ edit: { hp: 70 } }], { scope: 'always' });
        },
      );
      expect(result.working.record.state.statData.hp).toBe(140);
      expect(result.text).toContain('status="done"');
      expect(result.state.work.plan!.diagnostics).toEqual([]);
    },
  );
  it('内存应用失败会拒绝正在await的commit并释放调用，不能遗留永不结束的作者函数', async () => {
    let rejected: unknown;
    const result = await execute(
      '<EraFCall name="favor"/>',
      async parameters => {
        const era = getInstalledEraPublicApi().forCall(parameters);
        try {
          await era.commit([{ edit: { hp: 70 } }], { scope: 'always' });
        } catch (error) {
          rejected = error;
        }
      },
      true,
    );
    await result.invoke.mock.results[0].value;
    expect(String(rejected)).toContain('injected memory application failure');
    expect(result.working.record.state.statData.hp).toBe(100);
    expect(result.state.functionFrame).toBeNull();
  });
  it('识别酒馆父窗口返回的跨 realm Error，保留原因并继续后块', async () => {
    const error = runInNewContext('new Error("tool is not registered")');
    expect(error).not.toBeInstanceOf(Error);
    const result = await execute('<EraFCall name="missing"/><VariableEdit>{"hp":90}</VariableEdit>', async () => error);
    expect(result.state.work.plan!.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ERA_FUNCTION_CALL_FAILED', message: 'tool is not registered' }),
    );
    expect(result.text).toContain('status="done"');
    expect(result.working.record.state.statData.hp).toBe(90);
  });
  it('await commit立即看到最新内存，函数后的表达式基于70继续计算', async () => {
    const seen: number[] = [];
    const result = await execute(
      '<VariableEdit>{"hp":100}</VariableEdit><EraFCall name="favor" args=\'{"delta":30}\'/><VariableEdit>{"hp":{"$expr":"hp*2"}}</VariableEdit>',
      async parameters => {
        const era = getInstalledEraPublicApi().forCall(parameters);
        seen.push((era.get().statData as { hp: number }).hp);
        const receipt = await era.commit([{ edit: { hp: { $expr: `hp-${parameters.delta}` } } }], { scope: 'always' });
        expect(receipt.status).toBe('committed');
        seen.push((era.get().statData as { hp: number }).hp);
      },
    );
    expect(seen).toEqual([100, 70]);
    expect(result.working.record.state.statData.hp).toBe(140);
    expect(result.invoke).toHaveBeenCalledTimes(1);
    expect(result.text).toContain('status="done"');
    expect(result.text).not.toContain('era_fcall_anchor');
    expect(result.text).not.toContain('era_block');
    expect(result.text.indexOf('<era_tx')).toBeGreaterThan(result.text.indexOf('<EraFCall'));
    expect(result.text.indexOf('<era_tx')).toBeLessThan(result.text.indexOf('hp*2'));
    const replay = planEraSync({
      messages: result.state.work.plan!.messages,
      stat: result.working.record.state.statData,
      statFunc: {},
      meta: result.working.record.state.eraMeta,
      reason: 'manual',
      processingMk: null,
      consecutiveState: null,
    });
    expect(replay.stat).toEqual({ hp: 140 });
    expect(result.invoke).toHaveBeenCalledTimes(1);
  });
  it('不await的commit按接收顺序执行，函数结束仍处理已发出的请求', async () => {
    const receipts: Promise<unknown>[] = [];
    const result = await execute(
      '<EraFCall name="favor"/><VariableEdit>{"hp":{"$expr":"hp*2"}}</VariableEdit>',
      async parameters => {
        const era = getInstalledEraPublicApi().forCall(parameters);
        receipts.push(era.commit([{ edit: { hp: 70 } }], { scope: 'always' }));
        receipts.push(era.commit([{ edit: { hp: { $expr: 'hp+5' } } }], { scope: 'always' }));
      },
    );
    await Promise.all(receipts);
    expect(result.working.record.state.statData.hp).toBe(150);
    expect(result.text.match(/<era_tx /g)).toHaveLength(2);
  });
  it('函数抛错保留成功API记录并标done，后续块正常执行', async () => {
    const result = await execute(
      '<EraFCall name="favor"/><VariableEdit>{"hp":{"$expr":"hp*2"}}</VariableEdit>',
      async parameters => {
        const era = getInstalledEraPublicApi().forCall(parameters);
        await era.commit([{ edit: { hp: 70 } }], { scope: 'always' });
        throw new Error('author failure');
      },
    );
    expect(result.working.record.state.statData.hp).toBe(140);
    expect(result.text).toContain('status="done"');
    expect(result.state.work.plan!.diagnostics.some((item: any) => item.message === 'author failure')).toBe(true);
  });
});

it.each(['broken-json', '{"storyPlan":{},"calls":[{"function":"missing","args":[]}]}'])(
  '函数API前缀在候选失败后整体回退，scope和done不泄漏：%s',
  async invalid => {
    const seen: number[] = [];
    const facades: any[] = [];
    const result = await execute(
      'previous story',
      async parameters => {
        const api = getInstalledEraPublicApi().forCall(parameters);
        facades.push(api);
        seen.push((api.get().statData as { hp: number }).hp);
        await api.commit([{ edit: { hp: { $expr: 'hp-10' } } }], { scope: 'message' });
      },
      false,
      ['<EraFCall name="favor"/>' + invalid, '<EraFCall name="favor"/>{"storyPlan":{},"calls":[]}'],
    );
    expect(result.invoke).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([100, 100]);
    expect(result.working.record.state.statData.hp).toBe(90);
    expect(result.text.match(/status="done"/g)).toHaveLength(1);
    expect(result.text.match(/<era_tx /g)).toHaveLength(1);
    await expect(facades[0].commit([{ edit: { hp: 1 } }], { scope: 'always' })).rejects.toThrow(
      'ERA_FUNCTION_CONTEXT_EXPIRED',
    );
    expect(result.working.record.state.statData.hp).toBe(90);
  },
);
