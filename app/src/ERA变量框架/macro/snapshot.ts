import type { EraPublicState } from '../service/public-api';
import type { EraMacroSnapshot } from './syntax';

/**
 * 从已经反转义的公开状态建立宏快照。
 *
 * 状态栏和普通消息投影共享这一纯转换，避免依赖负责注册酒馆宏的
 * 生命周期模块，也避免再次反转义作者写入的字面量。
 */
export function createEraMacroSnapshotFromPublicState(
  state: Pick<EraPublicState, 'statData' | 'statWithoutMeta'>,
): EraMacroSnapshot {
  return {
    statWithMeta: structuredClone(state.statData),
    statWithoutMeta: structuredClone(state.statWithoutMeta),
  };
}
