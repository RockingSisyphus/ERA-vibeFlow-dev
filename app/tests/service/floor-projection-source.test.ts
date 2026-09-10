import { describe, expect, it } from 'vitest';
import {
  projectFloorSnapshot,
  projectFloorSnapshots,
} from '../../../javascript_project/service/base_lib/domain/floor_snapshot';
import * as published from '@era/vibeflow-floor-snapshot';

describe('登记快照源码与同步分发出口', () => {
  const input = {
    stat: { hp: 9, bag: ['rope'] },
    statFunc: { twice: { expr: 'x*2' } },
    meta: {
      SelectedMks: ['a', 'b'],
      EditLogs: {
        a: [{ op: 'insert', path: 'hp', value_new: 12 }],
        b: [
          { op: 'update', path: 'hp', value_old: 12, value_new: 9 },
          { op: 'insert', path: 'bag[0]', value_new: 'rope' },
        ],
      },
      FunctionEditLogs: { b: [{ op: 'insert', name: 'twice', value_new: { expr: 'x*2' } }] },
    },
  };
  it('正向与逆向投影保持公开包结果并且不修改输入', () => {
    const before = structuredClone(input);
    for (const messageIds of [[], [0], [1], [1, 0, 1]]) {
      const request = { ...input, messageIds };
      expect(projectFloorSnapshots(request)).toEqual(published.projectFloorSnapshots(request));
    }
    expect(projectFloorSnapshot({ ...input, messageId: 0 })).toMatchObject({ stat: { hp: 12 }, statFunc: {} });
    expect(projectFloorSnapshot({ ...input, messageId: 1 })).toMatchObject({
      stat: input.stat,
      statFunc: input.statFunc,
    });
    expect(input).toEqual(before);
  });
  it('缺失楼层和非法编号保持原异常类型', () => {
    expect(() => projectFloorSnapshot({ ...input, messageId: -1 })).toThrow(TypeError);
    expect(() => projectFloorSnapshot({ ...input, messageId: 2 })).toThrow(RangeError);
    expect(() => projectFloorSnapshot({ ...input, meta: { SelectedMks: [null] }, messageId: 0 })).toThrow(RangeError);
  });
  it('特殊键作为自有数据写入，不改变对象原型', () => {
    const result = projectFloorSnapshot({
      stat: {},
      statFunc: {},
      messageId: 0,
      meta: {
        SelectedMks: ['a', 'b'],
        EditLogs: { a: [{ op: 'insert', path: ['__proto__', 'bounded'], value_new: true }] },
      },
    });
    expect(Object.hasOwn(result.stat as object, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).bounded).toBeUndefined();
  });
});
