/**
 * 消息内函数调用的 Host 执行驱动与位置门面。
 *
 * 关键性质：函数在步骤之外执行，函数内的 `ERA.commit` 走位置通道而**不入队**
 * ——否则处理该消息的 FIFO 会与等待函数返回的自身互等。
 */

import lodash from 'lodash';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type JsonRecord = Record<string, any>;

let createEraFacade: typeof import('../../src/ERA变量框架/service/public-api').createEraFacade;
let publishSidecarRuntimeSnapshot: typeof import('../../src/ERA变量框架/service/sidecar-runtime-snapshot').publishSidecarRuntimeSnapshot;
let clearSidecarRuntimeSnapshot: typeof import('../../src/ERA变量框架/service/sidecar-runtime-snapshot').clearSidecarRuntimeSnapshot;
let createEraFunctionsRuntime: typeof import('../../src/ERA变量框架/service/era-functions-capability').createEraFunctionsRuntime;
let dispatchMessageFunctionHandoff: typeof import('../../src/ERA变量框架/service/era-message-function-handoff-host').dispatchMessageFunctionHandoff;

const HANDOFF = {
  schemaVersion: 1,
  messageId: 4,
  mk: 'mk-4',
  blockIndex: 1,
  callId: 'c1',
  name: 'attack',
  args: { damage: 30 },
  stat: { hp: 100 },
  statFunc: {},
};

function notificationHandoff(value: unknown = HANDOFF) {
  return { type: 'era.message.invoke_required', args: [value] } as never;
}

function admissions() {
  const calls: JsonRecord[] = [];
  const enqueue = (type: string, source: string, args: readonly unknown[]) => {
    calls.push({ type, source, args });
    return {
      accepted: true,
      eventId: `event-${calls.length}`,
      sequence: calls.length,
      done: Promise.resolve({ status: 'completed', value: {} }),
    } as never;
  };
  return { calls, enqueue };
}

function statusbarFactory() {
  return () => ({
    mount: async () => undefined,
    list: () => [],
    select: async () => undefined,
    clearSelection: () => undefined,
    stop: () => undefined,
  });
}

function installTool(impl: (name: string, args: JsonRecord) => Promise<unknown>) {
  vi.stubGlobal('SillyTavern', {
    groupId: null,
    getCurrentChatId: () => 'chat-handoff',
    ToolManager: { invokeFunctionTool: (name: string, args: JsonRecord) => impl(name, args) },
  });
}

