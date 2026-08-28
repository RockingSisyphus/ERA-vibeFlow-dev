import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentTavernHost } from '../../src/ERA变量框架/service/agent-tavern-host';

const signal = new AbortController().signal;
const capabilityContext = { signal };

describe('AgentTavernHost V2 local routes', () => {
  const saveSettingsDebounced = vi.fn(async () => undefined);
  const writeExtensionField = vi.fn(async () => undefined);
  const getModelListMock = vi.fn(async () => ['model-a', 'model-b']);
  const generateRawMock = vi.fn(async () => '{"storyPlan":{},"calls":[]}');

  beforeEach(() => {
    vi.stubGlobal('SillyTavern', {
      characterId: '0',
      groupId: '',
      characters: [{ data: { extensions: {} } }],
      extensionSettings: {},
      saveSettingsDebounced,
      writeExtensionField,
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
    vi.stubGlobal('getModelList', getModelListMock);
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
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function host(): AgentTavernHost {
    return new AgentTavernHost({
      internalMessageWrites: new Map(),
      readIdentity: () => ({ chatId: 'chat-v2', groupId: null }),
    });
  }

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
      { id: 'lab-a', name: 'Lab A', apiUrl: 'http://127.0.0.1:4010/v1', key: 'top-secret-key' },
      capabilityContext,
    )) as Record<string, unknown>;
    expect(JSON.stringify(created)).not.toContain('top-secret-key');
    expect(JSON.stringify(operations.read_configuration_sources({}, capabilityContext))).not.toContain(
      'top-secret-key',
    );

    await operations.upsert_connection_profile(
      { id: 'lab-a', name: 'Lab A renamed', apiUrl: 'http://127.0.0.1:4010/v1', key: '' },
      capabilityContext,
    );
    const local = SillyTavern.extensionSettings.era_agent.connectionProfiles['lab-a'];
    expect(local.key).toBe('top-secret-key');
    expect(local.name).toBe('Lab A renamed');
  });

  it('loads and generates through the selected local profile without returning the key', async () => {
    const operations = host().operations;
    await operations.upsert_connection_profile(
      { id: 'lab-b', name: 'Lab B', apiUrl: 'http://127.0.0.1:4020/v1', key: 'another-secret' },
      capabilityContext,
    );
    const listed = await operations.list_connection_models({ id: 'lab-b' }, capabilityContext);
    expect(listed).toMatchObject({ models: ['model-a', 'model-b'] });
    expect(getModelListMock).toHaveBeenCalledWith({
      apiurl: 'http://127.0.0.1:4020/v1',
      key: 'another-secret',
    });

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
      diagnostic: {
        code: 'ERA_AGENT_PROFILE_MISSING',
        message: 'ERA_AGENT_PROFILE_MISSING：本机连接方案不存在，需要重新绑定。',
      },
    });
    expect(generateRawMock).not.toHaveBeenCalled();
  });
});
