import { describe, expect, it } from 'vitest';
import {
  composeCanonicalFloor,
  joinStageParts,
  prefixIntact,
  readStageLayout,
  stageBody,
  stageDraft,
  stagePrefix,
} from '../../../javascript_project/service/base_lib/agent/agent_stage_layout';

describe('阶段消息分段约定', () => {
  it('分段之间按规则拼装：空段丢弃，其他段以换行连接', () => {
    expect(joinStageParts(['开头', '', null, undefined, '正文'])).toBe('开头\n正文');
    expect(joinStageParts([])).toBe('');
  });

  it('前缀核对只忽略边界空白，分段内部改动仍视为不一致', () => {
    expect(prefixIntact('', '\n')).toBe(true);
    expect(prefixIntact('开头正文', '开头正文\n')).toBe(true);
    expect(prefixIntact('开头正文', '开头')).toBe(true);
    expect(prefixIntact('开头改过', '开头')).toBe(true);
    expect(prefixIntact('改过的正文', '开头')).toBe(false);
    expect(prefixIntact('别的开头', '开头')).toBe(false);
  });

  it('截取新增内容时去掉开头分隔空白', () => {
    expect(stageDraft('', '\n')).toBe('');
    expect(stageDraft('开头\n\n新增', '开头')).toBe('新增');
    expect(stageDraft('新增', '')).toBe('新增');
  });

  it('落稿正文去掉数据块与尾部空白后再追加消息标识块', () => {
    expect(stageBody('<era_data>{"k":"v"}</era_data>正文  \n')).toBe('正文');
    expect(stagePrefix(['开头', '', '正文'])).toBe('开头\n正文');
    const floor = composeCanonicalFloor('正文  \n<StatusPlaceHolderImpl/>', 'mk-1', true);
    expect(floor.startsWith('正文\n<era_data>')).toBe(true);
    expect(floor.endsWith('<StatusPlaceHolderImpl/>')).toBe(true);
  });

  it('从楼层正文恢复开头与最后一个规划报告的位置', () => {
    const text = '开头\n<era_plan>{"a":1}</era_plan>正文';
    const layout = readStageLayout(text);
    expect(layout.open).toBe('开头\n');
    expect(layout.planJson).toBe('{"a":1}');
    expect(layout.planStart).toBe(3);
    expect(layout.planEnd).toBe(text.indexOf('</era_plan>') + '</era_plan>'.length);
    expect(readStageLayout('没有规划')).toEqual({
      open: '',
      planJson: '',
      planStart: -1,
      planEnd: -1,
    });
  });
});