describe('消息内函数调用：Host 执行驱动与位置门面', () => {
  beforeAll(async () => {
    vi.stubGlobal('_', lodash);
    ({ createEraFacade } = await import('../../src/ERA变量框架/service/public-api'));
    ({ publishSidecarRuntimeSnapshot, clearSidecarRuntimeSnapshot } =
      await import('../../src/ERA变量框架/service/sidecar-runtime-snapshot'));
    ({ createEraFunctionsRuntime } = await import('../../src/ERA变量框架/service/era-functions-capability'));
    ({ dispatchMessageFunctionHandoff } =
      await import('../../src/ERA变量框架/service/era-message-function-handoff-host'));
  });

  beforeEach(() => {
    vi.stubGlobal('getCurrentCharacterId', () => 'card-handoff');
    vi.stubGlobal('SillyTavern', {
      groupId: null,
      getCurrentChatId: () => 'chat-handoff',
    });
    publishSidecarRuntimeSnapshot({
      sidecarId: 'era_chat_handoff-12345678',
      identity: { characterId: 'card-handoff', groupId: null, chatId: 'chat-handoff' },
      revision: 3,
      statData: { hp: 90 },
      statFunc: {},
      eraMeta: { SelectedMks: [null, null, null, null, 'mk-4'], EditLogs: {}, FunctionEditLogs: {} },
    } as never);
  });

  afterEach(() => {
    clearSidecarRuntimeSnapshot();
    vi.unstubAllGlobals();
    vi.stubGlobal('_', lodash);
  });

  it('函数在步骤之外执行，函数内提交走位置通道而不入队', async () => {
    const runtime = createEraFunctionsRuntime();
    const facade = createEraFacade(statusbarFactory() as never);
    const { calls, enqueue } = admissions();
    let commits = 0;

    installTool(async (name, args) => {
      expect(name).toBe('attack');
      expect(args).toEqual({ damage: 30 });
      const receipt = await facade.commit([{ edit: { hp: { $expr: 'hp - 30' } } }]);
      commits += 1;
      expect(receipt.status).toBe('committed');
      return 'ok';
    });

    await dispatchMessageFunctionHandoff(
      notificationHandoff(),
      new AbortController().signal,
      enqueue as never,
      runtime,
    );

    // 位置通道生效：普通 FIFO 提交一次都没有发生。
    expect(commits).toBe(1);
    expect(calls.map(call => call.type)).toEqual(['era.message.invoke_continue']);
    const payload = calls[0]!.args[0] as JsonRecord;
    expect(payload).toMatchObject({ messageId: 4, mk: 'mk-4', callId: 'c1', status: 'completed' });
    expect(payload.operations).toEqual([{ edit: { hp: { $expr: 'hp - 30' } } }]);
    runtime.stop();
  });

  it('位置门面把调用位置的累计状态交给函数读取', async () => {
    const runtime = createEraFunctionsRuntime();
    const facade = createEraFacade(statusbarFactory() as never);
    const { enqueue } = admissions();
    const seen: JsonRecord[] = [];

    installTool(async () => {
      seen.push(facade.get() as unknown as JsonRecord);
      return 'ok';
    });

    await dispatchMessageFunctionHandoff(
      notificationHandoff(),
      new AbortController().signal,
      enqueue as never,
      runtime,
    );

    // 读到的必须是调用位置状态（调用前块已生效），不是已提交的旧侧车状态。
    expect(seen[0]?.stat).toEqual({ hp: 100 });
    expect(seen[0]?.message_id).toBe(4);
    runtime.stop();
  });

  it('位置绑定期间 sync / history / statusbar 报位置绑定不支持', async () => {
    const runtime = createEraFunctionsRuntime();
    const facade = createEraFacade(statusbarFactory() as never);
    const { enqueue } = admissions();
    const failures: string[] = [];

    installTool(async () => {
      await expect(facade.sync()).rejects.toThrow(/ERA_POSITION_BOUND_UNSUPPORTED/);
      await expect(facade.history.atMessage(4)).rejects.toThrow(/ERA_POSITION_BOUND_UNSUPPORTED/);
      try {
        void facade.statusbar;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
      return 'ok';
    });

    await dispatchMessageFunctionHandoff(
      notificationHandoff(),
      new AbortController().signal,
      enqueue as never,
      runtime,
    );

    expect(failures.join('\n')).toContain('ERA_POSITION_BOUND_UNSUPPORTED');
    runtime.stop();
  });

  it('未注册工具以失败终态回送，不抛异常', async () => {
    const runtime = createEraFunctionsRuntime();
    const { calls, enqueue } = admissions();
    installTool(async () => new Error('No tool with the name "attack" has been registered.'));

    await dispatchMessageFunctionHandoff(
      notificationHandoff(),
      new AbortController().signal,
      enqueue as never,
      runtime,
    );

    const payload = calls[0]!.args[0] as JsonRecord;
    expect(payload.status).toBe('failed');
    expect(payload.unregistered).toBe(true);
    expect(payload.operations).toEqual([]);
    runtime.stop();
  });

  it('生命周期取消后不回送，也不执行函数', async () => {
    const runtime = createEraFunctionsRuntime();
    const { calls, enqueue } = admissions();
    let invoked = 0;
    installTool(async () => {
      invoked += 1;
      return 'ok';
    });
    const controller = new AbortController();
    controller.abort();

    await dispatchMessageFunctionHandoff(notificationHandoff(), controller.signal, enqueue as never, runtime);

    expect(invoked).toBe(0);
    expect(calls).toEqual([]);
    runtime.stop();
  });

  it('载荷缺字段时拒绝执行，不伪造调用位置', async () => {
    const runtime = createEraFunctionsRuntime();
    const { calls, enqueue } = admissions();
    let invoked = 0;
    installTool(async () => {
      invoked += 1;
      return 'ok';
    });

    await dispatchMessageFunctionHandoff(
      notificationHandoff({ messageId: 4, mk: 'mk-4' }),
      new AbortController().signal,
      enqueue as never,
      runtime,
    );

    expect(invoked).toBe(0);
    expect(calls).toEqual([]);
    runtime.stop();
  });
});
