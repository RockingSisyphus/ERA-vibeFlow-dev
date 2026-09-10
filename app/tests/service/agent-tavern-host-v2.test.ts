import { writeSession as writeWorkflowSession } from '../../../javascript_project/service/nodes/agent/execute_generation_session';
import {
  connectionId,
  planConnectionSave,
  type ConnectionState,
} from '../../../javascript_project/service/base_lib/agent_connection_policy';
import {
  buildAgentRequestPolicy,
  captureAgentPresetSnapshot,
} from '../../../javascript_project/service/base_lib/agent_request_policy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentTavernHost } from '../../src/ERA变量框架/service/agent-tavern-host';
import { agentExecutionRecords, currentAgentRecordChat } from '../../src/ERA变量框架/service/agent-execution-records';

const signal = new AbortController().signal;
const capabilityContext = { signal };

function save(
  operations: AgentTavernHost['operations'],
  input: Readonly<Record<string, unknown>>,
  context: { signal: AbortSignal },
) {
  const state = operations.read_connection_state({ id: connectionId(input.id) }, context) as ConnectionState;
  return operations.upsert_connection_profile(
    { ...planConnectionSave(input, state), keyProvider: input.keyProvider },
    context,
  );
}

/** 调用原 Node 的真实写入入口，Host 测试只绑定能力上下文。 */
function writeSession(
  operations: AgentTavernHost['operations'],
  input: Readonly<Record<string, unknown>>,
  context: { signal: AbortSignal },
) {
  return writeWorkflowSession(
    {
      read_session_binding: request => operations.read_session_binding(request, context),
      write_session: request => operations.write_session(request, context),
    },
    input,
  );
}

