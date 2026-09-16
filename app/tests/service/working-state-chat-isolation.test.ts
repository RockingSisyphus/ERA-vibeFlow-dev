import { afterEach, expect, it } from 'vitest';
import {
  clearWorkingState,
  readWorkingState,
  storeWorkingState,
  type EraWorkingState,
} from '../../src/ERA变量框架/service/sidecar-runtime-snapshot';

afterEach(() => clearWorkingState());
const a = { characterId: 'one', groupId: null, chatId: 'a' };
const b = { ...a, chatId: 'b' };
const state = (identity: typeof a, value: number): EraWorkingState => ({
  identity,
  version: 1,
  record: { state: { statData: { hp: value } } },
  work: { pending: true },
  sourceBasis: { message: 'original' },
  dirty: true,
});
it('切到另一个聊天发布状态后，返回原聊天仍有未保存操作及恢复依据', () => {
  storeWorkingState(state(a, 70));
  expect(readWorkingState(b)).toBeNull();
  storeWorkingState(state(b, 200));
  expect(readWorkingState(a)).toEqual(state(a, 70));
  expect(readWorkingState(b)).toEqual(state(b, 200));
  expect(readWorkingState({ ...a, characterId: 'different' })).toBeNull();
  const returned = readWorkingState(a)!;
  (returned.record.state as any).statData.hp = 0;
  expect(readWorkingState(a)).toEqual(state(a, 70));
});
it('同一聊天保存后更新该聊天版本，不能清除另一个聊天的待保存批次', () => {
  storeWorkingState(state(a, 70));
  storeWorkingState(state(b, 200));
  storeWorkingState({ ...state(a, 75), version: 2, dirty: false });
  expect(readWorkingState(a)).toMatchObject({ version: 2, dirty: false });
  expect(readWorkingState(b)).toEqual(state(b, 200));
  clearWorkingState();
  expect(readWorkingState(a)).toBeNull();
  expect(readWorkingState(b)).toBeNull();
});
