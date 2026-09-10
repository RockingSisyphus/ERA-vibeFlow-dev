import { describe, expect, it, vi } from 'vitest';

import {
  AgentFunctionCallFailure,
  buildAgentRetryFeedback,
  agentRequestContext,
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

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 节点测试读取真实 Service 编排边界。
// @ts-ignore app rootDir 外的 Node source。
import { run as classifyGenerationNode } from '../../../javascript_project/service/nodes/agent/classify_generation_event';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 节点测试读取真实 Service 编排边界。
// @ts-ignore app rootDir 外的 Node source。
import { run as prepareGenerationNode } from '../../../javascript_project/service/nodes/agent/prepare_generation_phase';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 节点测试读取真实 Service 编排边界。
// @ts-ignore app rootDir 外的 Node source。
import { run as formTransitionNode } from '../../../javascript_project/service/nodes/agent/form_session_transition';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 节点测试读取真实 Service 编排边界。
// @ts-ignore app rootDir 外的 Node source。
import { run as prepareSettingsNode } from '../../../javascript_project/service/nodes/agent/prepare_settings_request';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 节点测试读取真实 Service 编排边界。
// @ts-ignore app rootDir 外的 Node source。
import { run as executeSettingsNode } from '../../../javascript_project/service/nodes/agent/execute_settings_command';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 节点测试读取真实 Service 编排边界。
// @ts-ignore app rootDir 外的 Node source。
import { run as buildSettingsNode } from '../../../javascript_project/service/nodes/agent/build_settings_result';
async function runAgentSessionNode(
  inputs: {
    'era.step.request.routed': { value: unknown };
    'era.batch.execution.state': { value: unknown };
  },
  params: Record<string, unknown>,
  runtime: { capabilities: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const step = inputs['era.step.request.routed'].value as { task?: { primaryEvent?: { type?: string } } };
  if (step.task?.primaryEvent?.type === 'era.ui.agent_configuration') {
    const prepared = await prepareSettingsNode(inputs, params, runtime as never);
    const executed = await executeSettingsNode(
      { 'era.agent.settings.request': { value: prepared.settings_request } },
      params,
      runtime as never,
    );
    const result = buildSettingsNode({ ...inputs, 'era.agent.settings.outcome': { value: executed.settings_outcome } });
    return { ...result, agent_transition: { schemaVersion: 1, step, ...executed.settings_outcome } };
  }
  const prepared = await prepareAgentSessionNode(inputs, params, runtime as never);
  const facts = prepared.generation_facts;
  const decision = classifyGenerationNode({ 'era.agent.generation.facts': { value: facts } });
  const request = prepareGenerationNode({ 'era.agent.generation.decision': { value: decision.generation_decision } });
  const host = runtime.capabilities['era.tavern.agent'] as Record<string, unknown>;
  const executionRuntime = {
    capabilities: {
      ...runtime.capabilities,
      'era.tavern.agent': {
        await_native_completion: async (input: { executionId: string }) => ({
          status: 'completed',
          executionId: input.executionId,
          identity: facts.context?.identity,
          latestMessage: facts.context?.latestMessage,
        }),
        ...host,
      },
    },
  };
  const executed = await executeAgentSessionNode(
    { 'era.agent.generation.request': { value: request.generation_request } },
    params,
    executionRuntime as never,
  );
  return formTransitionNode({ ...inputs, 'era.agent.generation.outcome': { value: executed.generation_outcome } });
}

describe('stage correction input', () => {
  it('uses the actual failed reply without the display trace truncation and requests a complete correction', () => {
    const response = `{"broken":"${'x'.repeat(140000)}`;
    const feedback = buildAgentRetryFeedback({ response, diagnostic: 'unexpected end', requestId: 'failed-1' });
    const data = JSON.parse(feedback.split('\n')[1]);
    expect(data).toEqual({ failedResponse: response, diagnostic: 'unexpected end' });
    expect(feedback).toContain('完整修正结果');
    expect(
      agentRequestContext({ id: 'run-1', trigger: 'manual-settlement' }, 1, {
        response,
        diagnostic: 'unexpected end',
        requestId: 'failed-1',
      }),
    ).toMatchObject({ intent: 'correction', previousRequestId: 'failed-1', executionId: 'run-1' });
  });
  it('distinguishes empty replies from transport failures and starts manual executions without old feedback', () => {
    expect(buildAgentRetryFeedback()).toBe('');
    expect(buildAgentRetryFeedback({ diagnostic: 'request unavailable' })).toBe('');
    expect(buildAgentRetryFeedback({ diagnostic: 'empty JSON', response: '' })).toContain('"failedResponse":""');
    expect(agentRequestContext({ id: 'new-run', trigger: 'manual-planning' }, 0)).toEqual({
      executionId: 'new-run',
      trigger: 'manual-planning',
      attemptIndex: 0,
      intent: 'initial',
    });
    expect(
      agentRequestContext({ id: 'new-run', trigger: 'manual-planning' }, 1, { diagnostic: 'offline' }).intent,
    ).toBe('request-retry');
  });
});

function floorDispatchContext(input: {
  chatId: string;
  messageId: number;
  activeText: string;
  eventId: string;
  sequence: number;
  mk?: string;
}) {
  const mk = input.mk ?? `era_mk_floor_${input.messageId}`;
  const message = {
    schemaVersion: 1,
    messageId: input.messageId,
    role: 'assistant',
    activeText: input.activeText,
    swipeIndex: 0,
  } as const;
  return {
    schemaVersion: 3,
    status: 'ready',
    dispatchClass: 'sync',
    requirement: 'latest-message-with-mk',
    messages: [message],
    processingMessage: message,
    processingMk: mk,
    messageChanged: false,
    variablesChanged: false,
    failure: null,
    generationCycleIdentity: {
      chatId: input.chatId,
      eventId: input.eventId,
      sourceKey: `${input.chatId}:agent:${input.sequence}`,
    },
    floorIdentity: {
      chatId: input.chatId,
      messageId: input.messageId,
      swipeId: 0,
      mk,
    },
    stagedMessageUpdates: [],
    agentFloorCandidate: null,
  } as const;
}

describe('retry failure boundaries', () => {
  async function execute(
    stage: 'planning' | 'settlement',
    generate: ReturnType<typeof vi.fn>,
    writeSession = vi.fn(),
    nativeCompletion?: () => Promise<unknown>,
  ) {
    const configuration = {
      schemaVersion: '2',
      planning: { enabled: stage === 'planning', retryCount: 5, attempts: [{ preset: { source: 'builtin' } }] },
      settlement: { enabled: stage === 'settlement', retryCount: 5, attempts: [{ preset: { source: 'builtin' } }] },
    };
    return runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              kind: 'sync',
              primaryEvent: {
                eventId: 'retry-event',
                sequence: 13,
                type: stage === 'planning' ? 'message_sent' : 'message_received',
                args: [],
              },
            },
            dispatchContext: floorDispatchContext({
              chatId: 'retry-chat',
              messageId: 7,
              activeText: 'story',
              eventId: 'retry-event',
              sequence: 13,
            }),
          },
        },
        'era.batch.execution.state': { value: { schemaVersion: 1 } },
      },
      {},
      {
        capabilities: {
          'era.tavern.agent': {
            read_context: vi.fn(async () => ({
              identity: { chatId: 'retry-chat', groupId: null },
              configuration,
              session:
                stage === 'settlement'
                  ? {
                      schemaVersion: 1,
                      status: 'opened',
                      chatKey: 'retry-chat',
                      configuration,
                      preState: { revision: 1, statData: {}, statFunc: {} },
                    }
                  : null,
              state: { revision: 1, statData: {}, statFunc: {} },
              latestMessage: {
                message_id: 7,
                role: stage === 'planning' ? 'user' : 'assistant',
                message: 'story',
                extra: {},
              },
            })),
            generate,
            ...(nativeCompletion ? { await_native_completion: nativeCompletion } : {}),
            read_session_binding: () => ({ active: false, previous: null }),
            write_session: writeSession,
            inject_once: vi.fn(),
            stop_native_generation: vi.fn(),
          },
        },
      },
    );
  }

  it('waits for native completion before starting settlement, but not planning', async () => {
    let finish!: (result: unknown) => void;
    const native = vi.fn(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const generate = vi.fn(async () => ({ response: '{"operations":[]}' }));
    const running = execute('settlement', generate, vi.fn(), native);
    await vi.waitFor(() => expect(native).toHaveBeenCalledOnce());
    expect(generate).not.toHaveBeenCalled();
    finish({
      status: 'completed',
      executionId: 'retry-event',
      identity: { chatId: 'retry-chat' },
      latestMessage: { message_id: 7, swipe_id: 0, message: 'story' },
    });
    await running;
    expect(generate).toHaveBeenCalledOnce();
    expect(native).toHaveBeenCalledWith({ chatId: 'retry-chat', executionId: 'retry-event' });
    native.mockClear();
    await execute(
      'planning',
      vi.fn(async () => ({ response: '{"storyPlan":{},"calls":[]}' })),
      vi.fn(),
      native,
    );
    expect(native).not.toHaveBeenCalled();
  });

  it.each(['cancelled', 'changed-chat', 'changed-swipe', 'changed-body', 'changed-execution'])(
    'does not send settlement after %s while waiting',
    async kind => {
      const generated = vi.fn();
      const result = {
        status: kind === 'cancelled' ? 'cancelled' : 'completed',
        executionId: kind === 'changed-execution' ? 'next-execution' : 'retry-event',
        identity: { chatId: kind === 'changed-chat' ? 'another' : 'retry-chat' },
        latestMessage: {
          message_id: 7,
          swipe_id: kind === 'changed-swipe' ? 1 : 0,
          message: kind === 'changed-body' ? 'edited' : 'story',
        },
      };
      const outcome = await execute('settlement', generated, vi.fn(), async () => result);
      expect(generated).not.toHaveBeenCalled();
      expect(outcome).toMatchObject({ agent_transition: { status: 'no-op' } });
    },
  );

  it.each(['planning', 'settlement'] as const)(
    '%s preserves the exact correction across request failures and replaces only invalid answers',
    async stage => {
      const bad =
        stage === 'planning'
          ? '{"storyPlan":{},"calls":[{"function":"missingFunction","args":[]}]}'
          : '{"operations":[{"op":"invalid-operation"}]}';
      const good = stage === 'planning' ? '{"storyPlan":{},"calls":[]}' : '{"operations":[]}';
      const generate = vi
        .fn()
        .mockRejectedValueOnce(new Error('NETWORK_ONE'))
        .mockResolvedValueOnce({ response: 'broken-json-B', requestId: 'answer-B' })
        .mockResolvedValueOnce({
          status: 'failed',
          diagnostic: { code: 'NETWORK_TWO', message: 'NETWORK_TWO' },
          requestId: 'network-2',
        })
        .mockResolvedValueOnce({ response: bad, requestId: 'answer-C' })
        .mockRejectedValueOnce(new Error('NETWORK_THREE'))
        .mockResolvedValueOnce({ response: good });
      const writeSession = vi.fn();
      const result = await execute(stage, generate, writeSession);
      expect(result.agent_transition).toMatchObject({ status: 'committed' });
      expect(generate).toHaveBeenCalledTimes(6);
      for (const error of ['NETWORK_ONE', 'NETWORK_TWO', 'NETWORK_THREE']) {
        expect(JSON.stringify(writeSession.mock.calls)).toContain(error);
      }
      const requests = generate.mock.calls.map(call => call[0]);
      expect(requests[1].userInput).toBe(requests[0].userInput);
      expect(requests[3].userInput).toBe(requests[2].userInput);
      expect(requests[5].userInput).toBe(requests[4].userInput);
      expect(requests[2].userInput).toContain('broken-json-B');
      expect(requests[4].userInput).not.toContain('broken-json-B');
      expect(requests[4].userInput).toContain(JSON.stringify(bad));
      expect(requests.map(r => r.requestContext.intent)).toEqual([
        'initial',
        'request-retry',
        'correction',
        'request-retry',
        'correction',
        'request-retry',
      ]);
      for (const request of requests) expect(request.userInput).not.toMatch(/NETWORK_ONE|NETWORK_TWO|NETWORK_THREE/);
      expect(requests[3].requestContext.previousRequestId).toBe('network-2');
      // A second, independent execution has no preceding model correction.
      const fresh = vi.fn().mockResolvedValue({ response: good });
      await execute(stage, fresh);
      expect(fresh.mock.calls[0][0].userInput).toBe(requests[0].userInput);
    },
  );

  it('does not retry a validated settlement when the subsequent Host session write fails', async () => {
    const generate = vi.fn().mockResolvedValue({ response: '{"operations":[]}' });
    const result = await execute(
      'settlement',
      generate,
      vi.fn(() => {
        throw new Error('HOST_SESSION_WRITE_FAILED');
      }),
    );
    expect(generate).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).toContain('HOST_SESSION_WRITE_FAILED');
    expect(result.agent_transition).not.toMatchObject({ status: 'committed' });
  });
});

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

  it('creates a pending custom connection before strict configuration normalization', async () => {
    const writeConfiguration = vi.fn(async () => ({ status: 'committed' }));
    const upsertConnectionProfile = vi.fn(async () => ({
      status: 'created',
      profile: {
        id: 'profile-created-by-host',
        name: 'Fixture API',
        apiUrl: 'http://127.0.0.1:19002',
        hasKey: false,
      },
    }));
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            sources: [
              {
                event: {
                  eventId: 'event-agent-save-with-new-profile',
                  sequence: 6,
                  type: 'era.ui.agent_configuration',
                },
                relation: 'primary',
              },
            ],
            task: {
              primaryEvent: {
                eventId: 'event-agent-save-with-new-profile',
                sequence: 6,
                type: 'era.ui.agent_configuration',
                args: [
                  {
                    kind: 'json',
                    value: {
                      action: 'write-with-connections',
                      configuration: {
                        schemaVersion: '2',
                        planning: {
                          enabled: true,
                          retryCount: 0,
                          attempts: [
                            {
                              preset: { source: 'builtin' },
                              modelSource: {
                                kind: 'custom-profile',
                                profileId: '',
                                model: 'fixture-model',
                              },
                            },
                          ],
                        },
                        settlement: {
                          enabled: false,
                          retryCount: 0,
                          attempts: [{ preset: { source: 'builtin' }, modelSource: { kind: 'tavern-current' } }],
                        },
                      },
                      connectionMutations: [
                        {
                          stage: 'planning',
                          index: 0,
                          name: 'Fixture API',
                          apiUrl: 'http://127.0.0.1:19002',
                          clearKey: false,
                        },
                      ],
                    },
                  },
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
            read_context: vi.fn(async () => ({ configuration: null })),
            upsert_connection_profile: upsertConnectionProfile,
            write_configuration: writeConfiguration,
            read_connection_state: () => ({ entryCount: 0, entryExists: false, profile: null }),
            read_configuration_sources: vi.fn(() => ({ connectionProfiles: [] })),
          } as never,
        },
      },
    );

    expect(upsertConnectionProfile).toHaveBeenCalledWith({
      name: 'Fixture API',
      apiUrl: 'http://127.0.0.1:19002',
      sourceId: null,
      id: null,
      status: 'created',
      keyMode: 'replace-if-nonempty-otherwise-preserve',
      keyReference: undefined,
    });
    expect(writeConfiguration).toHaveBeenCalledWith({
      configuration: expect.objectContaining({
        planning: expect.objectContaining({
          attempts: [
            expect.objectContaining({
              modelSource: {
                kind: 'custom-profile',
                profileId: 'profile-created-by-host',
                profileNameHint: 'Fixture API',
                model: 'fixture-model',
              },
            }),
          ],
        }),
      }),
    });
    expect(result.agent_transition).toMatchObject({ status: 'committed' });
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

  it('preserves completed function results and marks the failed and unexecuted calls', () => {
    try {
      executeAgentFunctionCalls({
        calls: [
          { function: 'floor', args: [2.9] },
          { function: 'sqrt', args: [-1] },
          { function: 'random', args: [] },
        ],
        statData: {},
        statFunc: {},
        sourceKey: 'partial-function-report',
      });
      expect.unreachable('invalid sqrt must fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AgentFunctionCallFailure);
      const results = (error as AgentFunctionCallFailure).functionResults;
      expect(results.map(result => result.status)).toEqual(['passed', 'failed', 'not-executed']);
      expect(results[0]).toMatchObject({ result: 2, drawOffsetStart: 0, drawOffsetEnd: 0 });
      expect(results[2]).not.toHaveProperty('result');
    }
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
            read_session_binding: () => ({ active: false, previous: null }),
            write_session: writeSession,
          } as never,
        },
      },
    );

    expect(writeSession).toHaveBeenCalledOnce();
    expect(writeSession).toHaveBeenCalledWith({
      chatKey: 'chat-agent-next',
      startStoryObservation: true,
      nativeExecutionId: null,
      nativeGeneration: true,
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
              configuration: {
                schemaVersion: '1',
                planning: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                settlement: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
              },
              session: null,
              latestMessage: { message_id: 0, role: 'assistant', message: '角色卡开场白' },
            })),
            read_session_binding: () => ({ active: false, previous: null }),
            write_session: writeSession,
          } as never,
        },
      },
    );

    expect(writeSession).not.toHaveBeenCalled();
    expect(result.agent_transition).toMatchObject({ mode: 'legacy', status: 'no-op' });
  });

  it('hands the planning-only composed message to legacy sync instead of its stale dispatch snapshot', async () => {
    const planReport = '<era_plan>{"storyPlan":{"scene":"baseline"},"calls":[]}</era_plan>';
    const story = '<VariableInsert><era_data>{"error_007":{"value":1}}</era_data></VariableInsert>';
    const eventId = 'event-planning-only-message-received';
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              kind: 'sync',
              primaryEvent: {
                eventId,
                sequence: 11,
                type: 'message_received',
                args: [],
              },
            },
            dispatchContext: floorDispatchContext({
              chatId: 'chat-agent-planning-only',
              messageId: 4,
              activeText: story,
              eventId,
              sequence: 11,
            }),
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
              latestMessage: {
                message_id: 4,
                role: 'assistant',
                message: story,
                extra: { api: 'openai', transientHostField: undefined },
              },
            })),
            read_session_binding: () => ({ active: false, previous: null }),
            write_session: vi.fn(() => ({ status: 'committed' })),
          } as never,
        },
      },
    );

    const candidate = (
      result.agent_transition as {
        step: {
          dispatchContext: {
            agentFloorCandidate: { content: string; mk: string; extra: Record<string, unknown> };
          };
        };
      }
    ).step.dispatchContext.agentFloorCandidate;
    expect(candidate.content).toContain(planReport);
    expect(candidate.content).toContain('<VariableInsert></VariableInsert>');
    expect(extractEraMessageKey(candidate.content)).toBe(candidate.mk);
    expect(candidate.extra).toEqual({
      era_agent: { schemaVersion: 1, status: 'story-complete', cycleIndex: 0 },
    });
    expect(result.agent_transition).toMatchObject({
      mode: 'execute-legacy',
      status: 'committed',
      step: {
        dispatchContext: {
          agentFloorCandidate: {
            messageId: 4,
            terminalStatus: 'story-complete',
            requiresInitialPresentation: true,
          },
        },
      },
    });
  });

  it('finishes the active cycle with its frozen configuration after the character switches stages', async () => {
    const generate = vi.fn();
    const planReport = '<era_plan>{"storyPlan":{"scene":"frozen"},"calls":[]}</era_plan>';
    const story = 'the already generated story';
    const eventId = 'event-frozen-cycle-message-received';
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              kind: 'sync',
              primaryEvent: {
                eventId,
                sequence: 12,
                type: 'message_received',
                args: [],
              },
            },
            dispatchContext: floorDispatchContext({
              chatId: 'chat-agent-frozen',
              messageId: 6,
              activeText: story,
              eventId,
              sequence: 12,
            }),
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
            read_session_binding: () => ({ active: false, previous: null }),
            write_session: vi.fn(() => ({ status: 'committed' })),
          } as never,
        },
      },
    );

    expect(generate).not.toHaveBeenCalled();
    expect(result.agent_transition).toMatchObject({
      mode: 'execute-legacy',
      status: 'committed',
      step: {
        dispatchContext: {
          agentFloorCandidate: {
            messageId: 6,
            terminalStatus: 'story-complete',
          },
        },
      },
    });
  });

  it('keeps settlement enabled for an active cycle even after the character turns it off', async () => {
    const generate = vi.fn(async () => ({ response: '{"operations":[]}' }));
    const eventId = 'event-frozen-settlement-message-received';
    const result = await runAgentSessionNode(
      {
        'era.step.request.routed': {
          value: {
            kind: 'execute',
            taskRoute: 'agent-generation-session',
            task: {
              kind: 'sync',
              primaryEvent: {
                eventId,
                sequence: 13,
                type: 'message_received',
                args: [],
              },
            },
            dispatchContext: floorDispatchContext({
              chatId: 'chat-agent-frozen-settlement',
              messageId: 7,
              activeText: 'settle this story',
              eventId,
              sequence: 13,
            }),
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
            read_session_binding: () => ({ active: false, previous: null }),
            write_session: vi.fn(() => ({ status: 'committed' })),
          } as never,
        },
      },
    );

    expect(generate).toHaveBeenCalledOnce();
    expect(result.agent_transition).toMatchObject({
      mode: 'execute-legacy',
      status: 'committed',
      step: {
        dispatchContext: {
          agentFloorCandidate: {
            messageId: 7,
            terminalStatus: 'settled',
          },
        },
      },
    });
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
            read_session_binding: () => ({ active: false, previous: null }),
            write_session: writeSession,
            inject_once: vi.fn(() => ({ status: 'injected' })),
          } as never,
        },
      },
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(writeSession).toHaveBeenLastCalledWith({
      chatKey: 'chat-profile-retry',
      startStoryObservation: false,
      nativeExecutionId: null,
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
    expect(generate.mock.calls[1]?.[0]).toMatchObject({
      requestContext: { intent: 'request-retry', attemptIndex: 1 },
      userInput: generate.mock.calls[0]?.[0].userInput,
    });
    expect(JSON.stringify(generate.mock.calls[1]?.[0])).not.toContain('failedResponse');
    expect(generate.mock.calls[1]?.[0].userInput).not.toContain('ERA_AGENT_PROFILE_MISSING');
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
              configuration: {
                schemaVersion: '1',
                planning: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
                settlement: { enabled: true, retryCount: 0, attempts: [{ preset: { source: 'builtin' } }] },
              },
              session: null,
            })),
            read_session_binding: () => ({ active: false, previous: null }),
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
