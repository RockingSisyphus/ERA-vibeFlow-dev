import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentTavernHost } from '../../src/ERA变量框架/service/agent-tavern-host';
import { agentExecutionRecords, currentAgentRecordChat } from '../../src/ERA变量框架/service/agent-execution-records';

const signal = new AbortController().signal;
const capabilityContext = { signal };

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

  it('records native story without planning and retains its request across settlement writes', () => {
    const instance = host();
    instance.operations.write_session({ chatKey: 'test-chat', session: { status: 'opened' } }, capabilityContext);
    const id = String(instance.readSessionForViewer()?.storyRequestId);
    agentExecutionRecords.capture(currentAgentRecordChat(), [{ role: 'user', content: 'native actual prompt' }], false);
    instance.operations.write_session(
      { chatKey: 'test-chat', session: { status: 'settled', story: 'native response' } },
      capabilityContext,
    );
    expect(instance.readSessionForViewer()?.storyRequestId).toBe(id);
    expect(agentExecutionRecords.get(currentAgentRecordChat(), id)).toMatchObject({
      status: 'responded',
      response: 'native response',
      prompt: [{ role: 'user', content: 'native actual prompt' }],
    });
    instance.operations.write_session({ chatKey: 'test-chat', session: { status: 'opened' } }, capabilityContext);
    expect(instance.readSessionForViewer()?.storyRequestId).not.toBe(id);
    instance.stop();
  });

  it('captures a named preset as an ordered, sanitized snapshot', () => {
    const snapshot = host().operations.capture_preset({ name: 'Preset B' }, capabilityContext);
    expect(snapshot).toEqual({
      source: 'snapshot',
      sourceName: 'Preset B',
      orderedPrompts: ['char_description', { role: 'assistant', content: 'marker-preset-b' }, 'user_input'],
      settings: { maxTokens: 700, temperature: 0.2 },
    });
    expect(JSON.stringify(snapshot)).not.toContain('apiKey');
    expect(JSON.stringify(snapshot)).not.toContain('find_regex');
  });

  it('stores keys locally while exposing only summaries and preserving an empty edit key', async () => {
    const operations = host().operations;
    const created = (await operations.upsert_connection_profile(
      { id: 'lab-a', name: 'Lab A', apiUrl: 'http://127.0.0.1:4010/v1', keyProvider: () => 'top-secret-key' },
      capabilityContext,
    )) as Record<string, unknown>;
    expect(JSON.stringify(created)).not.toContain('top-secret-key');
    expect(JSON.stringify(operations.read_configuration_sources({}, capabilityContext))).not.toContain(
      'top-secret-key',
    );

    await operations.upsert_connection_profile(
      { id: 'lab-a', name: 'Lab A renamed', apiUrl: 'http://127.0.0.1:4010/v1' },
      capabilityContext,
    );
    const local = SillyTavern.extensionSettings.era_agent.connectionProfiles['lab-a'];
    expect(local.key).toBe('top-secret-key');
    expect(local.name).toBe('Lab A renamed');
  });

  it('loads and generates through the selected local profile without returning the key', async () => {
    const operations = host().operations;
    await operations.upsert_connection_profile(
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
        modelSource: { kind: 'custom-profile', profileId: 'lab-b', model: 'model-b' },
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
          modelSource: { kind: 'custom-profile', profileId: 'missing', model: 'model-x' },
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
