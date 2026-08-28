import { describe, expect, it, vi } from 'vitest';

import {
  countAgentCycles,
  executeAgentFunctionCalls,
  extractEraMessageKey,
  formatAgentPlanReport,
  formatAgentTransaction,
  formatAgentUpdateReport,
  isAgentPlanningFailureMessage,
  isolateStoryEraCommands,
  normalizeAgentConfiguration,
  parsePlanningOutput,
  parseSettlementOutput,
  sanitizePresetSnapshot,
  stripAgentReportsForPrompt,
  validateSettlementOperations,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Service 纯领域函数的差分测试必须读取真实 VibeFlow 源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/agent_generation_session';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 节点测试必须调用正式 VibeFlow Node source。
// @ts-ignore app tsconfig 不声明 Service Node 的跨 root 类型。
import { run as executeAgentSessionNode } from '../../../javascript_project/service/nodes/agent/execute_generation_session';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 节点测试必须经过正式的 V2 准备节点。
// @ts-ignore app tsconfig 不声明 Service Node 的跨 root 类型。
import { run as prepareAgentSessionNode } from '../../../javascript_project/service/nodes/agent/prepare_auxiliary_execution_request';

async function runAgentSessionNode(
  inputs: {
    'era.step.request.routed': { value: unknown };
    'era.batch.execution.state': { value: unknown };
  },
  params: Record<string, unknown>,
  runtime: { capabilities: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const prepared = await prepareAgentSessionNode(inputs, params, runtime as never);
  return executeAgentSessionNode(
    {
      'era.agent.auxiliary.execution_request': {
        value: prepared.agent_auxiliary_execution_request,
      },
    },
    params,
    runtime as never,
  );
}

describe('AgentGenerationSession pure contracts', () => {
  it('keeps legacy cards disabled and bounds retry profiles', () => {
    expect(normalizeAgentConfiguration(undefined)).toMatchObject({
      schemaVersion: '2',
      planning: { enabled: false, retryCount: 3 },
      settlement: { enabled: false, retryCount: 3 },
    });
    const normalized = normalizeAgentConfiguration({
      schemaVersion: '1',
      planning: {
        enabled: true,
        retryCount: 999,
        attempts: [{ preset: { source: 'builtin' }, model: ' model-a ' }],
      },
      settlement: { enabled: false, retryCount: -1, attempts: [] },
    });
    expect(normalized.planning.retryCount).toBe(16);
    expect(normalized.planning.attempts[0]).toEqual({
      preset: { source: 'builtin' },
      modelSource: { kind: 'tavern-current', legacyModelOverride: 'model-a' },
    });
    expect(normalized.settlement.retryCount).toBe(3);
  });

  it('sanitizes embedded presets to prompts and common sampling values', () => {
    expect(
      sanitizePresetSnapshot({
        source: 'snapshot',
        orderedPrompts: [
          'chat_history',
          { role: 'system', content: 'plan safely', credential: 'secret' },
          'unknown-placeholder',
        ],
        settings: { temperature: 0.4, topP: 0.9, apiKey: 'secret' },
        apiUrl: 'https://example.invalid',
      }),
    ).toEqual({
      source: 'snapshot',
      orderedPrompts: ['chat_history', { role: 'system', content: 'plan safely' }],
      settings: { temperature: 0.4, topP: 0.9 },
    });
  });

  it('strictly parses planning and settlement JSON', () => {
    expect(
      parsePlanningOutput('```json\n{"storyPlan":{"beat":"door"},"calls":[{"function":"floor","args":[2.9]}]}\n```'),
    ).toEqual({
      storyPlan: { beat: 'door' },
      calls: [{ function: 'floor', args: [2.9] }],
    });
    expect(parseSettlementOutput('{"operations":[{"insert":{"time":10}},{"edit":{"time":20}}]}')).toEqual({
      operations: [{ insert: { time: 10 } }, { edit: { time: 20 } }],
    });
    expect(() => parsePlanningOutput('{"storyPlan":{},"calls":[{"function":"x-y","args":[]}]}')).toThrow('函数名无效');
    expect(() => parseSettlementOutput('{"operations":[{"insert":{},"edit":{}}]}')).toThrow('只能包含一种');
  });

  it('executes deterministic functions in one ordered random draw stream', () => {
    const input = {
      calls: [
        { function: 'random', args: [] },
        { function: 'floor', args: [2.9] },
        { function: 'random', args: [] },
      ],
      statData: {},
      statFunc: {},
      sourceKey: 'message-mk-1',
    } as const;
    const first = executeAgentFunctionCalls(input);
    const replay = executeAgentFunctionCalls(input);
    expect(first).toEqual(replay);
    expect(first.results.map(item => item.drawOffsetStart)).toEqual([0, 1, 1]);
    expect(first.results.map(item => item.drawOffsetEnd)).toEqual([1, 1, 2]);
    expect(first.results[1]?.result).toBe(2);
    expect(first.nextDrawOffset).toBe(2);
  });

  it('isolates story commands while preserving report and transaction order', () => {
    const isolated = isolateStoryEraCommands(
      'story <VariableEdit>{"a":1}</VariableEdit> middle <era_tx s="m"><VariableDelete>{"b":null}</VariableDelete></era_tx>',
    );
    expect(isolated.story).toBe('story  middle');
    expect(isolated.audit).toContain('<VariableEdit>');
    expect(isolated.audit).toContain('<era_tx s="m">');

    const plan = formatAgentPlanReport({ ok: true });
    const update = formatAgentUpdateReport({ settled: true });
    const transaction = formatAgentTransaction([{ insert: { time: 10 } }]);
    const message = `${plan}\nvisible story\n${update}\n${transaction}`;
    expect(message.indexOf('<era_plan>')).toBeLessThan(message.indexOf('visible story'));
    expect(message.indexOf('<era_update>')).toBeLessThan(message.indexOf('<era_tx'));
    const promptMessage = stripAgentReportsForPrompt(message);
    expect(promptMessage).not.toContain('<era_plan>');
    expect(promptMessage).not.toContain('<era_update>');
    expect(promptMessage).toContain('visible story');
    expect(promptMessage).toContain(transaction);
  });

  it('reads the authoritative message key and counts completed Agent cycles', () => {
    expect(extractEraMessageKey('<era_data era-message-key="mk-42">{}</era_data>')).toBe('mk-42');
    expect(extractEraMessageKey("<era_data era-message-key='mk-single'>{}</era_data>")).toBe('mk-single');
    expect(extractEraMessageKey('plain story')).toBeNull();
    expect(countAgentCycles('<era_plan>{}</era_plan>story<era_update>{}</era_update>')).toBe(1);
    expect(countAgentCycles('<era_plan>{}</era_plan>story<era_plan>{}</era_plan>more')).toBe(2);
  });

  it('keeps only visible story while auditing story-model commands', () => {
    const isolated = isolateStoryEraCommands(
      [
        '<era_plan>{"old":true}</era_plan>',
        '<era_data era-message-key="mk-1">{"hidden":true}</era_data>',
        '<StatusPlaceHolderImpl/>',
        'visible story',
        '<VariableEdit>{"story_model_should_be_ignored":1}</VariableEdit>',
        '<era_update>{"old":true}</era_update>',
      ].join('\n'),
    );
    expect(isolated.story).toBe('visible story');
    expect(isolated.audit).toContain('story_model_should_be_ignored');
    expect(isolated.audit).not.toContain('era_plan');
  });

  it('recognizes ERA-owned planning failure messages without matching ordinary stories', () => {
    expect(
      isAgentPlanningFailureMessage({
        role: 'assistant',
        message: '<era_agent_error>{"stage":"planning"}</era_agent_error>',
      }),
    ).toBe(true);
    expect(
      isAgentPlanningFailureMessage({
        role: 'assistant',
        message: '',
        extra: { era_agent: { status: 'planning-failed', swipeLocked: true } },
      }),
    ).toBe(true);
    expect(
      isAgentPlanningFailureMessage({
        role: 'assistant',
        message: 'The plan failed in the story, but this is ordinary prose.',
        extra: { era_agent: { status: 'story-complete' } },
      }),
    ).toBe(false);
  });

  it('rejects an invalid later function before executing any call', () => {
    expect(() =>
      executeAgentFunctionCalls({
        calls: [
          { function: 'random', args: [] },
          { function: 'missingFunction', args: [] },
        ],
        statData: {},
        statFunc: {},
        sourceKey: 'message-mk-prevalidate',
      }),
    ).toThrow('未知函数');
  });

  it('trial-applies settlement operations through the real command engine', () => {
    const validated = validateSettlementOperations({
      operations: [{ insert: { time: 10 } }, { edit: { time: 20 } }],
      statData: {},
      statFunc: {},
      messageId: 3,
      sourceKey: 'message-mk-3',
    });
    expect(validated.finalStat).toEqual({ time: 20 });
    expect(validated.transaction).toContain('<era_tx s="m">');
  });

  it('clears the in-memory session when Tavern reports generation_stopped', async () => {
    const clearSession = vi.fn(() => ({ status: 'cleared' }));
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              primaryEvent: {
                eventId: 'event-generation-stopped',
                sequence: 7,
                type: 'generation_stopped',
                args: [],
              },
            },
          },
        },
        'era.batch.execution.state': { value: { schemaVersion: 1 } },
      },
      {},
      {
        capabilities: {
          'era.tavern.agent': {
            read_context: vi.fn(async () => ({
              identity: { chatId: 'chat-agent-stop' },
              configuration: null,
              session: { status: 'opened' },
            })),
            clear_session: clearSession,
          } as never,
        },
      },
    );

    expect(clearSession).toHaveBeenCalledWith({ chatKey: 'chat-agent-stop' });
    expect(result.agent_transition).toMatchObject({
      mode: 'legacy-ignore',
      status: 'committed',
      value: { status: 'generation-cancelled' },
    });
  });

  it.each([
    ['no session', null],
    ['a completed session', { schemaVersion: 1, chatKey: 'chat-agent-idle', status: 'settled' }],
  ])('does not settle a host message with %s', async (_label, session) => {
    const generate = vi.fn();
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              primaryEvent: {
                eventId: 'event-message-received-idle',
                sequence: 8,
                type: 'message_received',
                args: [],
              },
            },
          },
        },
        'era.batch.execution.state': { value: { schemaVersion: 1 } },
      },
      {},
      {
        capabilities: {
          'era.tavern.agent': {
            read_context: vi.fn(async () => ({
              identity: { chatId: 'chat-agent-idle' },
              regexEnabled: true,
              configuration: {
                schemaVersion: '1',
                planning: { enabled: false, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                settlement: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
              },
              session,
              latestMessage: { message_id: 0, role: 'assistant', message: '角色卡开场白' },
            })),
            generate,
          } as never,
        },
      },
    );

    expect(generate).not.toHaveBeenCalled();
    expect(result.agent_transition).toMatchObject({ mode: 'legacy', status: 'no-op' });
  });

  it('opens a fresh cycle for every new user message instead of reusing the completed session', async () => {
    const writeSession = vi.fn(() => ({ status: 'committed' }));
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              primaryEvent: {
                eventId: 'event-message-sent-next-cycle',
                sequence: 9,
                type: 'message_sent',
                args: [],
              },
            },
          },
        },
        'era.batch.execution.state': { value: { schemaVersion: 1 } },
      },
      {},
      {
        capabilities: {
          'era.tavern.agent': {
            read_context: vi.fn(async () => ({
              identity: { chatId: 'chat-agent-next' },
              regexEnabled: true,
              configuration: {
                schemaVersion: '1',
                planning: { enabled: false, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                settlement: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
              },
              session: {
                schemaVersion: 1,
                chatKey: 'chat-agent-next',
                status: 'settled',
                messageId: 4,
              },
              latestMessage: { message_id: 5, role: 'user', message: '下一轮' },
              state: { revision: 3, statData: { time: 10 }, statFunc: {} },
            })),
            write_session: writeSession,
          } as never,
        },
      },
    );

    expect(writeSession).toHaveBeenCalledOnce();
    expect(writeSession).toHaveBeenCalledWith({
      chatKey: 'chat-agent-next',
      session: expect.objectContaining({ chatKey: 'chat-agent-next', status: 'opened', cycleIndex: 0 }),
    });
    expect(result.agent_transition).toMatchObject({ mode: 'execute-legacy', status: 'committed' });
  });

  it('does not let an uncaused normal generation_started event create an Agent cycle', async () => {
    const writeSession = vi.fn();
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              primaryEvent: {
                eventId: 'event-uncued-normal-generation',
                sequence: 10,
                type: 'generation_started',
                args: [
                  { kind: 'json', value: 'normal' },
                  { kind: 'json', value: {} },
                  { kind: 'json', value: false },
                ],
              },
            },
          },
        },
        'era.batch.execution.state': { value: { schemaVersion: 1 } },
      },
      {},
      {
        capabilities: {
          'era.tavern.agent': {
            read_context: vi.fn(async () => ({
              identity: { chatId: 'chat-agent-greeting' },
              regexEnabled: true,
              configuration: {
                schemaVersion: '1',
                planning: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                settlement: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
              },
              session: null,
              latestMessage: { message_id: 0, role: 'assistant', message: '角色卡开场白' },
            })),
            write_session: writeSession,
          } as never,
        },
      },
    );

    expect(writeSession).not.toHaveBeenCalled();
    expect(result.agent_transition).toMatchObject({ mode: 'legacy', status: 'no-op' });
  });

  it('hands the planning-only composed message to legacy sync instead of its stale dispatch snapshot', async () => {
    const writeMessage = vi.fn(async () => ({ status: 'committed' }));
    const planReport = '<era_plan>{"storyPlan":{"scene":"baseline"},"calls":[]}</era_plan>';
    const story = '<VariableInsert><era_data>{"error_007":{"value":1}}</era_data></VariableInsert>';
    const composed = `${planReport}\n${story}`;
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              kind: 'sync',
              primaryEvent: {
                eventId: 'event-planning-only-message-received',
                sequence: 11,
                type: 'message_received',
                args: [],
              },
            },
            dispatchContext: {
              status: 'ready',
              messages: [{ messageId: 4, activeText: story }],
              processingMessage: { messageId: 4, activeText: story },
            },
          },
        },
        'era.batch.execution.state': { value: { schemaVersion: 1 } },
      },
      {},
      {
        capabilities: {
          'era.tavern.agent': {
            read_context: vi.fn(async () => ({
              identity: { chatId: 'chat-agent-planning-only' },
              regexEnabled: true,
              configuration: {
                schemaVersion: '1',
                planning: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                settlement: { enabled: false, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
              },
              session: {
                schemaVersion: 1,
                chatKey: 'chat-agent-planning-only',
                status: 'planned',
                cycleIndex: 0,
                planReport,
              },
              latestMessage: { message_id: 4, role: 'assistant', message: story, extra: {} },
            })),
            write_message: writeMessage,
            write_session: vi.fn(() => ({ status: 'committed' })),
          } as never,
        },
      },
    );

    expect(writeMessage).toHaveBeenCalledWith(expect.objectContaining({ messageId: 4, message: composed }));
    expect(result.agent_transition).toMatchObject({
      mode: 'execute-legacy',
      status: 'committed',
      step: {
        dispatchContext: {
          messages: [{ messageId: 4, activeText: composed }],
          processingMessage: { messageId: 4, activeText: composed },
        },
      },
    });
  });

  it('finishes the active cycle with its frozen configuration after the character switches stages', async () => {
    const generate = vi.fn();
    const writeMessage = vi.fn(async () => ({ status: 'committed' }));
    const planReport = '<era_plan>{"storyPlan":{"scene":"frozen"},"calls":[]}</era_plan>';
    const story = 'the already generated story';
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              kind: 'sync',
              primaryEvent: {
                eventId: 'event-frozen-cycle-message-received',
                sequence: 12,
                type: 'message_received',
                args: [],
              },
            },
          },
        },
        'era.batch.execution.state': { value: { schemaVersion: 1 } },
      },
      {},
      {
        capabilities: {
          'era.tavern.agent': {
            read_context: vi.fn(async () => ({
              identity: { chatId: 'chat-agent-frozen', groupId: null },
              regexEnabled: true,
              configuration: {
                schemaVersion: '1',
                planning: { enabled: false, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                settlement: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
              },
              session: {
                schemaVersion: 1,
                chatKey: 'chat-agent-frozen',
                status: 'planned',
                cycleIndex: 0,
                planReport,
                configuration: {
                  schemaVersion: '1',
                  planning: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                  settlement: { enabled: false, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                },
              },
              latestMessage: { message_id: 6, role: 'assistant', message: story, extra: {} },
            })),
            generate,
            write_message: writeMessage,
            write_session: vi.fn(() => ({ status: 'committed' })),
          } as never,
        },
      },
    );

    expect(generate).not.toHaveBeenCalled();
    expect(writeMessage).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 6, message: `${planReport}\n${story}` }),
    );
    expect(result.agent_transition).toMatchObject({ mode: 'execute-legacy', status: 'committed' });
  });

  it('keeps settlement enabled for an active cycle even after the character turns it off', async () => {
    const generate = vi.fn(async () => ({ response: '{"operations":[]}' }));
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              kind: 'sync',
              primaryEvent: {
                eventId: 'event-frozen-settlement-message-received',
                sequence: 13,
                type: 'message_received',
                args: [],
              },
            },
          },
        },
        'era.batch.execution.state': { value: { schemaVersion: 1 } },
      },
      {},
      {
        capabilities: {
          'era.tavern.agent': {
            read_context: vi.fn(async () => ({
              identity: { chatId: 'chat-agent-frozen-settlement', groupId: null },
              regexEnabled: true,
              configuration: null,
              session: {
                schemaVersion: 1,
                chatKey: 'chat-agent-frozen-settlement',
                status: 'opened',
                cycleIndex: 0,
                configuration: {
                  schemaVersion: '1',
                  planning: { enabled: false, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                  settlement: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                },
                preState: { revision: 1, statData: {}, statFunc: {} },
              },
              latestMessage: { message_id: 7, role: 'assistant', message: 'settle this story', extra: {} },
            })),
            generate,
            write_message: vi.fn(async () => ({ status: 'committed' })),
            write_session: vi.fn(() => ({ status: 'committed' })),
          } as never,
        },
      },
    );

    expect(generate).toHaveBeenCalledOnce();
    expect(result.agent_transition).toMatchObject({ mode: 'execute-legacy', status: 'committed' });
  });

  it('preserves a structured missing-profile diagnostic and retries the next planning profile', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'failed',
        diagnostic: {
          code: 'ERA_AGENT_PROFILE_MISSING',
          message: 'ERA_AGENT_PROFILE_MISSING：本机连接方案不存在，需要重新绑定。',
        },
      })
      .mockResolvedValueOnce({ response: '{"storyPlan":{"scene":"retry"},"calls":[]}' });
    const writeSession = vi.fn(() => ({ status: 'committed' }));
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              primaryEvent: {
                eventId: 'event-profile-retry',
                sequence: 15,
                type: 'message_sent',
                args: [],
              },
            },
          },
        },
        'era.batch.execution.state': { value: { schemaVersion: 1 } },
      },
      {},
      {
        capabilities: {
          'era.tavern.agent': {
            read_context: vi.fn(async () => ({
              identity: { chatId: 'chat-profile-retry', groupId: null },
              regexEnabled: true,
              configuration: {
                schemaVersion: '2',
                planning: {
                  enabled: true,
                  retryCount: 1,
                  attempts: [
                    {
                      preset: { source: 'builtin' },
                      modelSource: {
                        kind: 'custom-profile',
                        profileId: 'missing-profile-v2',
                        profileNameHint: 'Missing',
                        model: 'missing-model',
                      },
                    },
                    { preset: { source: 'builtin' }, modelSource: { kind: 'tavern-current' } },
                  ],
                },
                settlement: { enabled: false, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
              },
              session: null,
              latestMessage: { message_id: 1, role: 'user', message: 'retry this plan' },
              state: { revision: 1, statData: {}, statFunc: {} },
            })),
            generate,
            write_session: writeSession,
            inject_once: vi.fn(() => ({ status: 'injected' })),
          } as never,
        },
      },
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(writeSession).toHaveBeenLastCalledWith({
      chatKey: 'chat-profile-retry',
      session: expect.objectContaining({
        status: 'planned',
        planningAttempts: [
          expect.objectContaining({
            status: 'failed',
            diagnostic: 'ERA_AGENT_PROFILE_MISSING：本机连接方案不存在，需要重新绑定。',
          }),
          expect.objectContaining({ status: 'passed' }),
        ],
      }),
    });
    expect(result.agent_transition).toMatchObject({ mode: 'execute-legacy', status: 'committed' });
  });

  it('delegates group chats to the unchanged ERA generation path', async () => {
    const writeSession = vi.fn();
    const generate = vi.fn();
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              primaryEvent: {
                eventId: 'event-group-message-sent',
                sequence: 14,
                type: 'message_sent',
                args: [],
              },
            },
          },
        },
        'era.batch.execution.state': { value: { schemaVersion: 1 } },
      },
      {},
      {
        capabilities: {
          'era.tavern.agent': {
            read_context: vi.fn(async () => ({
              identity: { chatId: 'chat-agent-group', groupId: 'group-1' },
              regexEnabled: true,
              configuration: {
                schemaVersion: '1',
                planning: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                settlement: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
              },
              session: null,
            })),
            write_session: writeSession,
            generate,
          } as never,
        },
      },
    );

    expect(writeSession).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(result.agent_transition).toMatchObject({
      mode: 'legacy',
      status: 'no-op',
      value: { status: 'group-chat-unsupported' },
    });
  });
});
