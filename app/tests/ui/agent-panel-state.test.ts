import { describe, expect, it } from 'vitest';

import {
  boundedConfiguration,
  createAgentPanelState,
} from '../../src/ERA变量框架/ui/components/RightRailContent/agent-panel-state';

describe('多阶段生成面板配置收窄', () => {
  it('删除空白可选字段，保持 Service 入口参数为纯 JSON', () => {
    const state = createAgentPanelState();
    state.configuration.planning.attempts[0].modelSource = {
      kind: 'custom-profile',
      profileId: '  profile-fixture  ',
      profileNameHint: '   ',
      model: '  fixture-model  ',
    };

    const configuration = boundedConfiguration(state);

    expect(configuration.planning.attempts[0].modelSource).toEqual({
      kind: 'custom-profile',
      profileId: 'profile-fixture',
      model: 'fixture-model',
    });
    expect(structuredClone(configuration)).toEqual(configuration);
    expect(JSON.parse(JSON.stringify(configuration))).toEqual(configuration);
  });
});