describe('AgentTavernHost V2 local routes', () => {
  const saveSettingsDebounced = vi.fn(async () => undefined);
  const writeExtensionField = vi.fn(async () => undefined);
  const fetchMock = vi.fn();
  const generateRawMock = vi.fn(async () => '{"storyPlan":{},"calls":[]}');

  beforeEach(() => {
    vi.stubGlobal('SillyTavern', {
      getChatCompletionModel: () => 'current-model',
      characterId: '0',
      groupId: '',
      getCurrentChatId: () => 'test-chat',
      characters: [{ data: { extensions: {} } }],
      extensionSettings: {},
      saveSettingsDebounced,
      writeExtensionField,
      getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'test-token' }),
    });
    vi.stubGlobal(
      'getPresetNames',
      vi.fn(() => ['Preset A', 'Preset B']),
    );
    vi.stubGlobal(
      'getLoadedPresetName',
      vi.fn(() => 'Preset A'),
    );
    vi.stubGlobal(
      'getPreset',
      vi.fn(() => ({
        prompts: [
          { id: 'charDescription', enabled: true, role: 'system' },
          { id: 'custom', enabled: true, role: 'assistant', content: 'marker-preset-b' },
          { id: 'disabled', enabled: false, role: 'system', content: 'must-not-leak' },
        ],
        settings: { max_completion_tokens: 700, temperature: 0.2 },
        extensions: { regex_scripts: [{ find_regex: 'secret' }], apiKey: 'secret' },
      })),
    );
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'model-b' }, { id: 'model-a' }, { id: 'model-a' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('generateRaw', generateRawMock);
    vi.stubGlobal(
      'generate',
      vi.fn(async () => 'story'),
    );
    vi.stubGlobal(
      'eventOnce',
      vi.fn(() => ({ stop: vi.fn() })),
    );
    vi.stubGlobal('tavern_events', { GENERATION_AFTER_COMMANDS: 'generation_after_commands' });
    vi.stubGlobal('injectPrompts', vi.fn());
    vi.stubGlobal(
      'stopAllGeneration',
      vi.fn(() => false),
    );
  });

  afterEach(() => {
    agentExecutionRecords.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function host(): AgentTavernHost {
    return new AgentTavernHost({
      internalMessageWrites: new Map(),
      readIdentity: () => ({ chatId: 'chat-v2', groupId: null }),
    });
  }

  it('releases the native waiter from the native event and cleans up its observer', async () => {
    const handlers = new Map<string, (messageId: number) => void>();
    vi.stubGlobal('tavern_events', { GENERATION_ENDED: 'generation_ended' });
    vi.stubGlobal('eventOn', (name: string, handler: (messageId: number) => void) => handlers.set(name, handler));
    vi.stubGlobal('eventRemoveListener', (name: string) => handlers.delete(name));
    vi.stubGlobal('getChatMessages', () => [{ message_id: 3, message: 'story', swipe_id: 0 }]);
    const instance = host();
    const stop = instance.nativeGeneration.observe();
    instance.nativeGeneration.start();
    writeSession(
      instance.operations,
      {
        chatKey: 'test-chat',
        nativeGeneration: true,
        session: { status: 'opened', execution: { id: 'cycle-1', trigger: 'initial' } },
      },
      capabilityContext,
    );
    const completed = vi.fn();
    const waiting = instance.operations
      .await_native_completion({ chatId: 'test-chat', executionId: 'cycle-1' }, capabilityContext)
      .then(completed);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    expect(handlers.has('js_generation_ended')).toBe(false);
    handlers.get('generation_ended')!(3);
    await waiting;
    expect(completed).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', executionId: 'cycle-1', messageId: 3 }),
    );
    stop();
    expect(handlers.size).toBe(0);
    instance.stop();
  });

  it('does not wait for a future native event when Helper creates messages outside generation', async () => {
    vi.stubGlobal('getChatMessages', () => []);
    const instance = host();
    writeSession(
      instance.operations,
      { chatKey: 'test-chat', nativeGeneration: true, session: { status: 'opened', execution: { id: 'manual' } } },
      capabilityContext,
    );
    await expect(
      instance.operations.await_native_completion({ chatId: 'test-chat', executionId: 'manual' }, capabilityContext),
    ).resolves.toMatchObject({ status: 'not-native' });
    instance.stop();
  });

  it('records native story without planning and retains its request across settlement writes', () => {
    const instance = host();
    writeSession(instance.operations, { chatKey: 'test-chat', session: { status: 'opened' } }, capabilityContext);
    const id = String(instance.readSessionForViewer()?.storyRequestId);
    agentExecutionRecords.capture(currentAgentRecordChat(), [{ role: 'user', content: 'native actual prompt' }], false);
    writeSession(
      instance.operations,
      { chatKey: 'test-chat', session: { status: 'settled', story: 'native response' } },
      capabilityContext,
    );
    expect(instance.readSessionForViewer()?.storyRequestId).toBe(id);
    expect(agentExecutionRecords.get(currentAgentRecordChat(), id)).toMatchObject({
      status: 'responded',
      response: 'native response',
      prompt: [{ role: 'user', content: 'native actual prompt' }],
    });
    writeSession(instance.operations, { chatKey: 'test-chat', session: { status: 'opened' } }, capabilityContext);
    expect(instance.readSessionForViewer()?.storyRequestId).not.toBe(id);
    instance.stop();
  });

  it('captures a named preset as an ordered, sanitized snapshot', () => {
    const facts = host().operations.capture_preset({ name: 'Preset B' }, capabilityContext);
    const snapshot = captureAgentPresetSnapshot(facts);
    expect(snapshot).toEqual({
      source: 'snapshot',
      sourceName: 'Preset B',
      orderedPrompts: ['char_description', 'user_input', { role: 'assistant', content: 'marker-preset-b' }],
      settings: { maxTokens: 700, temperature: 0.2 },
    });
    expect(JSON.stringify(snapshot)).not.toContain('apiKey');
    expect(JSON.stringify(snapshot)).not.toContain('find_regex');
  });

  it('expands snapshot macros in order through Helper without rewriting the captured preset', async () => {
    const substitute = vi.fn((text: string) => text.replace('{{user}}', 'Traveler'));
    vi.stubGlobal('substitudeMacros', substitute);
    const prompts = [
      { role: 'system', content: 'Hello {{user}}' },
      'user_input',
      { role: 'assistant', content: 'Ready' },
    ];
    const requestContext = { executionId: 'manual-1', trigger: 'manual-planning', attemptIndex: 0, intent: 'initial' };
    const result = (await host().operations.generate(
      {
        generationId: 'macros',
        stage: 'planning',
        userInput: 'task',
        orderedPrompts: prompts,
        resolvePresetMacros: true,
        requestContext,
        settings: {},
        requestPolicy: buildAgentRequestPolicy({ kind: 'tavern-current' }, {}),
      },
      capabilityContext,
    )) as Record<string, unknown>;
    expect(substitute.mock.calls).toEqual([['Hello {{user}}'], ['Ready']]);
    expect(prompts[0]).toEqual({ role: 'system', content: 'Hello {{user}}' });
    expect(generateRawMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ordered_prompts: [
          { role: 'system', content: 'Hello Traveler' },
          'user_input',
          { role: 'assistant', content: 'Ready' },
        ],
      }),
    );
    expect(agentExecutionRecords.get(currentAgentRecordChat(), String(result.requestId))?.requestContext).toEqual(
      requestContext,
    );
  });

  it('stores keys locally while exposing only summaries and preserving an empty edit key', async () => {
    const operations = host().operations;
    const created = (await save(
      operations,
      { id: 'lab-a', name: 'Lab A', apiUrl: 'http://127.0.0.1:4010/v1', keyProvider: () => 'top-secret-key' },
      capabilityContext,
    )) as Record<string, unknown>;
    expect(JSON.stringify(created)).not.toContain('top-secret-key');
    expect(JSON.stringify(operations.read_configuration_sources({}, capabilityContext))).not.toContain(
      'top-secret-key',
    );

    await save(
      operations,
      { id: 'lab-a', name: 'Lab A renamed', apiUrl: 'http://127.0.0.1:4010/v1' },
      capabilityContext,
    );
    const local = SillyTavern.extensionSettings.era_agent.connectionProfiles['lab-a'];
    expect(local.key).toBe('top-secret-key');
    expect(local.name).toBe('Lab A renamed');
  });

  it('loads and generates through the selected local profile without returning the key', async () => {
    const operations = host().operations;
    await save(
      operations,
      { id: 'lab-b', name: 'Lab B', apiUrl: 'http://127.0.0.1:4020/v1', keyProvider: () => 'another-secret' },
      capabilityContext,
    );
    const listed = await operations.list_connection_models({ id: 'lab-b' }, capabilityContext);
    expect(listed).toMatchObject({ models: ['model-a', 'model-b'] });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backends/chat-completions/status',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          reverse_proxy: 'http://127.0.0.1:4020/v1',
          proxy_password: 'another-secret',
          chat_completion_source: 'openai',
        }),
      }),
    );

    const generated = await operations.generate(
      {
        generationId: 'generation-v2',
        userInput: 'plan',
        orderedPrompts: [{ role: 'system', content: 'marker' }, 'user_input'],
        settings: {},
        requestPolicy: buildAgentRequestPolicy({ kind: 'custom-profile', profileId: 'lab-b', model: 'model-b' }, {}),
      },
      capabilityContext,
    );
    expect(generateRawMock).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_api: expect.objectContaining({
          apiurl: 'http://127.0.0.1:4020/v1',
          key: 'another-secret',
          model: 'model-b',
        }),
      }),
    );
    expect(JSON.stringify(generated)).not.toContain('another-secret');
    expect(generated).toMatchObject({
      route: { kind: 'custom-profile', profileId: 'lab-b', model: 'model-b' },
    });
  });

  it('distinguishes a legitimate empty model list from a failed status request', async () => {
    const operations = host().operations;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(
      operations.list_connection_models_draft(
        { apiUrl: 'http://127.0.0.1:4020/v1', keyProvider: () => 'placeholder-key' },
        capabilityContext,
      ),
    ).resolves.toEqual({ models: [] });

    fetchMock.mockResolvedValueOnce(new Response('provider unavailable', { status: 503 }));
    await expect(
      operations.list_connection_models_draft(
        { apiUrl: 'http://127.0.0.1:4020/v1', keyProvider: () => 'placeholder-key' },
        capabilityContext,
      ),
    ).rejects.toThrow('ERA_AGENT_MODEL_LIST_FAILED');
  });

  it('never silently falls back when a referenced local profile is missing', async () => {
    await expect(
      host().operations.generate(
        {
          generationId: 'generation-missing',
          userInput: 'plan',
          orderedPrompts: ['user_input'],
          settings: {},
          requestPolicy: buildAgentRequestPolicy(
            { kind: 'custom-profile', profileId: 'missing', model: 'model-x' },
            {},
          ),
        },
        capabilityContext,
      ),
    ).resolves.toEqual({
      status: 'failed',
      requestId: expect.stringMatching(/^generation-missing-/u),
      diagnostic: {
        code: 'ERA_AGENT_PROFILE_MISSING',
        message: 'ERA_AGENT_PROFILE_MISSING：本机连接方案不存在，需要重新绑定。',
      },
    });
    expect(generateRawMock).not.toHaveBeenCalled();
  });
});
